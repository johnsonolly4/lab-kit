// The open-work picture of a big project (planning kit, "M1"): only the unfinished to-dos, as name chips in steps with arrows; finished work is only counted.
// Pure (no DOM, no Obsidian runtime, no drawing): sizes, folding and pixels come later (docs/plans/plan-map-export.md, Phases M1-2 to M1-4).
import type { Plan, PlanRow } from "./plan";
import { layoutPlan } from "./plan-map";
import type { MapArrow, PlanMap } from "./plan-map";
import { CHAR_W, DEFAULT_AHEAD, slideModel, slideSvg, statusOf, wrap } from "./plan-slide";

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

// Fold (owner, Q1 a and Q2 a): what is drawn when the open work does not fit the 1920 × 1080 picture. Room above and below the steps is the prototype's.
const TOP = 130, KEY_ROOM = 70, LOOSE_H = 110, STEP_GAP = 36, LOOSE_MAX_W = 320, LOOSE_GAP = 14, COUNT_W = 440;
/** Height of the count row under the drawn steps and of a "+N more" chip: one line. */
export const COUNT_H = 2 * PAD_Y + LINE_H;
/** Ids of the stand-ins arrows may end at: a step's "+N more in this step" chip, and the count row of the folded steps. */
export const moreId = (step: number): string => `+more:${step}`;
export const FOLD_ID = "+fold";

export interface FoldCount { n: number; late: number; waiting: number; text: string }
export interface FoldStep {
  step: number;
  /** The chips drawn, places re-numbered from 0 when the picture has more than `CHIP_CAP` places. */
  chips: OpenChip[];
  /** The "+N more in this step" chip, in place 5 (null when every chip of the step is drawn). */
  more: FoldCount | null;
  height: number;
}
export interface FoldedOpen {
  /** Columns drawn (at most `CHIP_CAP`) and the chip width for them. */
  places: number; width: number;
  steps: FoldStep[];
  /** The count row "+N more steps: k late, w waiting"; `chips` is how many open to-dos it stands for. */
  fold: (FoldCount & { chips: number }) | null;
  /** Between drawn chips, a step's more chip (`moreId`) and the count row (`FOLD_ID`); at most one arrow per pair. */
  arrows: MapArrow[];
  /** The loose row: chips that fit on one line (with their widths), then the count chip. */
  loose: { chips: OpenChip[]; widths: number[]; more: FoldCount | null };
  /** Height the drawn steps, their gaps and the count row take. */
  height: number;
  /** drawn + inStep + folded + looseMore = open. */
  counts: { open: number; drawn: number; inStep: number; folded: number; looseMore: number };
}

/** Room for the steps: the picture less the header, the key and (when there are loose to-dos) the loose row. */
export const openBudget = (model: OpenModel): number => OPEN_H - TOP - KEY_ROOM - (model.loose.length ? LOOSE_H : 0);

/** How many, how many late and waiting, and the text: `head(n)` then ": 3 late, 1 waiting" (`paren`: " (3 late, 1 waiting)"); counts of 0 are left out. */
const countOf = (chips: OpenChip[], head: (n: number) => string, paren = false): FoldCount => {
  const n = chips.length, late = chips.filter(c => c.status === "late").length, waiting = chips.filter(c => c.status === "waiting").length;
  const marks = [late ? `${late} late` : "", waiting ? `${waiting} waiting` : ""].filter(Boolean).join(", ");
  return { n, late, waiting, text: head(n) + (marks ? (paren ? ` (${marks})` : `: ${marks}`) : "") };
};

/** What of `model` is drawn within `budget` px of steps: steps from the top while they fit (the first always), the rest one count row; at most 6 places a step; the loose row on one line. */
export function foldOpen(model: OpenModel, budget = openBudget(model)): FoldedOpen {
  const places = Math.min(model.counts.places, CHIP_CAP), width = chipWidth(places);
  const repack = model.counts.places > CHIP_CAP;
  const where = new Map<string, string>();   // path → the id its arrows go to
  const all: FoldStep[] = [];
  for (let k = 0; k < model.counts.steps; k++) {
    const mine = model.chips.filter(c => c.step === k).sort((a, b) => a.place - b.place);
    let keep = mine, hidden: OpenChip[] = [];
    if (mine.length > CHIP_CAP) {
      const urgent = new Set([...mine].sort((a, b) => RANK[a.status] - RANK[b.status] || a.place - b.place).slice(0, CHIP_CAP - 1));
      keep = mine.filter(c => urgent.has(c)); hidden = mine.filter(c => !urgent.has(c));
    }
    const chips = repack ? keep.map((c, i) => ({ ...c, place: i })) : keep;
    for (const c of chips) where.set(c.path, c.path);
    for (const c of hidden) where.set(c.path, moreId(k));
    const more = hidden.length ? { ...countOf(hidden, () => ""), text: `+${hidden.length} more in this step` } : null;
    all.push({ step: k, chips, more, height: Math.max(0, ...chips.map(c => chipSize(c, places).height), more ? COUNT_H : 0) });
  }

  const used = (n: number): number => all.slice(0, n).reduce((h, s) => h + s.height, 0) + Math.max(0, n - 1) * STEP_GAP;
  let shown = all.length;
  if (used(shown) > budget) { shown = all.length - 1; while (shown > 1 && used(shown) + STEP_GAP + COUNT_H > budget) shown--; }
  const steps = all.slice(0, shown);
  const foldedChips = model.chips.filter(c => c.step >= shown);
  for (const c of foldedChips) where.set(c.path, FOLD_ID);
  const k = all.length - shown;
  const fold = k > 0 ? { ...countOf(foldedChips, () => `+${k} more ${k === 1 ? "step" : "steps"}`), chips: foldedChips.length } : null;

  const arrows: MapArrow[] = [], seen = new Set<string>();
  for (const a of model.arrows) {
    const from = where.get(a.from), to = where.get(a.to);
    if (!from || !to || from === to || seen.has(from + "→" + to)) continue;
    seen.add(from + "→" + to);
    arrows.push(from === a.from && to === a.to && a.via ? { from, to, via: a.via } : { from, to });
  }

  // The loose row: chips one line high, as wide as their name (at most LOOSE_MAX_W); when not all fit, room is kept for the count chip.
  const inner = OPEN_W - 2 * MARGIN, perChar = OPEN_FONT * CHAR_W;
  const looseW = (c: OpenChip): number => Math.min(LOOSE_MAX_W, Math.ceil(c.name.length * perChar) + 2 * PAD_X);
  const fits = (room: number): number => { let x = 0, n = 0; for (const c of model.loose) { if (x + looseW(c) > room) break; x += looseW(c) + LOOSE_GAP; n++; } return n; };
  const nLoose = fits(inner) === model.loose.length ? model.loose.length : fits(inner - COUNT_W - LOOSE_GAP);
  const rest = model.loose.slice(nLoose);
  const looseMore = rest.length ? countOf(rest, n => `+${n} more not linked`, true) : null;

  const drawnSteps = steps.reduce((n, s) => n + s.chips.length, 0);
  const inStepShown = steps.reduce((n, s) => n + (s.more?.n ?? 0), 0);
  return {
    places, width, steps, fold, arrows,
    loose: { chips: model.loose.slice(0, nLoose), widths: model.loose.slice(0, nLoose).map(looseW), more: looseMore },
    height: used(shown) + (fold ? STEP_GAP + COUNT_H : 0),
    counts: { open: model.counts.open, drawn: drawnSteps + nLoose, inStep: inStepShown, folded: foldedChips.length, looseMore: rest.length },
  };
}

/** Which picture a plan gets (owner, Q4 a: automatic only): the full map (option A, compact) while its smallest text is 22 px or more, else the open work. */
export function chooseLayout(map: PlanMap, ahead = DEFAULT_AHEAD): "full-map" | "open-work" {
  return slideSvg(slideModel(map, { kind: "compact", ahead }), { title: "" }).tooSmall ? "open-work" : "full-map";
}
