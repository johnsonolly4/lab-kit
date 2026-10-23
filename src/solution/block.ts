// Solution prep, the ```solution block text: read it, change one line of it. Pure (no Obsidian runtime), no user-facing text.
// The format and the one-line writer are the shared live-block core (src/blocks/core.ts); this file keeps the solution names for them.
// Format (plan docs/plans/solution-live-block.md): `key: value` lines, a `step N:` line opens a section of two-space nested lines.
import { FORMAT_VERSION, balanceDecimals, blockRange, formatQuantity, gramsToUnit, massToGrams, parseBlock, parseQuantity, setLine, writeInNote, type Block, type Quantity, type Section } from "../blocks/core";

export { FORMAT_VERSION, balanceDecimals, blockRange, formatQuantity, gramsToUnit, massToGrams, parseQuantity, setLine, type Quantity, type Section };
export type Solution = Block;

/** Read the block text (the lines between the fences). Never throws. */
export const parseSolution = parseBlock;

/** One actual of a step, e.g. `writeActual(note, 12, "step 1", "acid", "1.30 mg")`. */
export function writeActual(note: string, lineStart: number, step: string, key: string, value: string): string | null {
  return writeInNote(note, lineStart, step, key, value);
}

/** One set-up line, e.g. `writeSetup(note, 12, "target-pH", "4.50")`. */
export function writeSetup(note: string, lineStart: number, key: string, value: string): string | null {
  return writeInNote(note, lineStart, null, key, value);
}
