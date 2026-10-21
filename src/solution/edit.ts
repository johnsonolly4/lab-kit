// Solution prep, typing an actual into the block: what a typed text becomes in the note, and which cell comes next. Pure (no Obsidian runtime).
// Plan: docs/plans/solution-live-block.md, Phase 4. The write itself is block.ts `writeActual` (one line only); the typed text and the next cell are the shared core.
export { NOT_A_MASS, actualText, nextCell };
import { NOT_A_MASS, actualText, nextCell } from "../blocks/core";
import type { ActualField, View } from "./view";

export interface Cell { field: ActualField; value: string }

/** The Actual cells in the order they are drawn. */
export function cellsOf(view: View): Cell[] {
  return view.steps.flatMap(s => s.rows.map(r => ({ field: r.field, value: r.actual })));
}
