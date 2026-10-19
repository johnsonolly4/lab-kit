// The to-do board's own view, pure part (Board-B Phase 1): card pieces, the day / tray split, day headers, filters.
// No Obsidian runtime. The view that draws it is board-view.ts. Plan: docs/plans/board-own-view.md.
import { cardTag, dateOf, dayOf, dueCountdown, isFinishedTodo, isoWeekday, parseDay, waitingOf, weekdayOf, weekStart, ymd, DAYS, type CountdownMode, type TodoFm } from "./todo";
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
    const open = hub ? flaggedFor(h.todos, hub, first === s).filter(t => !isFinishedTodo(t.fm)).length : 0;
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

// ---- The board on planned dates (I2; the old `day` board, buildBoard, is frozen in tests/helpers/old-todo.ts). Plan: docs/plans/planned-dates.md "Where a card shows".

/** One card with its dates. */
export interface WeekCard extends BoardCard {
  /** The planned date (`dateOf`) as YYYY-MM-DD, "" for the Backlog. */
  date: string;
  /** `done_on` as YYYY-MM-DD, "" when none. */
  doneOn: string;
  /** Open and planned for a day before today. */
  carried: boolean;
  /** In the tray with a date (after the shown week, or Sat / Sun with the weekend off): `Tue 27 Oct`; else "". */
  pill: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `Tue 27 Oct`. */
export const datePill = (d: Date): string => `${weekdayOf(d)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** One card's pieces and dates. `done` is true for old `day: Done` cards too. */
export function weekCardOf(src: CardSrc, mode: CountdownMode, now: Date): WeekCard {
  const fm = src.fm, d = dateOf(fm, now), done = isFinishedTodo(fm), on = parseDay(fm.done_on);
  return {
    ...cardOf(src, mode, now), done, rolled: false,
    date: d ? ymd(d) : "", doneOn: on ? ymd(on) : "",
    carried: !done && !!d && d < dayOf(now), pill: "",
  };
}

export interface WeekColumn extends DayColumn {
  /** Before today: not a drop target. */
  past: boolean;
  /** The finished cards behind the "N done" line. */
  finished: WeekCard[];
  open: WeekCard[];
}
export interface WeekBoard { days: WeekColumn[]; tray: WeekCard[]; monday: Date }
export interface WeekOptions extends BoardOptions { /** Any day of the week to show; default this week. */ week?: Date }

/** Splits the cards into the shown week's columns and the tray by date (the table in the plan). Writes nothing. */
export function buildWeek(cards: WeekCard[], head: HeaderSrc, o: WeekOptions): WeekBoard {
  const names = shownDays(o.weekend);
  const today = dayOf(o.now), monday = weekStart(o.week ?? o.now), sunday = dayOf(monday, 6);
  const thisWeek = ymd(monday) === ymd(weekStart(today));
  const iso = ymd(today), first = ymd(monday), last = ymd(sunday);
  /** The column of a date of the shown week; Sat / Sun with the weekend off: none. */
  const colOf = (d: string): number => { const i = isoWeekday(parseDay(d)!) - 1; return i < names.length ? i : -1; };
  const todayCol = Math.max(0, colOf(iso));   // the weekend with it off: Mon
  const open: WeekCard[][] = names.map(() => []), finished: WeekCard[][] = names.map(() => []);
  const tray: WeekCard[] = [];
  for (const c of cards) {
    if (c.done) {
      const when = c.doneOn || c.date;
      if (when && when >= first && when <= last) finished[Math.max(0, colOf(when))].push(c);
    } else if (!c.date) tray.push(c);
    else if (c.date < iso) { if (thisWeek) open[todayCol].push(c); }
    else if (c.date < first) continue;   // a week before the shown one, not late yet
    else if (c.date > last || colOf(c.date) < 0) tray.push({ ...c, pill: datePill(parseDay(c.date)!) });
    else open[colOf(c.date)].push(c);
  }
  // Due marks look at where a card is drawn, not at its old `day`
  const placed: BoardCard[] = [...names.flatMap((day, i) => open[i].map(c => ({ ...c, day }))), ...tray.map(c => ({ ...c, day: "Backlog" }))];
  const days = names.map((day, i): WeekColumn => {
    const date = dayOf(monday, i);
    return {
      day, date, today: thisWeek && isToday(i, o.now, o.weekend), past: ymd(date) < iso,
      open: open[i], finished: finished[i], done: finished[i].length, count: open[i].length,
      busy: o.busyFrom > 0 && open[i].length >= o.busyFrom,
      markers: [...meetingMarkers(head, date), ...deadlineMarkers(head, placed, day, date)],
    };
  });
  return { days, tray, monday };
}

/** A tray filter: all, ready to start, a project's name, or no project. */
export type TrayFilter = { kind: "all" } | { kind: "ready" } | { kind: "none" } | { kind: "project"; name: string };

/** The project chips: every project named by a tray card, by name. */
export const trayProjects = (tray: BoardCard[]): string[] => [...new Set(tray.map(c => c.project).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function filterTray<T extends BoardCard>(tray: T[], f: TrayFilter, ready: ReadonlySet<string>): T[] {
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
