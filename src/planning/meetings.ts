// Meeting series (Phase 5b): a hub note with `kind: meeting-series` says how often a meeting is held; this works out the next date,
// the "since the last meeting" start and which to-dos are flagged for a series. Pure (no Obsidian runtime).
// Plan: docs/plans/phase-5-homepage-meetings.md.
import { dayMonth, linkTarget, pointsTo, type ListLine, type NoteRec } from "./lists";
import { parseDay, ymd } from "./todo";

export const CADENCES = ["weekly", "fortnightly", "monthly"] as const;
export type Cadence = (typeof CADENCES)[number];
/** Day names as the hub's `day` writes them, Sunday first (Date.getDay order). */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface Series { name: string; path: string; folder: string; cadence: Cadence; day: number; start: Date }
export type SeriesRead = { series: Series } | { name: string; path: string; error: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : v instanceof Date ? ymd(v) : "");
const DAY = 86400000;
/** `d` at midnight, local time, `n` days later (calendar days, so a clock change doesn't shift it). */
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A series hub read from its note: the series, or what is wrong with it (named field). `day` is Mon…Sun (first three letters, any case). */
export function parseSeries(hub: NoteRec): SeriesRead {
  const bad = (error: string): SeriesRead => ({ name: hub.name, path: hub.path, error });
  const cadence = text(hub.fm.cadence).toLowerCase();
  if (!(CADENCES as readonly string[]).includes(cadence)) return bad(`cadence must be weekly, fortnightly or monthly (it is "${cadence}")`);
  const day = WEEKDAYS.findIndex(d => d.toLowerCase() === text(hub.fm.day).slice(0, 3).toLowerCase());
  if (day < 0) return bad(`day must be Mon, Tue, Wed, Thu, Fri, Sat or Sun (it is "${text(hub.fm.day)}")`);
  const start = parseDay(text(hub.fm.start).slice(0, 10));
  if (!start) return bad(`start must be the date of a meeting, YYYY-MM-DD (it is "${text(hub.fm.start)}")`);
  return { series: { name: hub.name, path: hub.path, folder: hub.folder, cadence: cadence as Cadence, day, start } };
}

/** The first `day` on or after `d`. */
const onOrAfter = (d: Date, day: number): Date => addDays(d, (day - d.getDay() + 7) % 7);

/** The `n`th (1–5) `day` of the month `y`-`m`; the last one when that month has fewer than `n`. */
function nthWeekday(y: number, month: number, day: number, n: number): Date {
  const first = new Date(y, month, 1);   // month 12 is January of the next year
  const d = addDays(first, (day - first.getDay() + 7) % 7 + 7 * (n - 1));
  return d.getMonth() === first.getMonth() ? d : addDays(d, -7);
}

/**
 * The date of the first meeting of `s` on or after `from` (today counts). Nothing before the series' first meeting: the first
 * `day` on or after `start`. Weekly: every week. Fortnightly: every 14 days from the first meeting. Monthly: the same weekday of the
 * month as the first meeting (2nd Thursday stays 2nd Thursday; a 5th one becomes the last when the month is short).
 */
export function nextDate(s: Series, from: Date): Date {
  const first = onOrAfter(s.start, s.day);
  const t = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (t.getTime() <= first.getTime()) return first;
  if (s.cadence !== "monthly") {
    const step = s.cadence === "weekly" ? 7 : 14;
    const gone = Math.round((t.getTime() - first.getTime()) / DAY);   // whole days (rounded: a clock change makes a day 23 or 25 h)
    return addDays(first, Math.ceil(gone / step) * step);
  }
  const n = Math.ceil(first.getDate() / 7);
  for (let i = 0; ; i++) {
    const d = nthWeekday(t.getFullYear(), t.getMonth() + i, s.day, n);
    if (d.getTime() >= t.getTime()) return d;
  }
}

/** Days back to look when the series has no earlier meeting note yet. */
const LOOK_BACK = { weekly: 7, fortnightly: 14, monthly: 28 } as const;

/** Where "since the last meeting" starts for a meeting on `date`: the latest of `held` (dates of the series' meeting notes) before it, else one cadence back. */
export function sinceLast(s: Series, date: Date, held: Date[]): Date {
  const before = held.filter(d => ymd(d) < ymd(date)).sort((a, b) => b.getTime() - a.getTime())[0];
  return before ?? addDays(date, -LOOK_BACK[s.cadence]);
}

/** The first series by name: a to-do's old `meeting: true` counts for it. */
export const firstSeries = <T extends { name: string }>(all: T[]): T | undefined => [...all].sort((a, b) => a.name.localeCompare(b.name))[0];

/** To-dos flagged for `s`: `meeting` links to its hub; the old `meeting: true` counts for the first series only. */
export function flaggedFor(todos: NoteRec[], hub: NoteRec, isFirst: boolean): NoteRec[] {
  return todos.filter(t => (t.fm.meeting === true && isFirst) || (typeof t.fm.meeting !== "boolean" && !!linkTarget(t.fm.meeting) && pointsTo(t.fm.meeting, hub)));
}

/** One line of the next-meetings card: series, its next date, how often. */
export interface NextMeeting { name: string; path: string; date: Date; cadence: Cadence }
export function nextMeetings(all: Series[], today: Date): NextMeeting[] {
  return all.map(s => ({ name: s.name, path: s.path, date: nextDate(s, today), cadence: s.cadence }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name));
}

/** The card's lines: the series, "today" or the weekday and date, and how often. */
export const nextMeetingLines = (rows: NextMeeting[], today: Date): ListLine[] => rows.map(r => ({
  path: r.path, text: r.name,
  badges: [ymd(r.date) === ymd(today) ? { text: "today", cls: "vt-badge vt-today" } : { text: `· ${WEEKDAYS[r.date.getDay()]} ${dayMonth(r.date)}`, cls: "vt-muted" },
    { text: r.cadence, cls: "vt-muted" }],
}));
