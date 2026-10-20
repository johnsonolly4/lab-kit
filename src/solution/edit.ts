// Solution prep, typing an actual into the block: what a typed text becomes in the note, and which cell comes next. Pure (no Obsidian runtime).
// Plan: docs/plans/solution-live-block.md, Phase 4. The write itself is block.ts `writeActual` (one line only).
import { massToGrams, parseQuantity } from "./block";
import type { ActualField, View } from "./view";

/** The red line under an Actual box that is not a mass (owner board 5, 2026-10-20). */
export const NOT_A_MASS = "Not a mass: use g or mg.";

/** The line value for what was typed: "1.30" in a mg row → "1.30 mg", "1.3mg" → "1.3 mg", a mass in another unit keeps its unit ("0.0013 g"),
 *  "" → "" (clears the actual). null when it is not a number with a mass unit. The number is kept as typed (the balance's decimals). */
export function actualText(typed: string, rowUnit: string): string | null {
  const s = typed.trim();
  if (!s) return "";
  const q = parseQuantity(s);
  if (!q || (q.unit !== "" && massToGrams(q) === null)) return null;
  const number = s.replace(/\s*(kg|mg|ug|µg|g|mL|L|%)\s*$/, "");
  return `${number} ${q.unit || rowUnit}`;
}

export interface Cell { field: ActualField; value: string }

/** The Actual cells in the order they are drawn. */
export function cellsOf(view: View): Cell[] {
  return view.steps.flatMap(s => s.rows.map(r => ({ field: r.field, value: r.actual })));
}

/** The cell to open after the one at `from`: Enter and Tab go to the next empty one (Tab to the next cell, empty or not), Shift+Tab to the one before.
 *  null when there is none (Enter on the last empty cell just saves). */
export function nextCell(cells: Cell[], from: number, how: "enter" | "tab" | "back"): number | null {
  if (how === "back") return from > 0 ? from - 1 : null;
  for (let i = from + 1; i < cells.length; i++) if (how === "tab" || !cells[i].value) return i;
  return null;
}
