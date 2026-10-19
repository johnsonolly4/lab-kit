// A day's `N done` line on the Lab Kit board: a click unfolds that day's finished cards under it (struck through, filled circle); a click on the circle unticks.
// Drawing only: board-view.ts owns which days are unfolded and what an untick writes (I2 Phase 6, docs/decisions.md "I2 Phase 6 ticks").
import type { WeekCard } from "./board-card";

export interface DoneHandlers {
  /** The `N done` line was clicked. */
  toggle: () => void;
  /** The circle of a finished card: untick it (no notice). */
  untick: (path: string) => void;
  /** A click on the rest of a finished card: open the note. */
  open: (path: string, ev: MouseEvent) => void;
}

/** Draws the `N done` line of one day, and the finished cards under it when `unfolded`. Nothing when the day has none. */
export function drawDone(parent: HTMLElement, finished: WeekCard[], unfolded: boolean, h: DoneHandlers): void {
  if (!finished.length) return;
  const box = parent.createDiv({ cls: "lk-board-donebox" });
  const line = box.createEl("button", { cls: "lk-board-donecount", text: `${finished.length} done`, attr: { type: "button", "aria-expanded": String(unfolded) } });
  line.addEventListener("click", h.toggle);
  if (!unfolded) return;
  const list = box.createDiv({ cls: "lk-board-donelist" });
  for (const c of finished) {
    const el = list.createDiv({ cls: "lk-board-card is-finished" });
    el.dataset.path = c.path;
    const top = el.createDiv({ cls: "lk-board-top" });
    const circle = top.createEl("button", { cls: "lk-board-done is-done", attr: { type: "button", "aria-label": "Mark not done" } });
    circle.addEventListener("click", ev => { ev.stopPropagation(); h.untick(c.path); });
    top.createSpan({ cls: "lk-board-title", text: c.title });
    el.addEventListener("click", ev => h.open(c.path, ev));
  }
}
