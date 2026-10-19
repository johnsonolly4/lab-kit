// The to-do board's own view, pure part (Board-B Phase 1): card pieces, the day / tray split, day headers, filters.
// No Obsidian runtime. The view that draws it is board-view.ts. Plan: docs/plans/board-own-view.md.
import { cardTag, dayOf, dueCountdown, isoWeekday, parseDay, waitingOf, weekStart, ymd, DAYS, type CountdownMode, type TodoFm } from "./todo";
import { flaggedFor, nextDate, ONCE, firstSeries, type Series } from "./meetings";
import { linkTarget, pointsTo, type NoteRec } from "./lists";
import { readPlan } from "./plan";

/** Weekend columns, written to `day` like the working days. */
export const WEEKEND = ["Sat", "Sun"] as const;
/** Open cards on a day from which the count turns amber (setting default). */
export const BUSY_DEFAULT = 6;
/** More deadline / due marks than this on one day collapse to "N due". */
const MARKS_SHOWN = 2;

/** One card as the board draws it. */
export interface BoardCard {
  path: string; title: string; day: string;
  done: boolean; rolled: boolean;
  /** What it waits on, "" when nothing. */
  waiting: string;
  tag: { text: string; level: "1" | "2" | "3" | "" } | null;
  countdown: { text: string; level: "late" | "soon" | "later" } | null;
  /** The project hub's name, "" when none. */
  project: string;
  /** `due` as YYYY-MM-DD, "" when none or unreadable. */
  due: string;
}

export interface CardSrc { path: string; title: string; fm: TodoFm }

/** The first project a to-do names, as the hub's name ("" when none). */
export function projectName(fm: TodoFm): string {
  const first = Array.isArray(fm.project) ? (fm.project as unknown[])[0] : fm.project;
  const t = linkTarget(first);
  return t.slice(t.lastIndexOf("/") + 1);
}

/** The pieces of one card. */
export function cardOf(src: CardSrc, mode: CountdownMode, now: Date): BoardCard {
  const fm = src.fm, done = fm.done === true;
  return {
    path: src.path, title: src.title, day: typeof fm.day === "string" ? fm.day : "",
    done, rolled: fm.rolled === true && !done,
    waiting: done ? "" : waitingOf(fm),
    tag: cardTag(fm),
    countdown: dueCountdown(fm, mode, now),
    project: projectName(fm),
    due: parseDay(fm.due) ? ymd(parseDay(fm.due)!) : "",
  };
}

/** A line under a day's name. */
export interface Marker { kind: "meeting" | "deadline"; text: string }

export interface DayColumn {
  day: string; date: Date; today: boolean;
  /** Open cards, in the order given. */
  open: BoardCard[];
  /** Finished cards: shown as one "N done" line. */
  done: number;
  /** Number shown in the header: the open cards. */
  count: number;
  busy: boolean;
  markers: Marker[];
}

/** What the day headers know besides the cards. */
export interface HeaderSrc {
  /** Meeting series (one-off hubs are ignored). */
  series: Series[];
  /** The notes of the to-do folder, for the flagged counts. */
  todos: NoteRec[];
  /** Notes that may be project hubs (`kind: project`). */
  hubs: NoteRec[];
}

export interface BoardOptions { weekend: boolean; busyFrom: number; countdown: CountdownMode; now: Date }

/** Day names shown, in order. */
export const shownDays = (weekend: boolean): string[] => [...DAYS, ...(weekend ? WEEKEND : [])];

/** Today's header is blue: the weekday, nothing at the weekend unless the weekend is shown. */
const isToday = (index: number, now: Date, weekend: boolean): boolean => {
  const wd = isoWeekday(now);
  return wd <= 5 || weekend ? wd - 1 === index : false;
};

/** Meeting lines for the date `d`: every series with a meeting that day, with its open flagged to-dos. */
export function meetingMarkers(h: HeaderSrc, d: Date): Marker[] {
  const real = h.series.filter(s => s.interval !== ONCE);
  const first = firstSeries(real);
  const hubs = h.hubs;
  const out: Marker[] = [];
  for (const s of [...real].sort((a, b) => a.name.localeCompare(b.name))) {
    if (ymd(nextDate(s, d)) !== ymd(d)) continue;
    const hub = hubs.find(n => n.path === s.path);
    const open = hub ? flaggedFor(h.todos, hub, first === s).filter(t => t.fm.done !== true && t.fm.day !== "Done").length : 0;
    out.push({ kind: "meeting", text: open ? `${s.name} · ${open} flagged` : s.name });
  }
  return out;
}

/** A hub's Status as text (older notes keep it as a one-item list). */
const statusOf = (fm: Record<string, unknown>): string => { const v = Array.isArray(fm.Status) ? (fm.Status as unknown[])[0] : fm.Status; return typeof v === "string" ? v.trim() : ""; };

/** Deadline lines for the date `d`: project hubs (not Done) with that `deadline`, and open to-dos due that day that sit on another day or in the Backlog. */
export function deadlineMarkers(h: HeaderSrc, cards: BoardCard[], day: string, d: Date): Marker[] {
  const iso = ymd(d);
  const marks: string[] = [];
  for (const n of h.hubs) {
    if (n.fm.kind !== "project" || statusOf(n.fm) === "Done") continue;
    const dl = parseDay(n.fm.deadline);
    if (dl && ymd(dl) === iso) marks.push(`${n.name}: deadline`);
  }
  for (const c of cards) if (!c.done && c.due === iso && c.day !== day) marks.push(`Due: ${c.title}`);
  if (marks.length <= MARKS_SHOWN) return marks.map(text => ({ kind: "deadline", text }));
  return [{ kind: "deadline", text: `${marks.length} due` }];
}

export interface Board { days: DayColumn[]; tray: BoardCard[] }

/**
 * Split the cards into the day columns and the tray. A card whose `day` is not a shown column (Backlog, or Sat / Sun with the weekend off,
 * or anything unknown) goes to the tray, so none is hidden. Finished cards in a day column collapse into its `done` count; finished cards
 * in the tray are dropped (the base already leaves out `day: Done`).
 */
export function buildBoard(cards: BoardCard[], head: HeaderSrc, o: BoardOptions): Board {
  const names = shownDays(o.weekend);
  const monday = weekStart(o.now);
  const days = names.map((day, i): DayColumn => {
    const date = dayOf(monday, i);
    const mine = cards.filter(c => c.day === day);
    const open = mine.filter(c => !c.done);
    return {
      day, date, today: isToday(i, o.now, o.weekend), open, done: mine.length - open.length, count: open.length,
      busy: o.busyFrom > 0 && open.length >= o.busyFrom,
      markers: [...meetingMarkers(head, date), ...deadlineMarkers(head, cards, day, date)],
    };
  });
  const tray = cards.filter(c => !names.includes(c.day) && !c.done);
  return { days, tray };
}

/** A tray filter: all, ready to start, a project's name, or no project. */
export type TrayFilter = { kind: "all" } | { kind: "ready" } | { kind: "none" } | { kind: "project"; name: string };

/** The project chips: every project named by a tray card, by name. */
export const trayProjects = (tray: BoardCard[]): string[] => [...new Set(tray.map(c => c.project).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function filterTray(tray: BoardCard[], f: TrayFilter, ready: ReadonlySet<string>): BoardCard[] {
  switch (f.kind) {
    case "all": return tray;
    case "ready": return tray.filter(c => ready.has(c.path));
    case "none": return tray.filter(c => !c.project);
    case "project": return tray.filter(c => c.project === f.name);
  }
}

/** To-dos that can be started now: they have a project, are open, are not waiting, and nothing is open before them in that project's plan (`blocked` false). */
export function readyPaths(todos: NoteRec[], hubs: NoteRec[]): Set<string> {
  const ready = new Set<string>();
  for (const hub of hubs.filter(n => n.fm.kind === "project")) {
    if (!todos.some(t => t.fm.kind === "todo" && pointsTo(t.fm.project, hub))) continue;
    for (const r of readPlan(todos, hub).rows) if (!r.done && !r.blocked && !todos.find(t => t.path === r.path && waitingOf(t.fm))) ready.add(r.path);
  }
  return ready;
}
