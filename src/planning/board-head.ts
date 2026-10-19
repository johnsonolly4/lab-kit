// The small `+` in a day header of the Lab Kit board (I2 Phase 5 question a, docs/decisions.md): today and later days only; a click opens the New to-do window with that day.
// Drawing only: board-view.ts hands the click to the planning commands (`newTodoOn`).
import type { WeekColumn } from "./board-card";

/** Adds the `+` to a day header; nothing for a past day. The day is handed over as its date, so the window opens through `columnEntry`. */
export function drawHeadAdd(head: HTMLElement, d: Pick<WeekColumn, "past" | "day">, add: (button: HTMLElement) => void): HTMLElement | null {
  if (d.past) return null;
  const b = head.createEl("button", { cls: "lk-board-add", text: "+", attr: { type: "button", "aria-label": `New to-do on ${d.day}` } });
  b.addEventListener("click", ev => { ev.stopPropagation(); add(b); });
  return b;
}
