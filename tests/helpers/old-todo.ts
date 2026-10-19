// The 1.4.x to-do rules on `day` / `planned` / `rolled`, frozen when I2 Phase 2 removed them from src (2026-10-19).
// Kept only so the old-vault tests can model what an older plugin wrote and drew. Do not use in src.
import { DAYS, dayOf, isoWeekday, parseDay, weekStart, ymd, type TodoFm, type TodoPatch } from "../../src/planning/todo";
import { deadlineMarkers, meetingMarkers, shownDays, type BoardCard, type BoardOptions, type DayColumn, type HeaderSrc } from "../../src/planning/board-card";

const str = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

/** Today's column: the weekday, or Mon at the weekend. */
export const todayColumn = (d: Date): string => { const wd = isoWeekday(d); return wd <= 5 ? DAYS[wd - 1] : "Mon"; };
/** What the engine last saw of a card: tells a drag or tick from its own writes. */
export interface TodoSnap { day: string; done: boolean }

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


const isToday = (index: number, now: Date, weekend: boolean): boolean => {
  const wd = isoWeekday(now);
  return wd <= 5 || weekend ? wd - 1 === index : false;
};

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

