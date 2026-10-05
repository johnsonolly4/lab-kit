// Which cells a formula points at, for the live highlight while a formula is typed.
import { rewriteRefs } from "./rewrite";

/** A block of cells (0-based, both ends included). `qual` is the lower-case name of another table, or null for the table being edited. */
export interface RefBox { qual: string | null; r1: number; c1: number; r2: number; c2: number }

/** The cells a formula (possibly half typed) refers to: A1 / $A$1 / A1:B3 / sol1!B2 / 'my table'!A1:B3, and CalcCraft's relative (-1c-0r) from the cell `at`. */
export function formulaRefs(formula: string, at?: { r: number; c: number }): RefBox[] {
  const out: RefBox[] = [];
  rewriteRefs(formula, (ref) => {
    const b = ref.b ?? ref.a;
    out.push({ qual: ref.qual, r1: Math.min(ref.a.row, b.row), c1: Math.min(ref.a.col, b.col), r2: Math.max(ref.a.row, b.row), c2: Math.max(ref.a.col, b.col) });
    return null;
  });
  if (at) {
    const text = formula.replace(/"(?:[^"]|"")*"/g, '""');         // not what is inside a string
    for (const m of text.matchAll(/\(\s*([+-]?\d+)\s*c\s*([+-]?\d+)\s*r\s*\)/gi)) {
      const r = at.r + parseInt(m[2], 10), c = at.c + parseInt(m[1], 10);
      if (r >= 0 && c >= 0) out.push({ qual: null, r1: r, c1: c, r2: r, c2: c });
    }
  }
  return out;
}
