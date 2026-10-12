// Source-mode twin of the live highlight: while the cursor is in a formula cell of a calc table's text, the cells it points at are shaded and
// the references in the formula are coloured, one colour per reference (as in the rendered table's cell editor). Pure: works on the note's text.
import { isSeparator, normName } from "./engine";
import { colouredRefs } from "./refs";

/** A range of the note's text to mark: `ref` = a reference inside the formula, `cell` = a cell the formula points at. */
export interface TextHit { from: number; to: number; colour: number; kind: "ref" | "cell" }

interface Cell { from: number; to: number }
interface Block { name: string; rows: Cell[][]; lineFrom: number; lineTo: number }

/** The cells of a table line as ranges in the note (a leading and a trailing pipe are not cells; `\|` and pipes inside [[links]] do not split). */
function cellsOf(text: string, base: number): Cell[] {
  let start = 0, end = text.length;
  const lead = text.search(/\S/);
  if (lead < 0 || text[lead] !== "|") return [];
  start = lead + 1;
  const trimmed = text.replace(/\s+$/, "");
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) end = trimmed.length - 1;
  const out: Cell[] = [];
  let from = start, depth = 0;
  for (let i = start; i < end; i++) {
    const c = text[i];
    if (c === "\\" && text[i + 1] === "|") { i++; continue; }
    if (c === "[" && text[i + 1] === "[") { depth++; i++; continue; }
    if (c === "]" && text[i + 1] === "]") { depth = Math.max(0, depth - 1); i++; continue; }
    if (c === "|" && depth === 0) { out.push({ from: base + from, to: base + i }); from = i + 1; }
  }
  out.push({ from: base + from, to: base + end });
  return out;
}

/** Every calc block of the note: its name and its table rows (separator rows left out) as cell ranges. */
function blocks(doc: string): Block[] {
  const lines = doc.split("\n");
  const offs: number[] = []; let o = 0;
  for (const l of lines) { offs.push(o); o += l.length + 1; }
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*(?:>\s*)*)(`{3,}|~{3,})\s*calc\s*$/.exec(lines[i].replace(/\r$/, ""));
    if (!m) continue;
    const prefix = m[1].length, fence = m[2];
    const blk: Block = { name: "", rows: [], lineFrom: offs[i], lineTo: doc.length };
    let j = i + 1;
    for (; j < lines.length; j++) {
      const raw = lines[j].replace(/\r$/, "");
      const body = raw.startsWith(m[1]) ? raw.slice(prefix) : raw, t = body.trim();
      if (t.length >= fence.length && t === fence[0].repeat(t.length)) { blk.lineTo = offs[j] + raw.length; break; }
      if (t.startsWith("|")) { if (!isSeparator(t)) blk.rows.push(cellsOf(body, offs[j] + (raw.startsWith(m[1]) ? prefix : 0))); continue; }
      const nm = /^name\s*:\s*(.*)$/i.exec(t);
      if (nm) blk.name = normName(nm[1]);
    }
    out.push(blk);
    i = j;
  }
  return out;
}

/** The marks for the formula cell the cursor `pos` is in; none when it is not in a formula cell of a calc table. */
export function textRefHits(doc: string, pos: number): TextHit[] {
  const all = blocks(doc);
  const here = all.find(b => pos >= b.lineFrom && pos <= b.lineTo);
  if (!here) return [];
  for (let r = 0; r < here.rows.length; r++) {
    for (let c = 0; c < here.rows[r].length; c++) {
      const cell = here.rows[r][c];
      if (pos < cell.from || pos > cell.to) continue;
      const text = doc.slice(cell.from, cell.to);
      if (!text.trimStart().startsWith("=")) return [];
      const hits: TextHit[] = [];
      for (const ref of colouredRefs(text, { r, c })) {
        hits.push({ from: cell.from + ref.start, to: cell.from + ref.end, colour: ref.colour, kind: "ref" });
        const target: Block | undefined = ref.box.qual === null ? here : all.find(b => b !== here && b.name === ref.box.qual);
        if (!target) continue;
        for (let rr = ref.box.r1; rr <= Math.min(ref.box.r2, ref.box.r1 + 200); rr++) for (let cc = ref.box.c1; cc <= Math.min(ref.box.c2, ref.box.c1 + 50); cc++) {
          const t = target.rows[rr]?.[cc];
          if (!t || (target === here && rr === r && cc === c)) continue;
          const s = doc.slice(t.from, t.to), lead = s.length - s.trimStart().length;
          const from = t.from + lead, to = t.to - (s.length - s.trimEnd().length);
          if (to > from) hits.push({ from, to, colour: ref.colour, kind: "cell" });
        }
      }
      return hits.sort((a, b) => a.from - b.from || a.to - b.to);
    }
  }
  return [];
}
