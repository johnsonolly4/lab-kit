// The week row on top of the Lab Kit board (I2 Phase 7, F1): `‹` `›`, the week's title and `This week`.
// Drawing only: board-view.ts keeps the offset (weeks from this one) while the view is open.
import { weekTitle } from "./board-card";
import { dayOf, weekStart } from "./todo";

/** A day of the week shown `offset` weeks from `now`'s week (0 = this week). */
export const weekAt = (now: Date, offset: number): Date => dayOf(weekStart(now), offset * 7);

/** The right end of the row (F4): `N carried over` (only when N > 0) and `Close the week…`; each gets its own button to open the window under. */
export interface WeekActs { late: number; onLate: (btn: HTMLElement) => void; onClose: (btn: HTMLElement) => void }

/** Draws the row; `go(step)` moves the shown week by one (`±1`), `go(0)` returns to this week. */
export function drawWeekRow(parent: HTMLElement, monday: Date, offset: number, go: (step: number) => void, acts?: WeekActs): HTMLElement {
  const row = parent.createDiv({ cls: "lk-board-weekrow" });
  const btn = (text: string, label: string, cls: string, step: number): void => {
    const b = row.createEl("button", { cls: `lk-board-weekbtn ${cls}`, text, attr: { type: "button", "aria-label": label } });
    b.addEventListener("click", ev => { ev.stopPropagation(); go(step); });
  };
  btn("‹", "Previous week", "is-prev", -1);
  btn("›", "Next week", "is-next", 1);
  row.createSpan({ cls: "lk-board-weektitle", text: weekTitle(monday) });
  if (offset !== 0) btn("This week", "Back to this week", "is-now", 0);
  if (acts) {
    const right = row.createDiv({ cls: "lk-board-weekacts" });
    if (acts.late > 0) {
      const late = right.createEl("button", { cls: "lk-board-chip lk-board-latechip", text: `${acts.late} carried over`, attr: { type: "button", "aria-label": `${acts.late} late cards` } });
      late.addEventListener("click", ev => { ev.stopPropagation(); acts.onLate(late); });
    }
    const close = right.createEl("button", { cls: "lk-board-weekbtn is-close", text: "Close the week…", attr: { type: "button" } });
    close.addEventListener("click", ev => { ev.stopPropagation(); acts.onClose(close); });
  }
  return row;
}
