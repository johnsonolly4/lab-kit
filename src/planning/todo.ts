// To-do board rules (planning kit): what to write when a card is dragged, ticked or arrives in the To-dos folder.
// Pure (no Obsidian runtime): dates are local calendar days, "YYYY-MM-DD" strings, compared as text.
// Ported from the planning suite's To-do roll-over startup template (2026-10-07); see docs/plans/phase-4a-todo-engine.md.

/** Board columns for the working days, in order. Other values of `day`: "Backlog" (stays put), "Done" (off the board). */
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/** The properties of a to-do note this engine reads. */
export interface TodoFm { kind?: unknown; day?: unknown; done?: unknown; done_on?: unknown; planned?: unknown; rolled?: unknown; due?: unknown; countdown?: unknown; project?: unknown; priority?: unknown; waiting?: unknown; scheduled?: unknown; meeting?: unknown }
/** Properties to set and to remove in one write. */
export interface TodoPatch { set: Record<string, string | boolean>; remove: string[] }

/** A property value as text: numbers and booleans as written, anything else (lists, objects, empty) as "". */
const str = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
const pad = (n: number): string => String(n).padStart(2, "0");
/** Local calendar day of `d` as YYYY-MM-DD. */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local midnight of `d`, plus `days`. */
export const dayOf = (d: Date, days = 0): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (d: Date): number => ((d.getDay() + 6) % 7) + 1;
/** Monday of `d`'s week. */
export const weekStart = (d: Date): Date => dayOf(d, 1 - isoWeekday(d));

/** A strict YYYY-MM-DD value as a local date, or null. */
export function parseDay(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(v));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ymd(d) === m[0] ? d : null;   // 2026-02-30 is not a day
}

/** Today's column for the CSS (`body[data-vt-today]`): empty at the weekend. */
export const todayMark = (d: Date): string => { const wd = isoWeekday(d); return wd <= 5 ? DAYS[wd - 1] : ""; };

/** A note the board just made and nothing was typed in: no text, and no properties but `day` and empty ones (the board's New also writes `done:`). The To-do template's `trashIfBlank` does the same on Esc (change both). */
export function isBlankBoardNote(raw: string): boolean {
  const rest = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, (m, fm: string) => fm.split(/\r?\n/).every(l => !l.trim() || /^(?:day:|[\w .-]+:\s*$)/.test(l.trim())) ? "" : m);
  return rest.trim() === "";
}

/** Where the cursor goes in a to-do with nothing typed yet: the last (empty) line under the chip bar. Null for any other note. */
export function emptyTodoCursorLine(raw: string): number | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  if (!m || !/^kind:\s*["']?todo["']?\s*$/m.test(m[1])) return null;
  const body = raw.slice(m[0].length);
  const bar = /```vault-card\r?\n\s*show:\s*todo-bar\s*\r?\n```[ \t]*\r?\n/.exec(body);
  if (!bar || body.slice(bar.index + bar[0].length).trim() !== "") return null;
  return raw.split("\n").length - 1;   // the text ends with a newline: the last line is empty
}

// ---- Planned dates (I2, slim model): `scheduled` is the one planned-day key. Plan: docs/plans/planned-dates.md.
// The old `day` rules (changePatch, rollOverPatch) were removed in Phase 2; a frozen copy for the old-vault tests is in tests/helpers/old-todo.ts.

/** Every weekday name an old `day` can hold, Mon … Sun. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** `Mon` … `Sun` for a date. */
export const weekdayOf = (d: Date): string => WEEKDAYS[isoWeekday(d) - 1];
/** Keys of the old model, removed whenever a card is written (drag, normalise). */
const OLD_KEYS = ["day", "planned", "rolled"] as const;
const has = (fm: TodoFm, k: string): boolean => Object.keys(fm).includes(k);
/** No value: absent, null, blank text or an empty list. */
const isEmpty = (v: unknown): boolean => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/**
 * The date a to-do is planned for, or null (Backlog). `scheduled` when it has a value (a value that is not a date: null, the tray);
 * else an old weekday `day`, read as the old roll-over read it: the first such weekday on or after `planned`, or on or after this week's Monday.
 */
export function dateOf(fm: TodoFm, now: Date): Date | null {
  if (!isEmpty(fm.scheduled)) return parseDay(fm.scheduled);
  const i = (WEEKDAYS as readonly string[]).indexOf(str(fm.day));
  if (i < 0) return null;
  const from = parseDay(fm.planned) ?? weekStart(now);
  return dayOf(from, (i + 1 - isoWeekday(from) + 7) % 7);
}

/** Finished: ticked, or an old card on `day: Done` from before the tick box. */
export const isFinishedTodo = (fm: TodoFm): boolean => fm.done === true || fm.day === "Done";

/** Carried over: open and planned for a day before today. Worked out, never stored. */
export function isCarried(fm: TodoFm, now: Date): boolean {
  if (isFinishedTodo(fm)) return false;
  const d = dateOf(fm, now);
  return !!d && d < dayOf(now);
}

export type DropResult = { patch: TodoPatch } | { refused: "past" } | null;
/** A card dropped on `target` (a column's date) or on the tray (null): the write, a refusal for a past day, or null when nothing changes. */
export function dropPatch(fm: TodoFm, target: Date | null, now: Date): DropResult {
  if (target && dayOf(target) < dayOf(now)) return { refused: "past" };
  const old = OLD_KEYS.filter(k => has(fm, k));
  if (target) {
    const t = ymd(target);
    return str(fm.scheduled) === t && !old.length ? null : { patch: { set: { scheduled: t }, remove: old } };
  }
  const remove = [...(has(fm, "scheduled") ? ["scheduled"] : []), ...old];
  return remove.length ? { patch: { set: {}, remove } } : null;
}

/**
 * The stamps after a tick or untick (`wasDone` = done as last seen; undefined = first sight, left alone): `done_on` on tick, removed on untick.
 * `scheduled` is kept both ways, so an unticked card goes back to its day. A synced change already carries its stamps, so it writes nothing.
 */
export function tickPatch(fm: TodoFm, wasDone: boolean | undefined, now: Date): TodoPatch | null {
  if (wasDone === undefined || fm.kind !== "todo") return null;
  const done = fm.done === true;
  if (done === wasDone) return null;
  const set: Record<string, string | boolean> = {}, remove: string[] = [];
  if (done) {
    if (isEmpty(fm.done_on)) set.done_on = ymd(now);
    if (has(fm, "rolled")) remove.push("rolled");
  } else {
    if (has(fm, "done_on")) remove.push("done_on");
    // Unticked on the old Done column: drop `day` too, else the card would still read as finished
    if (fm.day === "Done") remove.push("day");
  }
  return Object.keys(set).length || remove.length ? { set, remove } : null;
}

/** Keys removed when they hold no value. */
const EMPTY_KEYS = ["day", "scheduled", "project", "due", "waiting", "priority"] as const;

/**
 * A note that arrived in the To-dos folder (made, moved or renamed in) brought to the slim model, or null when it already is.
 * Notes of another kind are left alone. Unknown `day` values (a typo) are kept. Running it on its own result gives null.
 */
export function normalisePatch(fm: TodoFm, now: Date): TodoPatch | null {
  if (!isEmpty(fm.kind) && fm.kind !== "todo") return null;
  const set: Record<string, string | boolean> = {};
  const remove = new Set<string>();
  if (fm.kind !== "todo") set.kind = "todo";
  const day = str(fm.day);
  const done = day === "Done" ? true : fm.done === true;
  if (fm.done !== done) set.done = done;
  if (day === "Done" || day === "Backlog") remove.add("day");
  if ((WEEKDAYS as readonly string[]).includes(day)) {
    if (isEmpty(fm.scheduled)) set.scheduled = ymd(dateOf(fm, now)!);
    remove.add("day");
  }
  for (const k of ["planned", "rolled", "countdown"]) if (has(fm, k)) remove.add(k);
  if (!done && has(fm, "done_on")) remove.add("done_on");
  for (const k of EMPTY_KEYS) if (has(fm, k) && isEmpty((fm as Record<string, unknown>)[k]) && !(k in set)) remove.add(k);
  if (fm.meeting === false) remove.add("meeting");
  return Object.keys(set).length || remove.size ? { set, remove: [...remove] } : null;
}

/** A patch that turns front matter `after` back into `before` (Undo after a tick): changed keys set back, added keys removed. */
export function undoPatch(before: Record<string, unknown>, after: Record<string, unknown>): { set: Record<string, unknown>; remove: string[] } {
  const set: Record<string, unknown> = {}, remove: string[] = [];
  for (const k of Object.keys(before)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k]) || !(k in after)) set[k] = before[k];
  for (const k of Object.keys(after)) if (!(k in before)) remove.push(k);
  return { set, remove };
}

/** Applies a patch to a frontmatter object (inside processFrontMatter). */
export function applyPatch(x: Record<string, unknown>, p: { set: Record<string, unknown>; remove: string[] }): void {
  for (const [k, v] of Object.entries(p.set)) x[k] = v;
  for (const k of p.remove) delete x[k];
}

/** Due-date countdown on the board: off, or every to-do with a due date. */
export type CountdownMode = "off" | "all";
/** `level`: "late" (overdue), "soon" (today to 2 days), "later". */
export interface Countdown { text: string; level: "late" | "soon" | "later" }

/** What a to-do waits on (`waiting: instrument booking`): the trimmed text, "" when the property is absent, empty or not text. */
export const waitingOf = (fm: { waiting?: unknown }): string => (typeof fm.waiting === "string" ? fm.waiting.trim() : "");

/** The marker for each priority: an up arrow, a dash, a down arrow (visual only: no "P1" text). */
const PRIORITY_MARK = { "1": "\u2191", "2": "\u2013", "3": "\u2193" } as const;

/** The small tag at the bottom left of a board card: an arrow for priority 1, 2 or 3 (↑ high, – medium, ↓ low) and the project hub's name ("↑ Polymers"). null when the to-do has neither. `level` is the priority (for the colour). */
export function cardTag(fm: TodoFm): { text: string; level: "1" | "2" | "3" | "" } | null {
  const n = Number(typeof fm.priority === "string" ? fm.priority.trim() || NaN : fm.priority);
  const level = n === 1 || n === 2 || n === 3 ? (String(n) as "1" | "2" | "3") : "";
  const first = Array.isArray(fm.project) ? (fm.project as unknown[])[0] : fm.project;
  const target = str(first).trim().replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].replace(/\.md$/, "").trim();
  const project = target.slice(target.lastIndexOf("/") + 1);
  const text = [level ? PRIORITY_MARK[level] : "", project].filter(Boolean).join(" ");
  return text ? { text, level } : null;
}

/** The badge for a card: null when off, done or with no valid `due`. Whole local days, so DST can't shift it. */
export function dueCountdown(fm: TodoFm, mode: CountdownMode, now: Date): Countdown | null {
  if (mode === "off" || fm.done === true) return null;
  const due = parseDay(fm.due);
  if (!due) return null;
  const n = Math.round((due.getTime() - dayOf(now).getTime()) / 864e5);
  if (n < 0) return { text: `${-n}d late`, level: "late" };
  if (n === 0) return { text: "Today", level: "soon" };
  if (n === 1) return { text: "Tomorrow", level: "soon" };
  return { text: `${n}d`, level: n <= 2 ? "soon" : "later" };
}
