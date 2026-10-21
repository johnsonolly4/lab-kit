// The open-work picture of a big project (planning kit, "M1"): only the unfinished to-dos, as name chips in steps with arrows; finished work is only counted.
// Pure (no DOM, no Obsidian runtime, no drawing): sizes, folding and pixels come later (docs/plans/plan-map-export.md, Phases M1-2 to M1-4).
import type { Plan, PlanRow } from "./plan";
import { layoutPlan } from "./plan-map";
import type { MapArrow } from "./plan-map";
import { CHAR_W, statusOf, wrap } from "./plan-slide";

/** How an open chip stands: late wins over waiting, waiting over can start; "later" waits for an earlier step. */
export type OpenStatus = "late" | "waiting" | "ready" | "later";
/** The picture is always 1920 × 1080 (owner, Q3 a). Across: margin, the step labels ("can start", "then +1"), places with gaps between (the prototype `gen-big.ts` m1). */
export const OPEN_W = 1920, OPEN_H = 1080;
const MARGIN = 48, LABEL_W = 150, PLACE_GAP = 24;
/** Every text on a chip, and every other text of the picture, is this size: never under `MIN_READABLE`. */
export const OPEN_FONT = 22;
/** Most places across (owner, Q2 a: a step with more chips keeps the 5 most urgent and a "+N more in this step" chip). */
export const CHIP_CAP = 6;
/** A chip line holds at least this many characters (6 places). */
export const MIN_CHARS = 17;
const LINE_H = 28, PAD_X = 20, PAD_Y = 10, SUB_GAP = 6, NAME_LINES = 2, SUB_LINES = 4;
/** The second line is cut to this many characters: about one line of a chip 259 px wide at 22 px (6 places; plan "Why the fold rule is needed"). */
export const SECOND_LINE_MAX = 17;

export interface OpenChip {
  path: string; name: string; status: OpenStatus;
  /** Step (top to bottom) and place (across), from 0; loose chips have -1 for both. */
  step: number; place: number;
  /** "experiment · Status", cut with "…"; only on late, waiting and can-start chips with an experiment, else "". */
  line: string;
  /** The subtasks, done ones included (they are drawn ticked and struck). */
  subs: PlanRow["subs"];
}
export interface OpenCounts {
  /** Open top-level to-dos; chips + loose. */
  open: number;
  /** Open to-dos drawn as a chip or in the loose row (until M1-2 folds some, the same as `open`). */
  drawn: number;
  late: number; waiting: number; canStart: number; later: number;
  /** Finished and all top-level to-dos ("35 of 59 done"). */
  done: number; total: number;
  /** Steps down, and places (columns) across: the highest place + 1. `layoutPlan` leaves gaps so a chip sits under its parents, so a step may hold fewer chips than there are places. */
  steps: number; places: number;
}
export interface OpenModel {
  /** Linked open to-dos, by step then place. */
  chips: OpenChip[];
  /** Between chips only (a link through a subtask is drawn to its parent, `via`). */
  arrows: MapArrow[];
  /** Open to-dos with no open links, most urgent first (late, waiting, can start, later), then by name. */
  loose: OpenChip[];
  counts: OpenCounts;
}

const RANK: Record<OpenStatus, number> = { late: 0, waiting: 1, ready: 2, later: 3 };
const cut = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, Math.max(1, n - 1)).trimEnd() + "…");

/** The open-work model of `plan`. Status comes from the whole plan (a finished blocker never makes a chip "later"); steps are laid out on the open to-dos only, so they count open work. */
export function openModel(plan: Plan, today?: string): OpenModel {
  const top = plan.rows.filter(r => !r.parent);
  const open = top.filter(r => !r.done);
  const openPaths = new Set(open.map(r => r.path));
  const statusOfRow = (r: PlanRow): OpenStatus => { const s = statusOf(r, today); return s === "blocked" || s === "done" ? "later" : s; };   // never "done": only open rows come here
  const chip = (r: PlanRow, step: number, place: number): OpenChip => {
    const status = statusOfRow(r);
    const e = r.experiment;
    const line = e && status !== "later" ? cut(e.status ? `${e.name} · ${e.status}` : e.name, SECOND_LINE_MAX) : "";
    return { path: r.path, name: r.name, status, step, place, line, subs: r.subs };
  };

  // Subtasks of open to-dos stay in, so a link through a subtask still joins two chips; finished to-dos and their subtasks are left out.
  const map = layoutPlan({ ...plan, rows: plan.rows.filter(r => (r.parent ? openPaths.has(r.parent) : !r.done)) });
  const chips = map.cards.map(c => chip(c.row, c.step, c.place));
  const loose = map.unlinked.map(r => chip(r, -1, -1)).sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));

  const all = [...chips, ...loose];
  const n = (s: OpenStatus): number => all.filter(c => c.status === s).length;
  return {
    chips, arrows: map.arrows, loose,
    counts: {
      open: open.length, drawn: all.length,
      late: n("late"), waiting: n("waiting"), canStart: n("ready"), later: n("later"),
      done: top.length - open.length, total: top.length,
      steps: chips.length ? Math.max(...chips.map(c => c.step)) + 1 : 0, places: chips.length ? Math.max(...chips.map(c => c.place)) + 1 : 0,
    },
  };
}

/** Chip width for `places` columns (capped at `CHIP_CAP`): 259 px at 6. */
export const chipWidth = (places: number): number => Math.floor((OPEN_W - 2 * MARGIN - LABEL_W - (Math.min(Math.max(1, places), CHIP_CAP) - 1) * PLACE_GAP) / Math.min(Math.max(1, places), CHIP_CAP));
export interface ChipSize {
  width: number; height: number;
  /** Characters a line holds; text is not measured (same average width as plan-slide). */
  chars: number; font: number;
  /** The name in up to 2 lines, the second line ("" when none), the subtask lines (at most 4; the 4th says "+N more" when there are more). */
  name: string[]; line: string; subs: { text: string; done: boolean; more: boolean }[];
}
/** The size and the text lines of one chip when the picture has `places` columns. */
export function chipSize(c: OpenChip, places: number): ChipSize {
  const width = chipWidth(places);
  const chars = Math.floor((width - 2 * PAD_X) / (OPEN_FONT * CHAR_W));
  const name = wrap(c.name, chars, NAME_LINES);
  const line = cut(c.line, chars);
  const shown = c.subs.length > SUB_LINES ? c.subs.slice(0, SUB_LINES - 1) : c.subs;
  const subs = shown.map(s => ({ text: cut((s.done ? "✓ " : "○ ") + s.name, chars), done: s.done, more: false }));
  if (c.subs.length > shown.length) subs.push({ text: `+${c.subs.length - shown.length} more`, done: false, more: true });
  const height = 2 * PAD_Y + (name.length + (line ? 1 : 0)) * LINE_H + (subs.length ? SUB_GAP + subs.length * LINE_H : 0);
  return { width, height, chars, font: OPEN_FONT, name, line, subs };
}
/** Height of each step row (index = step): as tall as its tallest chip. */
export function rowHeights(chips: OpenChip[], places: number): number[] {
  const out: number[] = [];
  for (const c of chips) out[c.step] = Math.max(out[c.step] ?? 0, chipSize(c, places).height);
  return Array.from(out, h => h ?? 0);
}
