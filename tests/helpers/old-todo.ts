// The 1.4.x to-do rules on `day` / `planned` / `rolled`, frozen when I2 Phase 2 removed them from src (2026-10-19).
// Kept only so the old-vault tests can model what an older plugin wrote and drew. Do not use in src.
import { DAYS, dayOf, isoWeekday, parseDay, waitingOf, weekStart, ymd, type TodoFm, type TodoPatch } from "../../src/planning/todo";
import { pointsTo, type Badge, type ListLine, type NoteRec } from "../../src/planning/lists";
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


// The 1.4.x Home "This week" and project hub To-dos lists on `day`, frozen when I2 Phase 3 moved them to dates (2026-10-19).
const OLD_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (d: Date): string => `${d.getDate()} ${OLD_MONTHS[d.getMonth()]}`;
const lstr = (v: unknown): string => (Array.isArray(v) ? lstr(v[0]) : typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const dayRank = (day: string): number => { const i = (DAYS as readonly string[]).indexOf(day); return i < 0 ? 6 : i + 1; };
const late = (fm: Record<string, unknown>, today: Date): Date | null => { const due = parseDay(lstr(fm.due).slice(0, 10)); return due && ymd(due) < ymd(today) ? due : null; };
const waitBadge = (fm: Record<string, unknown>): Badge[] => { const w = waitingOf(fm); return w ? [{ text: `waiting: ${w}`, cls: "vt-badge vt-waiting" }] : []; };
const openOld = (n: NoteRec): boolean => n.fm.kind === "todo" && n.fm.done !== true && lstr(n.fm.day) !== "Done";
const prio = (p: unknown): number => { const n = Number(typeof p === "string" ? p.trim() || NaN : p); return n === 1 || n === 2 || n === 3 ? n : 4; };

export function oldThisWeek(todos: NoteRec[], today: Date): ListLine[] {
  const todayName = isoWeekday(today) <= 5 ? DAYS[isoWeekday(today) - 1] : "";
  return todos
    .filter(n => openOld(n) && ((DAYS as readonly string[]).includes(lstr(n.fm.day)) || late(n.fm, today)))
    .map(n => ({ n, l: late(n.fm, today) }))
    .sort((a, b) => (a.l ? 0 : 1) - (b.l ? 0 : 1) || dayRank(lstr(a.n.fm.day)) - dayRank(lstr(b.n.fm.day)) || a.n.path.localeCompare(b.n.path))
    .map(({ n, l }) => {
      const day = lstr(n.fm.day);
      const badges: Badge[] = [l ? { text: `overdue ${dm(l)}`, cls: "vt-badge vt-overdue" }
        : day === todayName ? { text: "today", cls: "vt-badge vt-today" } : { text: `· ${day}`, cls: "vt-muted" }];
      if (n.fm.rolled === true) badges.push({ text: "carried over", cls: "vt-badge vt-rolled" });
      badges.push(...waitBadge(n.fm));
      return { path: n.path, text: n.name, badges };
    });
}

export function oldProjectTodos(todos: NoteRec[], hub: NoteRec, today: Date): ListLine[] {
  const rank = (d: string): number => { const r = dayRank(d); return d === "Backlog" ? 6 : r === 6 ? 8 : r; };
  return todos.filter(t => openOld(t) && pointsTo(t.fm.project, hub))
    .map(t => ({ t, l: late(t.fm, today) }))
    .sort((a, b) => ((a.l ? 0 : 1) * 10 + rank(lstr(a.t.fm.day))) - ((b.l ? 0 : 1) * 10 + rank(lstr(b.t.fm.day)))
      || prio(a.t.fm.priority) - prio(b.t.fm.priority) || a.t.path.localeCompare(b.t.path))
    .map(({ t, l }) => ({ path: t.path, text: t.name,
      badges: [l ? { text: `overdue ${dm(l)}`, cls: "vt-badge vt-overdue" } : { text: `· ${lstr(t.fm.day)}`, cls: "vt-muted" }, ...waitBadge(t.fm)] }));
}
