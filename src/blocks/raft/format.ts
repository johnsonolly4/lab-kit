// RAFT block, numbers as they are written: masses, mmol, MW, Mn. Pure. The rules are read off the approved look (live-block-looks.html, R-A):
// 2.5000 g, 0.3125 g, 11.259 g (five figures, at most four decimals, zeros kept: a balance reading), 2.27 mg (under 0.1 g, two decimals),
// 14.773 mmol, 0.1407 mmol, 0.00703 mmol (3, 4, 5 decimals by size), Mn 19 990.14 g/mol.

/** `1.50000` → `1.5`, `2.00` → `2`. */
export const trimZeros = (s: string): string => s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;

/** A target mass: `2.5000 g`, `0.3125 g`, `2.27 mg`. */
export function fmtMass(g: number): string {
  if (g < 0.1) return `${(g * 1000).toFixed(2)} mg`;
  const five = g.toPrecision(5);
  const decimals = five.includes(".") ? Math.min(4, five.length - five.indexOf(".") - 1) : 0;
  return `${g.toFixed(decimals)} g`;
}

/** Moles as mmol, decimals by size (the look's numbers): 3 from 10 mmol, 4 from 0.1 mmol, else 5: `14.773 mmol`, `0.1407 mmol`, `0.00703 mmol`. */
export function fmtMmol(mol: number): string {
  const mmol = mol * 1000;
  return `${mmol.toFixed(mmol >= 10 ? 3 : mmol >= 0.1 ? 4 : 5)} mmol`;
}

/** A molecular weight as written in the working: `169.23`, `158.2267`. */
export const fmtMw = (mw: number): string => trimZeros(mw.toFixed(4));

/** Thin no-break space between thousands, as the look does: `19 990.14`. Used in the drawn block, not in the note's # lines. */
export function groupThousands(s: string): string {
  const [int, dec] = s.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (dec === undefined ? "" : "." + dec);
}

/** Mn as the block shows it: `19 990.14 g/mol` (two decimals) or, from what is weighed, `19 963 g/mol`. */
export const fmtMn = (mn: number, decimals: number): string => `${groupThousands(mn.toFixed(decimals))} g/mol`;
