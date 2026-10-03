// Three-way line merge for kit files: base = what the kit installed, ours = your file, theirs = the new kit version.
// Pure (no Obsidian). Conflicts are only counted or offered as hunks: conflict markers are never written into a live file.
import { diff3Merge } from "node-diff3";

export interface MergeResult {
  /** True when every edit could be combined (no overlapping changes). */
  clean: boolean;
  /** The merged file text; empty when `clean` is false. */
  text: string;
  /** How many places both sides changed differently. */
  conflicts: number;
}

/** A stretch of the file: the same on both sides / combined cleanly (`ok`), or changed differently by you and the kit (`conflict`). */
export type Region = { ok: string[] } | { conflict: { ours: string[]; base: string[]; theirs: string[] } };
/** What to do with one conflict: your lines, the kit's lines, both (yours first), or text typed in the window. */
export type HunkChoice = "mine" | "kit" | "both" | { edit: string };

/** Same normalising as the hash in managed.ts (BOM off, "\n" line ends), split into lines. */
const lines = (text: string): string[] => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n/g, "\n").split("\n");
const join = (parts: string[], ours: string): string => {
  const text = parts.join("\n");
  return ours.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text;
};

const lineRegions = (base: string[], ours: string[], theirs: string[]): Region[] =>
  diff3Merge(ours, base, theirs, { excludeFalseConflicts: true })
    .map((r): Region => r.conflict ? { conflict: { ours: r.conflict.a, base: r.conflict.o, theirs: r.conflict.b } } : { ok: r.ok ?? [] });

/* ---- Frontmatter: merged key by key, on the text itself (no YAML parser, so your formatting and comments survive) ---- */
interface Frontmatter { head: string[]; keys: string[]; blocks: Map<string, string[]>; body: string[] }
const KEY_LINE = /^[A-Za-z0-9_][^:]*:(?:\s|$)/;
/** A line that belongs to the key above it: blank, indented, a comment or an unindented list item. */
const CONTINUES = (line: string): boolean => line.trim() === "" || /^\s/.test(line) || line.startsWith("#") || line.startsWith("- ") || line === "-";

/** Splits `---` frontmatter into one block of lines per top-level key. It starts the file, or follows a Templater script block (the kit's templates do).
 *  Null when it isn't plain key blocks (then the file is merged line by line). */
function splitFrontmatter(all: string[]): Frontmatter | null {
  const start = all.indexOf("---");
  if (start < 0 || (start > 0 && all[start - 1] !== "-%>")) return null;
  const end = all.indexOf("---", start + 1);
  if (end < 0) return null;
  const keys: string[] = [];
  const blocks = new Map<string, string[]>();
  let cur: string[] | null = null;
  for (const line of all.slice(start + 1, end)) {
    if (KEY_LINE.test(line)) {
      const key = line.slice(0, line.indexOf(":"));
      if (blocks.has(key)) return null;
      cur = [line]; keys.push(key); blocks.set(key, cur);
    } else if (cur && CONTINUES(line)) cur.push(line);
    else return null;
  }
  return { head: all.slice(0, start), keys, blocks, body: all.slice(end + 1) };
}

const same = (a: string[] | undefined, b: string[] | undefined): boolean => !!a && !!b && a.join("\n") === b.join("\n");

/** One region per key, in your key order; a key only the kit added goes after the kit key that precedes it. */
function mergeKeys(base: Frontmatter, ours: Frontmatter, theirs: Frontmatter): Region[] {
  const order = [...ours.keys];
  theirs.keys.forEach((k, i) => {
    if (ours.blocks.has(k)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const p = order.indexOf(theirs.keys[j]); if (p >= 0) { at = p + 1; break; } }
    order.splice(at, 0, k);
  });
  const out: Region[] = [];
  const conflict = (o?: string[], b?: string[], t?: string[]): Region => ({ conflict: { ours: o ?? [], base: b ?? [], theirs: t ?? [] } });
  for (const k of order) {
    const o = ours.blocks.get(k), b = base.blocks.get(k), t = theirs.blocks.get(k);
    if (o && t) {
      if (same(o, t) || same(t, b)) out.push({ ok: o });
      else if (same(o, b)) out.push({ ok: t });
      else out.push(conflict(o, b, t));
    } else if (o) {   // the kit no longer has this key
      if (!b) out.push({ ok: o });
      else if (!same(o, b)) out.push(conflict(o, b));
    } else if (t) {   // you don't have it
      if (!b) out.push({ ok: t });
      else if (!same(t, b)) out.push(conflict(undefined, b, t));
    }
  }
  return out;
}

export function mergeRegions(base: string, ours: string, theirs: string): Region[] {
  const [b, o, t] = [lines(base), lines(ours), lines(theirs)];
  const fm = [splitFrontmatter(b), splitFrontmatter(o), splitFrontmatter(t)];
  if (!fm[0] || !fm[1] || !fm[2]) return lineRegions(b, o, t);
  const regions: Region[] = [...lineRegions(fm[0].head, fm[1].head, fm[2].head), { ok: ["---"] }, ...mergeKeys(fm[0], fm[1], fm[2]), { ok: ["---"] }, ...lineRegions(fm[0].body, fm[1].body, fm[2].body)];
  return regions.reduce<Region[]>((acc, r) => {   // join neighbouring plain stretches
    const last = acc[acc.length - 1];
    if (last && "ok" in last && "ok" in r) acc[acc.length - 1] = { ok: [...last.ok, ...r.ok] };
    else acc.push(r);
    return acc;
  }, []);
}

export function merge3(base: string, ours: string, theirs: string): MergeResult {
  const regions = mergeRegions(base, ours, theirs);
  const conflicts = regions.filter(r => "conflict" in r).length;
  if (conflicts) return { clean: false, text: "", conflicts };
  return { clean: true, text: join(regions.flatMap(r => "ok" in r ? r.ok : []), ours), conflicts: 0 };
}

/** The lines a choice puts in the file. */
export function hunkLines(h: { ours: string[]; theirs: string[] }, choice: HunkChoice): string[] {
  if (choice === "mine") return h.ours;
  if (choice === "kit") return h.theirs;
  if (choice === "both") return [...h.ours, ...h.theirs];
  return choice.edit === "" ? [] : choice.edit.replace(/\r\n/g, "\n").split("\n");
}

/** The file with every conflict resolved. `choices` is one entry per conflict, in order; returns null while any is undecided (null / missing). */
export function resolveRegions(regions: Region[], choices: (HunkChoice | null | undefined)[], ours: string): string | null {
  const out: string[] = [];
  let n = 0;
  for (const r of regions) {
    if ("ok" in r) { out.push(...r.ok); continue; }
    const c = choices[n++];
    if (c === null || c === undefined) return null;
    out.push(...hunkLines(r.conflict, c));
  }
  return join(out, ours);
}
