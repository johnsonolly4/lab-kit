// Structural edits to a note's calc blocks: reference rewriting, row insert/delete, cell write-back.
// Ported from legacy/main.js with no behaviour change.
import { cleanLink, colToIndex, extractBlocks, indexToCol, isSeparator, joinRow, normName, parseBlock, splitRow, type ParsedBlock } from "./engine";

interface RefEnd { colAbs: boolean; col: number; rowAbs: boolean; row: number }
interface Ref { qualText: string | null; qual: string | null; a: RefEnd; b: RefEnd | null }

/* ---- Rewriting references inside formula text (row insert/delete, fill-down) ---- */
const REF_AT = /^(?:('(?:[^']+)'|[A-Za-z_][\w.-]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!])(?::(?:('(?:[^']+)'|[A-Za-z_][\w.-]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!]))?/;
/** Calls fn({qual, a:{colAbs,col,rowAbs,row}, b?}) for each ref/range; fn returns new text or null to keep. */
export function rewriteRefs(formula: string, fn: (ref: Ref) => string | null): string {
  let out = "", i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '"') {                                   // copy string literals untouched
      let j = i + 1;
      while (j < formula.length) { if (formula[j] === '"') { if (formula[j + 1] === '"') { j += 2; continue; } break; } j++; }
      out += formula.slice(i, j + 1); i = j + 1; continue;
    }
    const prev = i > 0 ? formula[i - 1] : "";
    if (!/[\w.$]/.test(prev)) {
      const m = formula.slice(i).match(REF_AT);
      if (m) {
        const qual = m[1] ? m[1].replace(/^'|'$/g, "") : null;
        const ref: Ref = {
          qualText: m[1] ?? null, qual: qual ? normName(qual) : null,
          a: { colAbs: m[2] === "$", col: colToIndex(m[3]), rowAbs: m[4] === "$", row: parseInt(m[5], 10) - 1 },
          b: m[8] ? { colAbs: m[7] === "$", col: colToIndex(m[8]), rowAbs: m[9] === "$", row: parseInt(m[10], 10) - 1 } : null
        };
        const rep = fn(ref);
        out += rep == null ? m[0] : rep;
        i += m[0].length; continue;
      }
    }
    out += ch; i++;
  }
  return out;
}
const fmtEnd = (e: RefEnd): string => (e.colAbs ? "$" : "") + indexToCol(e.col) + (e.rowAbs ? "$" : "") + (e.row + 1);
const fmtRef = (ref: Ref): string => (ref.qualText ? ref.qualText + "!" : "") + fmtEnd(ref.a) + (ref.b ? ":" + fmtEnd(ref.b) : "");

/** Shift refs that point at `target` block when a row is inserted at index `at`. */
export function shiftForInsert(formula: string, appliesTo: (ref: Ref) => boolean, at: number): string {
  return rewriteRefs(formula, (ref) => {
    if (!appliesTo(ref)) return null;
    const a = { ...ref.a }, b = ref.b ? { ...ref.b } : null;
    if (!b) { if (a.row >= at) a.row++; return fmtRef({ ...ref, a }); }
    const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row);
    const loEnd = a.row <= b.row ? a : b, hiEnd = a.row <= b.row ? b : a;
    if (lo >= at) loEnd.row++;
    if (hi >= at || hi === at - 1) hiEnd.row++;          // also grow ranges that end just above the new row
    return fmtRef({ ...ref, a, b });
  });
}
/** Shift refs that point at `target` block when row `del` is deleted. */
export function shiftForDelete(formula: string, appliesTo: (ref: Ref) => boolean, del: number): string {
  return rewriteRefs(formula, (ref) => {
    if (!appliesTo(ref)) return null;
    const a = { ...ref.a }, b = ref.b ? { ...ref.b } : null;
    if (!b) { if (a.row === del) return "#REF!"; if (a.row > del) a.row--; return fmtRef({ ...ref, a }); }
    const loEnd = a.row <= b.row ? a : b, hiEnd = a.row <= b.row ? b : a;
    if (loEnd.row === del && hiEnd.row === del) return "#REF!";
    if (loEnd.row > del) loEnd.row--;
    if (hiEnd.row >= del) hiEnd.row--;
    return fmtRef({ ...ref, a, b });
  });
}
/** Fill-down: move every relative row reference by `d`. */
export function shiftRelative(formula: string, d: number): string {
  return rewriteRefs(formula, (ref) => {
    const a = { ...ref.a }, b = ref.b ? { ...ref.b } : null;
    if (!a.rowAbs) a.row += d;
    if (b && !b.rowAbs) b.row += d;
    return fmtRef({ ...ref, a, b });
  });
}

/* ---- Structural edits on the whole note text ---- */
/** Insert (kind "insert", at = new row index) or delete (kind "delete", at = row index) in the block starting at lineStart. */
export function editRows(text: string, lineStart: number, kind: "insert" | "delete", at: number): string | null {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const blocks = extractBlocks(text);
  const self = blocks.find(b => b.lineStart === lineStart);
  if (!self) return null;
  const selfParsed = parseBlock(self.source);
  const selfName = selfParsed.name;
  const nRows = selfParsed.cells.length;
  if (kind === "insert") at = Math.max(1, Math.min(at, nRows));
  if (kind === "delete" && (at < 1 || at >= nRows)) return null;

  // 1. Rewrite references in every block
  for (const b of blocks) {
    const isSelf = b === self;
    const applies = (ref: Ref): boolean => ref.qual ? (!!selfName && ref.qual === selfName) : isSelf;
    for (let li = b.lineStart + 1; li < b.lineEnd; li++) {
      const raw = lines[li];
      const body = raw.startsWith(b.prefix) ? raw.slice(b.prefix.length) : raw;
      if (!body.trim().startsWith("|") || isSeparator(body.trim())) continue;
      const cells = splitRow(body);
      let changed = false;
      cells.forEach((cv, k) => {
        if (!cv.startsWith("=")) return;
        const nv = kind === "insert" ? shiftForInsert(cv, applies, at) : shiftForDelete(cv, applies, at);
        if (nv !== cv) { cells[k] = nv; changed = true; }
      });
      if (changed) lines[li] = b.prefix + joinRow(cells);
    }
  }
  // 2. Add or remove the row line
  const absLine = (row: number): number => self.lineStart + 1 + selfParsed.rowLines[row];
  if (kind === "delete") { lines.splice(absLine(at), 1); return lines.join(eol); }

  const fresh = parseBlock(extractBlocks(lines.join("\n")).find(b => b.lineStart === lineStart)!.source);
  const tplRow = at - 1 >= 1 ? fresh.cells[at - 1] : null;
  const width = Math.max(...fresh.cells.map(r => r.length));
  const newCells = Array.from({ length: width }, (_, k) => {
    const t = tplRow?.[k];
    return t && t.kind === "formula" ? shiftRelative(t.raw, 1) : "";
  });
  const insertAt = at < nRows ? absLine(at) : absLine(nRows - 1) + 1;
  lines.splice(insertAt, 0, self.prefix + joinRow(newCells));
  return lines.join(eol);
}
/** Where "+ Row" adds a row: before the first Total / (rest) row, else at the end. */
export function autoInsertIndex(parsed: ParsedBlock): number {
  const i = parsed.cells.findIndex((row, k) => k > 0 && /total|\(rest\)/i.test(cleanLink(row[0]?.raw ?? "")));
  return i > 0 ? i : parsed.cells.length;
}

/** Replace one cell's text inside the calc block starting at lineStart. */
export function writeCellText(data: string, lineStart: number, r: number, c: number, val: string): string {
  const eol = data.includes("\r\n") ? "\r\n" : "\n";
  const lines = data.split(/\r?\n/);
  const blk = extractBlocks(data).find(b => b.lineStart === lineStart);
  if (!blk) return data;
  const parsed = parseBlock(blk.source);
  const target = blk.lineStart + 1 + parsed.rowLines[r];
  const line = lines[target];
  if (line == null) return data;
  const cells = splitRow(line.slice(blk.prefix.length));
  while (cells.length <= c) cells.push("");
  cells[c] = val;
  lines[target] = blk.prefix + joinRow(cells);
  return lines.join(eol);
}
