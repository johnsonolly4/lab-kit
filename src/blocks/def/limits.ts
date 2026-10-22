// The hard limits of a block definition (CQ6 a, docs/plans/custom-live-blocks.md §5): one place for every number. They may be raised later, never lowered.
// Pure (no Obsidian runtime). The formula limits live with the formula check (./formula.ts) and are re-exported here.
import { LIMITS as FORMULA_LIMITS } from "./formula";

export const LIMITS = {
  ...FORMULA_LIMITS,
  /** Rows of one definition. */
  rows: 50,
  /** Items of a list answer that one `each:` row repeats over (checked when the block is drawn). */
  items: 30,
  /** Bytes of one ```lk-definition block (UTF-8). */
  bytes: 32 * 1024,
  /** Definitions in the vault. */
  definitions: 100,
} as const;

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

/** The definition block's text is too big, or null. */
export function sizeProblem(source: string): string | null {
  const n = utf8Bytes(source);
  return n > LIMITS.bytes ? `A definition may be ${LIMITS.bytes / 1024} KB at most; this one is ${(n / 1024).toFixed(1)} KB. Split it into two snippets.` : null;
}

/** Too many rows in one definition, or null. */
export function rowsProblem(n: number): string | null {
  return n > LIMITS.rows ? `A definition may have ${LIMITS.rows} rows at most; this one has ${n}.` : null;
}

/** Too many items in the list answer an `each:` row repeats over, or null (used when the block is drawn). */
export function itemsProblem(list: string, n: number): string | null {
  return n > LIMITS.items ? `"${list}" may hold ${LIMITS.items} items at most; it holds ${n}.` : null;
}

/** Too many definitions in the vault, or null (used by the registry). */
export function definitionsProblem(n: number): string | null {
  return n > LIMITS.definitions ? `The vault may hold ${LIMITS.definitions} block definitions at most; it holds ${n}.` : null;
}
