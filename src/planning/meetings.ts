// Meeting series (Phase 5b): a hub note with `kind: meeting-series` says how often a meeting is held; this works out the next date,
// the "since the last meeting" start and which to-dos are flagged for a series. Pure (no Obsidian runtime).
// Plan: docs/plans/phase-5-homepage-meetings.md.
import { cleanName } from "./actions";
import { dayMonth, linkTarget, pointsTo, type ListLine, type NoteRec } from "./lists";
import { parseDay, ymd } from "./todo";

export const INTERVALS = ["weekly", "fortnightly", "monthly"] as const;
/** The three presets, `every N weeks` (N 1-52), or `once` (the One-off hub: it has no schedule). */
export type Interval = string;
export const ONCE = "once";
export const everyWeeks = (n: number): string => `every ${n} weeks`;
/** An interval as the hub writes it, in its canonical form; null when it is none of the allowed ones (case and `every 1 week` are fine). */
export function parseInterval(typed: string): Interval | null {
  const t = typed.trim().toLowerCase();
  if ((INTERVALS as readonly string[]).includes(t) || t === ONCE) return t;
  const m = /^every (\d{1,2}) weeks?$/.exec(t);
  return m && +m[1] >= 1 && +m[1] <= 52 ? everyWeeks(+m[1]) : null;
}
/** Weeks between meetings for a weekly-style interval; null for monthly and once. */
export function intervalWeeks(i: Interval): number | null {
  const t = parseInterval(i);
  return t === "weekly" ? 1 : t === "fortnightly" ? 2 : t && t.startsWith("every ") ? +t.split(" ")[1] : null;
}
/** Day names as the hub's `day` writes them, Sunday first (Date.getDay order). */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** `template`: the series' own meeting note template as written on the hub (a name, path or [[link]]); empty = the kit's. */
export interface Series { name: string; path: string; folder: string; interval: Interval; day: number; start: Date; template?: string }
export type SeriesRead = { series: Series } | { name: string; path: string; error: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : v instanceof Date ? ymd(v) : "");
/** A template reference as typed on a hub: `[[Name]]`, `[[Name|alias]]`, `Name`, `Folder/Name.md` all give `Name` / `Folder/Name`. */
export function templateRef(v: unknown): string {
  const t = text(v).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  return t.replace(/\.md$/i, "");
}
const DAY = 86400000;
/** `d` at midnight, local time, `n` days later (calendar days, so a clock change doesn't shift it). */
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A series hub read from its note: the series, or what is wrong with it (named field). `day` is Mon…Sun (first three letters, any case). */
export function parseSeries(hub: NoteRec): SeriesRead {
  const bad = (error: string): SeriesRead => ({ name: hub.name, path: hub.path, error });
  const interval = parseInterval(text(hub.fm.interval));
  if (!interval) return bad(`interval must be weekly, fortnightly, monthly, every N weeks or once (it is "${text(hub.fm.interval)}")`);
  // A one-off hub has no schedule: day and start are not needed
  const template = templateRef(hub.fm.template);
  if (interval === ONCE) return { series: { name: hub.name, path: hub.path, folder: hub.folder, interval, day: 1, start: parseDay(text(hub.fm.start).slice(0, 10)) ?? new Date(1970, 0, 5), template } };
  const day = WEEKDAYS.findIndex(d => d.toLowerCase() === text(hub.fm.day).slice(0, 3).toLowerCase());
  if (day < 0) return bad(`day must be Mon, Tue, Wed, Thu, Fri, Sat or Sun (it is "${text(hub.fm.day)}")`);
  const start = parseDay(text(hub.fm.start).slice(0, 10));
  if (!start) return bad(`start must be the date of a meeting, YYYY-MM-DD (it is "${text(hub.fm.start)}")`);
  return { series: { name: hub.name, path: hub.path, folder: hub.folder, interval, day, start, template } };
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
  const weeks = intervalWeeks(s.interval);
  if (weeks !== null) {
    const step = weeks * 7;
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
const lookBack = (i: Interval): number => { const w = intervalWeeks(i); return w === null ? 28 : w * 7; };

/** Where "since the last meeting" starts for a meeting on `date`: the latest of `held` (dates of the series' meeting notes) before it, else one interval back. */
export function sinceLast(s: Series, date: Date, held: Date[]): Date {
  const before = held.filter(d => ymd(d) < ymd(date)).sort((a, b) => b.getTime() - a.getTime())[0];
  return before ?? addDays(date, -lookBack(s.interval));
}

/** The first `day` (0 = Sunday) on or after `today`: the date New meeting series offers first. */
export const firstDefaultDate = (day: number, today: Date): Date => onOrAfter(new Date(today.getFullYear(), today.getMonth(), today.getDate()), day);

/** A series name for a folder and a note: characters Obsidian can't use in a file name replaced by "-". Error text when nothing usable is left. */
export function checkSeriesName(typed: string): { name: string } | { error: string } {
  const name = cleanName(typed).replace(/^\.+/, "").trim();
  return name ? { name } : { error: "Type a name for the series." };
}

/** The first meeting date typed as YYYY-MM-DD: it must be a real day and fall on the series' `day` (else the hub's start and its day disagree). */
export function checkFirstDate(typed: string, day: number): { date: Date } | { error: string } {
  const date = parseDay(typed.trim());
  if (!date) return { error: "Type the date as YYYY-MM-DD, for example 2026-10-15." };
  if (date.getDay() !== day) return { error: `${typed.trim()} is a ${WEEKDAYS[date.getDay()]}, not a ${WEEKDAYS[day]}.` };
  return { date };
}

/** A deck path as the user pastes it: "Copy as path" puts quotes around it. Empty when none. */
export const cleanDeckPath = (typed: string): string => typed.trim().replace(/^"(.*)"$/, "$1").trim();

/** The first series by name: a to-do's old `meeting: true` counts for it. */
export const firstSeries = <T extends { name: string }>(all: T[]): T | undefined => [...all].sort((a, b) => a.name.localeCompare(b.name))[0];

/** To-dos flagged for `s`: `meeting` links to its hub; the old `meeting: true` counts for the first series only. */
export function flaggedFor(todos: NoteRec[], hub: NoteRec, isFirst: boolean): NoteRec[] {
  return todos.filter(t => (t.fm.meeting === true && isFirst) || (typeof t.fm.meeting !== "boolean" && !!linkTarget(t.fm.meeting) && pointsTo(t.fm.meeting, hub)));
}

/** One line of the next-meetings card: series, its next date, how often. */
export interface NextMeeting { name: string; path: string; date: Date; interval: Interval }
export function nextMeetings(all: Series[], today: Date): NextMeeting[] {
  return all.filter(s => s.interval !== ONCE).map(s => ({ name: s.name, path: s.path, date: nextDate(s, today), interval: s.interval }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name));
}

/** The card's lines: the series, "today" or the weekday and date, and how often. */
export const nextMeetingLines = (rows: NextMeeting[], today: Date): ListLine[] => rows.map(r => ({
  path: r.path, text: r.name,
  badges: [ymd(r.date) === ymd(today) ? { text: "today", cls: "vt-badge vt-today" } : { text: `· ${WEEKDAYS[r.date.getDay()]} ${dayMonth(r.date)}`, cls: "vt-muted" },
    { text: r.interval, cls: "vt-muted" }],
}));

/** The series a note belongs to: a series hub is its own series, a meeting note has it in `series` (a link). Used to open the right deck without asking. */
export function seriesOfNote<T extends { name: string; path: string }>(all: T[], path: string, fm: Record<string, unknown>): T | undefined {
  const own = all.find(s => s.path === path);
  if (own) return own;
  const name = linkTarget(fm.series);
  return name ? all.find(s => s.name === name.split("/").pop()) : undefined;
}
