// The week row on top of the Lab Kit board (I2 Phase 7, F1): `‹` `›`, the week's title and `This week`.
// Drawing only: board-view.ts keeps the offset (weeks from this one) while the view is open.
import { weekTitle } from "./board-card";
import { dayOf, weekStart } from "./todo";

/** A day of the week shown `offset` weeks from `now`'s week (0 = this week). */
export const weekAt = (now: Date, offset: number): Date => dayOf(weekStart(now), offset * 7);

/** Draws the row; `go(step)` moves the shown week by one (`±1`), `go(0)` returns to this week. */
export function drawWeekRow(parent: HTMLElement, monday: Date, offset: number, go: (step: number) => void): HTMLElement {
  const row = parent.createDiv({ cls: "lk-board-weekrow" });
  const btn = (text: string, label: string, cls: string, step: number): void => {
    const b = row.createEl("button", { cls: `lk-board-weekbtn ${cls}`, text, attr: { type: "button", "aria-label": label } });
    b.addEventListener("click", ev => { ev.stopPropagation(); go(step); });
  };
  btn("‹", "Previous week", "is-prev", -1);
  btn("›", "Next week", "is-next", 1);
  row.createSpan({ cls: "lk-board-weektitle", text: weekTitle(monday) });
  if (offset !== 0) btn("This week", "Back to this week", "is-now", 0);
  return row;
}
