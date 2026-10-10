// Which cells a formula points at, for the live highlight while a formula is typed.
import { rewriteRefs } from "./rewrite";

/** A block of cells (0-based, both ends included). `qual` is the lower-case name of another table, or null for the table being edited. */
export interface RefBox { qual: string | null; r1: number; c1: number; r2: number; c2: number }

/** How many highlight colours there are; the same reference twice keeps one colour. */
export const REF_COLOURS = 6;
/** A reference found in formula text: where it is (0-based, end excluded), its colour 0..REF_COLOURS-1 and the cells it covers. */
export interface ColouredRef { start: number; end: number; colour: number; box: RefBox }

/**
 * The references of a formula (possibly half typed), in the order they appear, each with its place in the text and a colour
 * (colours go round in order of first appearance; the same reference text twice shares one): A1 / $A$1 / A1:B3 / sol1!B2 / 'my table'!A1:B3,
 * and CalcCraft's relative (-1c-0r) from the cell `at`.
 */
export function colouredRefs(formula: string, at?: { r: number; c: number }): ColouredRef[] {
  const found: { start: number; end: number; key: string; box: RefBox }[] = [];
  rewriteRefs(formula, (ref, start, len) => {
    const b = ref.b ?? ref.a;
    found.push({ start, end: start + len, key: formula.slice(start, start + len).replace(/\$/g, "").toLowerCase(),
      box: { qual: ref.qual, r1: Math.min(ref.a.row, b.row), c1: Math.min(ref.a.col, b.col), r2: Math.max(ref.a.row, b.row), c2: Math.max(ref.a.col, b.col) } });
    return null;
  });
  if (at) {
    const text = formula.replace(/"(?:[^"]|"")*"/g, m => " ".repeat(m.length));         // not what is inside a string (same length: keeps the positions)
    for (const m of text.matchAll(/\(\s*([+-]?\d+)\s*c\s*([+-]?\d+)\s*r\s*\)/gi)) {
      const r = at.r + parseInt(m[2], 10), c = at.c + parseInt(m[1], 10);
      if (r >= 0 && c >= 0) found.push({ start: m.index, end: m.index + m[0].length, key: m[0].replace(/\s+/g, "").toLowerCase(), box: { qual: null, r1: r, c1: c, r2: r, c2: c } });
    }
  }
  const colourOf = new Map<string, number>();
  const out: ColouredRef[] = [];
  for (const f of [...found].sort((a, b) => a.start - b.start)) {
    if (!colourOf.has(f.key)) colourOf.set(f.key, colourOf.size % REF_COLOURS);
    out.push({ start: f.start, end: f.end, colour: colourOf.get(f.key)!, box: f.box });
  }
  return out;
}

/** The cells a formula (possibly half typed) refers to, as `colouredRefs` finds them, in the order A1 refs then relative ones. */
export function formulaRefs(formula: string, at?: { r: number; c: number }): RefBox[] {
  return colouredRefs(formula, at).map(r => r.box);
}
