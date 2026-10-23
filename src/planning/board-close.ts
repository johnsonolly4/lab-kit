// Close the week (F4) and the Late cards window of the Lab Kit board (I2 Phase 8): what each button writes.
// Pure (no Obsidian runtime): the windows are in board-close-ui.ts, the writes go through `dropPatch` in board-view.ts, so they are the writes of a drag.
// Plan: docs/plans/planned-dates.md "Week arrows (F1) and Close the week (F4)".
import type { WeekCard } from "./board-card";
import { dayOf, isoWeekday, weekStart, ymd } from "./todo";

/** Close the week: move the ticked cards to next Monday, move them to the Backlog, or leave them (they stay late and carry over). */
export type CloseChoice = "next" | "backlog" | "leave";
/** A Late cards button; `done` is a tick, the others are drops. */
export type LateAction = "today" | "tomorrow" | "nextweek" | "backlog" | "done";

/** One card to write: `to` is the day it is dropped on, null for the Backlog. */
export interface Move { path: string; title: string; to: Date | null }

/** The Monday after `today`'s week. */
export const nextMonday = (today: Date): Date => dayOf(weekStart(today), 7);

/**
 * The open cards the Close window lists (Q7 b): from Friday on (the end of the working week) every open card dated up to Sunday,
 * earlier in the week only those of days already past. Cards of earlier weeks that are still open are in; the Backlog and later weeks never are.
 */
export function closeList(cards: WeekCard[], today: Date): WeekCard[] {
  const t = dayOf(today), upTo = ymd(isoWeekday(t) >= 5 ? dayOf(weekStart(t), 6) : dayOf(t, -1));
  return cards.filter(c => !c.done && c.date !== "" && c.date <= upTo);
}

/** What `Move N` writes: the listed cards that are ticked (default all), to next Monday or the Backlog; `leave` writes nothing. */
export function closeWeekPlan(cards: WeekCard[], today: Date, choice: CloseChoice, ticked?: ReadonlySet<string>): { listed: WeekCard[]; moves: Move[] } {
  const listed = closeList(cards, today);
  if (choice === "leave") return { listed, moves: [] };
  const to = choice === "next" ? nextMonday(today) : null;
  return { listed, moves: listed.filter(c => !ticked || ticked.has(c.path)).map(c => ({ path: c.path, title: c.title, to })) };
}

/** The Late cards window's rows: open cards planned for a day before today. */
export const lateCards = (cards: WeekCard[], today: Date): WeekCard[] => cards.filter(c => !c.done && c.date !== "" && c.date < ymd(dayOf(today)));

/** The day a Late cards button drops on: a date, null for the Backlog; undefined for `done` (a tick, not a drop). */
export function lateTarget(action: LateAction, today: Date): Date | null | undefined {
  switch (action) {
    case "today": return dayOf(today);
    case "tomorrow": return dayOf(today, 1);
    case "nextweek": return nextMonday(today);
    case "backlog": return null;
    case "done": return undefined;
  }
}
