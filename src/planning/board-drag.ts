// Pointer-event drag for the to-do board (Board-B Phase 2): one code path for mouse, pen and touch.
// Pure rules first (tested in tests/board-drag.test.ts), then the DOM wiring. Plan: docs/plans/board-own-view.md.

/** A touch must rest this long before the card lifts; until then the finger scrolls the page (ms). */
export const LONG_PRESS_MS = 350;
/** Mouse and pen: the card lifts after this much movement (px). */
export const DRAG_START_PX = 5;
/** Touch: moving farther than this before the long press ends means a scroll or a swipe, not a drag (px). */
export const MOVE_SLOP_PX = 10;
const EDGE = 48, STEP = 14;

export type PressState = "wait" | "drag" | "abandon";

/** What a press does after `ms` milliseconds and `dist` px of movement. Touch: still within the slop at the long press → drag; moved farther earlier → abandon. Mouse / pen: drag from DRAG_START_PX of movement. */
export function pressState(kind: string, ms: number, dist: number): PressState {
  if (kind !== "touch") return dist >= DRAG_START_PX ? "drag" : "wait";
  if (dist > MOVE_SLOP_PX) return ms >= LONG_PRESS_MS ? "drag" : "abandon";
  return ms >= LONG_PRESS_MS ? "drag" : "wait";
}

export interface Zone { key: string; left: number; top: number; right: number; bottom: number }

/** The key of the first zone that contains the point, or null. Zones with no area (hidden) never match. */
export function targetAt(zones: Zone[], x: number, y: number): string | null {
  for (const z of zones) if (z.right > z.left && z.bottom > z.top && x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) return z.key;
  return null;
}

/** How far to scroll this step: sideways near the left / right edge, up / down near the top / bottom edge, only while the pointer is inside the box. */
export function edgeStep(r: { left: number; top: number; right: number; bottom: number }, x: number, y: number): { dx: number; dy: number } {
  const inX = x >= r.left && x <= r.right, inY = y >= r.top && y <= r.bottom;
  const dx = inY ? (x < r.left + EDGE ? -STEP : x > r.right - EDGE ? STEP : 0) : 0;
  const dy = inX ? (y < r.top + EDGE ? -STEP : y > r.bottom - EDGE ? STEP : 0) : 0;
  return { dx, dy };
}

/** The zone key (a column's date, YYYY-MM-DD, or "Backlog") a drag ends on: null when cancelled, dropped outside every zone, or dropped where the card already is. */
export function dropDay(fromKey: string, toKey: string | null, cancelled: boolean): string | null {
  return cancelled || !toKey || toKey === fromKey ? null : toKey;
}

/** Phone layout: a swipe of this many px, clearly more sideways than down, changes the day. */
export const SWIPE_PX = 60;

/** 1 for a swipe left (next day), -1 for a swipe right (previous day), 0 when it was not a sideways swipe. */
export function swipeDir(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** The day `dir` steps from `cur` in `days`; stays put at either end (no wrap-around). */
export function stepDay(days: string[], cur: string, dir: -1 | 1): string {
  const i = days.indexOf(cur);
  return i < 0 ? cur : days[Math.min(days.length - 1, Math.max(0, i + dir))];
}

let lastEnd = 0;
/** True for a moment after a drag, so the click that follows it does not open the note. */
export const dragJustEnded = (): boolean => Date.now() - lastEnd < 400;

export interface DragHooks {
  /** The board's root (the ghost itself goes on the window's body, see `begin`). */
  root: HTMLElement;
  /** Drop on `key`: a column's or day tab's date (YYYY-MM-DD) or the tray's "Backlog". A zone marked `data-past` is never highlighted, but a drop on it is still passed on (the board answers with a notice). */
  onDrop: (path: string, key: string) => void;
  /** A drag started (true) or ended (false): the board postpones redraws while it is on. */
  onState: (on: boolean) => void;
}

const zoneEls = (root: HTMLElement): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>("[data-drop]"));

/** The nearest ancestor that scrolls up and down (the note view the board sits in), or null. */
function pageScroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Makes `card` draggable by pointer. The card must sit inside an element with `data-drop` (its own zone); zones are the `[data-drop]` elements under `h.root`. */
export function attachCardDrag(card: HTMLElement, path: string, title: string, h: DragHooks): void {
  let on = false;
  card.addEventListener("touchmove", ev => { if (on && ev.cancelable) ev.preventDefault(); }, { passive: false });
  card.addEventListener("contextmenu", ev => { if (on) ev.preventDefault(); });
  card.addEventListener("pointerdown", down => {
    if (down.button !== 0 || (down.target as HTMLElement).closest(".lk-board-done")) return;
    const doc = card.ownerDocument;
    const from = card.closest<HTMLElement>("[data-drop]")?.dataset.drop ?? "";
    const ac = new AbortController();
    const t0 = Date.now();
    let pos = { x: down.clientX, y: down.clientY };
    let ghost: HTMLElement | null = null, over: HTMLElement | null = null, marker: HTMLElement | null = null;
    let timer = 0, scrollTimer = 0;
    const dist = (): number => Math.hypot(pos.x - down.clientX, pos.y - down.clientY);
    const hit = (): HTMLElement | null => {
      const els = zoneEls(h.root);
      const zones = els.map(e => { const b = e.getBoundingClientRect(); return { key: e.dataset.drop ?? "", left: b.left, top: b.top, right: b.right, bottom: b.bottom }; });
      return els[zones.findIndex(z => targetAt([z], pos.x, pos.y) !== null)] ?? null;
    };
    const place = (): void => {
      if (!ghost) return;
      ghost.setCssProps({ "--lk-ghost-x": `${pos.x}px`, "--lk-ghost-y": `${pos.y}px` });
      const t = hit();
      const next = t && t.dataset.drop !== from && t.dataset.past === undefined ? t : null;
      if (next === over) return;
      over?.removeClass("is-over"); marker?.remove(); marker = null;
      over = next;
      if (!over) return;
      over.addClass("is-over");
      const list = over.querySelector<HTMLElement>(".lk-board-list, .lk-board-trayrow");
      if (list) marker = list.createDiv({ cls: "lk-board-marker" });
    };
    const scrollStep = (): void => {
      const row = h.root.querySelector<HTMLElement>(".lk-board-trayrow"), page = pageScroller(h.root);
      if (row) row.scrollLeft += edgeStep(row.getBoundingClientRect(), pos.x, pos.y).dx;
      if (page) page.scrollTop += edgeStep(page.getBoundingClientRect(), pos.x, pos.y).dy;
      place();
    };
    const begin = (): void => {
      on = true;
      h.onState(true);
      const b = card.getBoundingClientRect();
      // On the window's body, not the board: `position: fixed` inside an Obsidian pane is measured from the pane (it makes its own containing block),
      // so the ghost sat a sidebar's width away from the cursor (owner, 2026-10-21). ownerDocument keeps a pop-out window's own body.
      ghost = card.ownerDocument.body.createDiv({ cls: "lk-board-ghost", text: title });
      ghost.setCssProps({ "--lk-ghost-w": `${b.width}px` });
      card.addClass("is-lifted");
      scrollTimer = window.setInterval(scrollStep, 30);
      place();
    };
    const finish = (cancelled: boolean): void => {
      window.clearTimeout(timer); window.clearInterval(scrollTimer); ac.abort();
      const wasOn = on;
      const to = (over ?? (cancelled ? null : hit()))?.dataset.drop ?? null;   // not highlighted: a past day
      over?.removeClass("is-over"); marker?.remove(); ghost?.remove(); card.removeClass("is-lifted");
      on = false;
      if (!wasOn) return;
      lastEnd = Date.now();
      const day = dropDay(from, to, cancelled);
      if (day) h.onDrop(path, day);
      h.onState(false);
    };
    const check = (): void => {
      if (on) return;
      const s = pressState(down.pointerType, Date.now() - t0, dist());
      if (s === "drag") begin(); else if (s === "abandon") finish(true);
    };
    if (down.pointerType === "touch") timer = window.setTimeout(check, LONG_PRESS_MS);
    doc.addEventListener("pointermove", e => {
      if (e.pointerId !== down.pointerId) return;
      pos = { x: e.clientX, y: e.clientY };
      if (on) place(); else check();
    }, { signal: ac.signal });
    doc.addEventListener("pointerup", e => { if (e.pointerId === down.pointerId) { pos = { x: e.clientX, y: e.clientY }; finish(false); } }, { signal: ac.signal });
    doc.addEventListener("pointercancel", e => { if (e.pointerId === down.pointerId) finish(true); }, { signal: ac.signal });
    doc.addEventListener("keydown", e => { if (e.key === "Escape") finish(true); }, { signal: ac.signal });
  });
}
