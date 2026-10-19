// To-do board rules (planning kit): what to write when a card is dragged or ticked, and what roll-over does to each card.
// Pure (no Obsidian runtime): dates are local calendar days, "YYYY-MM-DD" strings, compared as text.
// Ported from the planning suite's To-do roll-over startup template (2026-10-07); see docs/plans/phase-4a-todo-engine.md.

/** Board columns for the working days, in order. Other values of `day`: "Backlog" (stays put), "Done" (off the board). */
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/** The properties of a to-do note this engine reads. */
export interface TodoFm { kind?: unknown; day?: unknown; done?: unknown; done_on?: unknown; planned?: unknown; rolled?: unknown; due?: unknown; countdown?: unknown; project?: unknown; priority?: unknown }
/** What the engine last saw of a card: tells a drag or tick from its own writes. */
export interface TodoSnap { day: string; done: boolean }
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

/** Today's column: the weekday, or Mon at the weekend. */
export const todayColumn = (d: Date): string => { const wd = isoWeekday(d); return wd <= 5 ? DAYS[wd - 1] : "Mon"; };
/** Today's column for the CSS (`body[data-vt-today]`): empty at the weekend. */
export const todayMark = (d: Date): string => { const wd = isoWeekday(d); return wd <= 5 ? DAYS[wd - 1] : ""; };

/** A note the board just made and nothing was typed in: no text, and no properties but `day`. The To-do template's `trashIfBlank` does the same on Esc (change both). */
export function isBlankBoardNote(raw: string): boolean {
  const rest = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, (m, fm: string) => fm.split(/\r?\n/).every(l => !l.trim() || /^day:/.test(l.trim())) ? "" : m);
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

export const snapOf = (fm: TodoFm): TodoSnap => ({ day: str(fm.day), done: fm.done === true });

/** The date a card's day refers to: the first such weekday on or after the day it was planned. */
export function cardDate(fm: TodoFm): Date | null {
  const i = (DAYS as readonly string[]).indexOf(str(fm.day));
  const p = parseDay(fm.planned);
  if (i < 0 || !p) return null;
  return dayOf(p, (i + 1 - isoWeekday(p) + 7) % 7);
}

/**
 * A card changed (`before` → `now`, as last seen): the stamps to write, or null.
 * A change that arrives through Obsidian Sync already carries its stamps (the other device wrote them), so this writes only when a
 * stamp is missing or wrong: otherwise devices would answer each other's changes (write-back loops, carried-over cards losing amber).
 * A card seen for the first time (`before` undefined) is left to the To-do template.
 */
export function changePatch(fm: TodoFm, before: TodoSnap | undefined, now: TodoSnap, today: Date): TodoPatch | null {
  if (!before || fm.kind !== "todo") return null;
  if (now.done !== before.done) {
    if (now.done && (fm.done_on == null || fm.rolled === true)) return { set: { ...(fm.done_on == null ? { done_on: ymd(today) } : {}), rolled: false }, remove: [] };
    // Unticked on the Done column: back to Backlog too, else the roll-over reads Done + not done as an old finished card and ticks it again
    if (!now.done && (fm.done_on != null || fm.day === "Done")) return { set: fm.day === "Done" ? { day: "Backlog" } : {}, remove: fm.done_on != null ? ["done_on"] : [] };
    return null;
  }
  if (now.day !== before.day) {
    // Dragged here: planned is not today yet, or a carried-over card was moved off today's column.
    // Rolled over on another device: planned is today and the card sits in today's column, so leave it.
    const stale = str(fm.planned) !== ymd(today);
    const movedOffRoll = fm.rolled === true && now.day !== todayColumn(today);
    if (stale || movedOffRoll) return { set: { planned: ymd(today), rolled: false }, remove: [] };
  }
  return null;
}

export type RollKind = "ticked" | "cleared" | "rolled" | "planned";
/** Roll-over for one card: the write and what it was, or null. `mtime` = the note's last change (for cards from before the tick box). */
export function rollOverPatch(fm: TodoFm, mtime: Date, now: Date): { patch: TodoPatch; kind: RollKind; snap?: TodoSnap } | null {
  if (fm.kind !== "todo") return null;
  const today = dayOf(now), monday = weekStart(today);
  if (fm.day === "Done" && fm.done !== true) {
    // Finished before the tick box existed: tick it, keeping the day it was finished
    return { patch: { set: { done: true, done_on: ymd(mtime), rolled: false }, remove: [] }, kind: "ticked", snap: { day: "Done", done: true } };
  }
  if (fm.done === true) {
    const d = parseDay(fm.done_on) ?? dayOf(mtime);
    if (fm.day === "Done" || d >= monday) return null;
    return { patch: { set: { day: "Done", ...(fm.done_on ? {} : { done_on: ymd(d) }) }, remove: [] }, kind: "cleared", snap: { day: "Done", done: true } };
  }
  if (!(DAYS as readonly string[]).includes(str(fm.day))) return null;   // Backlog stays put
  // A card from before roll-over existed counts as planned this week, so a Mon card seen on Tuesday rolls over now
  const planned = parseDay(fm.planned) ? str(fm.planned) : null;
  const due = cardDate({ ...fm, planned: planned ?? ymd(monday) });
  if (due && due < today) {
    const col = todayColumn(today);
    return { patch: { set: { day: col, planned: ymd(today), rolled: true }, remove: [] }, kind: "rolled", snap: { day: col, done: false } };
  }
  if (!planned) return { patch: { set: { planned: ymd(monday) }, remove: [] }, kind: "planned" };
  return null;
}

/** Applies a patch to a frontmatter object (inside processFrontMatter). */
export function applyPatch(x: Record<string, unknown>, p: TodoPatch): void {
  for (const [k, v] of Object.entries(p.set)) x[k] = v;
  for (const k of p.remove) delete x[k];
}

/** Due-date countdown on the board: off, only to-dos that set `countdown: true`, or every to-do with a due date. */
export type CountdownMode = "off" | "marked" | "all";
/** `level`: "late" (overdue), "soon" (today to 2 days), "later". */
export interface Countdown { text: string; level: "late" | "soon" | "later" }

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

/** The badge for a card: null when off, done, not marked (mode "marked") or with no valid `due`. Whole local days, so DST can't shift it. */
export function dueCountdown(fm: TodoFm, mode: CountdownMode, now: Date): Countdown | null {
  if (mode === "off" || fm.done === true) return null;
  if (mode === "marked" && fm.countdown !== true) return null;
  const due = parseDay(fm.due);
  if (!due) return null;
  const n = Math.round((due.getTime() - dayOf(now).getTime()) / 864e5);
  if (n < 0) return { text: `${-n}d late`, level: "late" };
  if (n === 0) return { text: "Today", level: "soon" };
  if (n === 1) return { text: "Tomorrow", level: "soon" };
  return { text: `${n}d`, level: n <= 2 ? "soon" : "later" };
}
