// The open-work picture of a big project (planning kit, "M1"): only the unfinished to-dos, as name chips in steps with arrows; finished work is only counted.
// Pure (no DOM, no Obsidian runtime, no drawing): sizes, folding and pixels come later (docs/plans/plan-map-export.md, Phases M1-2 to M1-4).
import type { Plan, PlanRow } from "./plan";
import { layoutPlan } from "./plan-map";
import type { MapArrow } from "./plan-map";
import { statusOf } from "./plan-slide";

/** How an open chip stands: late wins over waiting, waiting over can start; "later" waits for an earlier step. */
export type OpenStatus = "late" | "waiting" | "ready" | "later";
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
