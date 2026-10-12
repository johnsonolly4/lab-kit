// What a token template writes outside the cursor: properties (`set:` in its header) and `{{#append "Heading"}}` parts under a heading.
// Pure: the note's text in, a list of edits out, so the runner can apply them through the editor without moving the cursor.
import type { TemplateAppend } from "./snippet-template";

/** Replace the text from `from` to `to` (offsets in the note as it was) with `text`. */
export interface NoteEdit { from: number; to: number; text: string }

const FRONT = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** The edit that sets the properties in the note's front matter (added when the note has none); null when there is nothing to set. A value is written as quoted text. */
export function propertyEdit(note: string, props: { name: string; value: string }[]): NoteEdit | null {
  if (!props.length) return null;
  const line = (p: { name: string; value: string }): string => `${p.name}: ${JSON.stringify(p.value)}`;
  const m = FRONT.exec(note);
  if (!m) return { from: 0, to: 0, text: `---\n${props.map(line).join("\n")}\n---\n` };
  const lines = m[1] === undefined ? [] : m[1].split(/\r?\n/);
  for (const p of props) {
    const at = lines.findIndex(l => new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(l));
    if (at < 0) { lines.push(line(p)); continue; }
    let end = at + 1;   // a list or text that continues on indented or "- " lines belongs to the property
    while (end < lines.length && /^(?:\s+\S|-\s|-$|\s*$)/.test(lines[end]) && !/^\S[^:]*:/.test(lines[end])) end++;
    lines.splice(at, end - at, line(p));
  }
  const open = note.indexOf("\n") + 1;
  const body = m[1] === undefined ? 0 : m[1].length + (note.startsWith("\r\n", open + m[1].length) ? 2 : 1);   // up to the closing --- line
  return { from: open, to: open + body, text: lines.join("\n") + "\n" };
}

/** Where each heading line of the note is (code blocks are not read): its level, text and the offsets of the line. */
function headings(note: string): { level: number; text: string; from: number; to: number }[] {
  const out: { level: number; text: string; from: number; to: number }[] = [];
  let pos = 0, fence = "";
  for (const raw of note.split("\n")) {
    const line = raw.trim();
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && line === f[1] && f[1][0] === fence[0] && f[1].length >= fence.length) fence = ""; }
    else if (f) fence = f[1];
    else {
      const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
      if (h) out.push({ level: h[1].length, text: h[2], from: pos, to: pos + raw.length });
    }
    pos += raw.length + 1;
  }
  return out;
}

/**
 * The edits that put each part under its heading: at the end of that heading's section when the note has the heading (any level,
 * capitals ignored), else under a new heading at the end of the note. Parts for one heading are joined; an empty part is left out.
 */
export function appendEdits(note: string, appends: TemplateAppend[]): NoteEdit[] {
  const groups = new Map<string, { heading: string; level: number; texts: string[] }>();
  for (const a of appends) {
    const text = a.text.replace(/^\s*\n/, "").trimEnd();
    if (!text) continue;
    const key = a.heading.toLowerCase();
    if (!groups.has(key)) groups.set(key, { heading: a.heading, level: a.level, texts: [] });
    groups.get(key)!.texts.push(text);
  }
  const heads = headings(note);
  const edits: NoteEdit[] = [];
  const fresh: string[] = [];
  /** End of the last line with text before `end`. */
  const lastText = (end: number): number => note.slice(0, end).trimEnd().length;
  for (const g of groups.values()) {
    const block = g.texts.join("\n\n");
    const i = heads.findIndex(h => h.text.toLowerCase() === g.heading.toLowerCase());
    if (i < 0) { fresh.push(`${"#".repeat(g.level)} ${g.heading}\n${block}`); continue; }
    const next = heads.slice(i + 1).find(h => h.level <= heads[i].level);
    const end = next ? next.from : note.length;
    const keep = Math.max(lastText(end), heads[i].to);
    edits.push({ from: keep, to: end, text: (keep === heads[i].to ? "\n" : "\n\n") + block + "\n" + (next ? "\n" : "") });
  }
  if (fresh.length) {
    const keep = lastText(note.length);
    edits.push({ from: keep, to: note.length, text: (keep ? "\n\n" : "") + fresh.join("\n\n") + "\n" });
  }
  return edits;
}

/** Every edit of one insert, last in the note first, so each can be applied without shifting the ones still to come. */
export function noteEdits(note: string, props: { name: string; value: string }[], appends: TemplateAppend[]): NoteEdit[] {
  const p = propertyEdit(note, props);
  return [...appendEdits(note, appends), ...(p ? [p] : [])].sort((a, b) => b.from - a.from);
}

/** The note with the edits applied (the runner does the same through the editor). */
export function applyEdits(note: string, edits: NoteEdit[]): string {
  return [...edits].sort((a, b) => b.from - a.from).reduce((s, e) => s.slice(0, e.from) + e.text + s.slice(e.to), note);
}
