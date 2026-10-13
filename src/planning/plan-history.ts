// The plan map's Undo / Redo (planning kit): the last changes made on the map (link, unlink, make a subtask, clear a subtask), kept in memory.
// Pure (no Obsidian runtime). Used by src/planning/plan-map-render.ts (records, runs) and src/planning/blocks.ts (the buttons).

export const HISTORY_LIMIT = 20;

/** One change to one property of one to-do: `before` and `after` are the values as written (undefined = the property was absent). */
export interface HistoryStep { path: string; key: "after" | "sub" | "project"; before: unknown; after: unknown; label: string }

export type Side = "undo" | "redo";

/** Are two property values the same as written? Absent, empty and an empty list count as the same; lists compare in order. */
export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) ? null : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** The undo and redo stacks of one note's plan map: at most `limit` steps back; a new change drops the redo steps. */
export class PlanHistory {
  private stacks: Record<Side, HistoryStep[]> = { undo: [], redo: [] };
  constructor(readonly limit = HISTORY_LIMIT) {}

  /** A new change was made. */
  push(step: HistoryStep): void {
    this.put("undo", step);
    this.stacks.redo = [];
  }
  /** A step goes on a stack without touching the other one (after it was undone or redone). The oldest step falls off the end. */
  put(side: Side, step: HistoryStep): void {
    this.stacks[side].push(step);
    if (this.stacks[side].length > this.limit) this.stacks[side].shift();
  }
  /** The step an Undo (or Redo) would run: the latest on that side. */
  peek(side: Side): HistoryStep | undefined { return this.stacks[side][this.stacks[side].length - 1]; }
  has(side: Side, step: HistoryStep): boolean { return this.stacks[side].includes(step); }
  remove(side: Side, step: HistoryStep): void { this.stacks[side] = this.stacks[side].filter(s => s !== step); }
  size(side: Side): number { return this.stacks[side].length; }
}
