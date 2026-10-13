// Draws a project's card map (planning kit, `show: project-map`): cards in the vault theme, arrows behind them, the to-dos with no links in a list beside it.
// Layout: src/planning/plan-map.ts. Styles: `.vt-map*` in vault-theme.css.
import { Keymap, Menu, Notice, setIcon, type App, type PaneType } from "obsidian";
import { statusClass, type Plan, type PlanRow } from "./plan";
import { CARD_H, CARD_W, chainOf, mapGeometry, setDone, subsLabel, type Direction, type PlanMap } from "./plan-map";
import { changeAfter, changeSub, linkText, namesOf, undoNotice } from "./after-write";
import { addAfter, canLink, nestAction, removeAfter, type NestVerdict } from "./plan-link";
import { rememberText } from "./after-bridge";

export interface MapOptions {
  app: App;
  /** The note the map is drawn in (to resolve links). */
  sourcePath: string;
  /** Parents whose subtask list is open, kept by the block across redraws. */
  expanded: Set<string>;
  /** Which way the map runs (the setting, or what the toggle on the map was last set to for this note). */
  direction: Direction;
  /** How big the map is drawn: 1 = normal (for the open note, not saved). Left out = 1. */
  zoom?: number;
  /** Draws the map again (after a list was opened or closed). */
  redraw: () => void;
}

/** Opens a to-do: a click, Ctrl / Cmd-click for a new tab. */
/** Height of one subtask line, for the room under the map. */
const SUB_LINE_H = 26;
const stopEvent = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
const open = (o: MapOptions, path: string, newTab: PaneType | boolean): void => { void o.app.workspace.openLinkText(path, o.sourcePath, newTab); };

/** Ticks or unticks a to-do; the to-do engine stamps or clears `done_on` when it sees the change. */
async function markDone(o: MapOptions, path: string, done: boolean): Promise<void> {
  const file = o.app.vault.getFileByPath(path);
  if (!file) { new Notice("That to-do is not there any more."); return; }
  await o.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { setDone(fm, done); });
}

function menu(o: MapOptions, e: MouseEvent, row: PlanRow): void {
  e.preventDefault();
  const m = new Menu();
  m.addItem(i => i.setTitle("Open").setIcon("file").onClick(() => open(o, row.path, false)));
  m.addItem(i => i.setTitle("Open in new tab").setIcon("file-plus").onClick(() => open(o, row.path, true)));
  m.addItem(i => i.setTitle(row.done ? "Mark not done" : "Mark done").setIcon(row.done ? "circle" : "check").onClick(() => { void markDone(o, row.path, !row.done); }));
  m.addSeparator();
  m.addItem(i => i.setTitle("Delete note").setIcon("trash-2").onClick(() => {
    const file = o.app.vault.getFileByPath(row.path);
    if (!file) { new Notice("That to-do is not there any more."); return; }
    void o.app.vault.read(file).then(text => { rememberText(row.path, text); return o.app.fileManager.trashFile(file); }).catch(() => { new Notice("Could not delete that to-do."); });   // follows the user's trash setting; the links are passed on by src/planning/after-bridge.ts
  }));
  m.showAtMouseEvent(e);
}

/** Writes the link "`to` comes after `from`" (the arrow is drawn first by the caller) and offers Undo. */
async function link(o: MapOptions, from: string, to: string): Promise<void> {
  const text = linkText(o.app, from, to);
  await changeAfter(o.app, to, v => addAfter(v, text));
  undoNotice("Linked.", () => changeAfter(o.app, to, v => removeAfter(v, namesOf(from))));
}

/** Removes the link "`to` comes after `from`" and offers Undo. */
async function unlink(o: MapOptions, from: string, to: string): Promise<void> {
  const text = linkText(o.app, from, to);
  await changeAfter(o.app, to, v => removeAfter(v, namesOf(from)));
  undoNotice("Link removed.", () => changeAfter(o.app, to, v => addAfter(v, text)));
}

/** The map scrolls by itself while a drag is near its edge (`pointer` gives where it is now; `moved` runs after each step). Returns the function that stops it. */
function autoScroll(scroller: HTMLElement | null, pointer: () => { x: number; y: number }, moved: () => void): () => void {
  const EDGE = 48, STEP = 14;
  const id = window.setInterval(() => {
    if (!scroller) return;
    const b = scroller.getBoundingClientRect(), p = pointer();
    let did = false;
    if (p.x < b.left + EDGE) { scroller.scrollLeft -= STEP; did = true; } else if (p.x > b.right - EDGE) { scroller.scrollLeft += STEP; did = true; }
    if (p.y < b.top + EDGE) { scroller.scrollTop -= STEP; did = true; } else if (p.y > b.bottom - EDGE) { scroller.scrollTop += STEP; did = true; }
    if (did) moved();
  }, 30);
  return () => window.clearInterval(id);
}

/** Makes `dot` a handle: dragging from it onto another card or Not linked row makes that to-do come after `from`. A line follows the pointer; Esc cancels. */
function dragLink(wrap: HTMLElement, plan: Plan, o: MapOptions, dot: HTMLElement, from: string): void {
  const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
  dot.addEventListener("click", stop);
  dot.addEventListener("mousedown", stop);   // Live Preview opens a code block for editing on a click inside it
  dot.addEventListener("pointerdown", down => {
    if (down.button !== 0) return;
    stop(down);
    dot.setPointerCapture(down.pointerId);
    const ac = new AbortController();
    const at = (x: number, y: number): { x: number; y: number } => { const w = wrap.getBoundingClientRect(); return { x: x - w.left, y: y - w.top }; };
    const svg = wrap.createSvg("svg", { cls: "vt-map-overlay" });
    const line = svg.createSvg("line", { cls: "vt-map-drag" });
    let pointer = { x: down.clientX, y: down.clientY };
    let over: HTMLElement | null = null;
    const targetAt = (e: PointerEvent): HTMLElement | null => {
      const t = dot.ownerDocument.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-plan-path]") ?? null;
      return t && t.dataset.planPath !== from ? t : null;
    };
    const scroller = wrap.querySelector<HTMLElement>(".vt-map-scroll");
    const place = (): void => {   // the line runs from the dot (it moves when the map scrolls) to the pointer
      const d = dot.getBoundingClientRect(), s = at(d.left + d.width / 2, d.top + d.height / 2), p = at(pointer.x, pointer.y);
      line.setAttr("x1", String(s.x)); line.setAttr("y1", String(s.y)); line.setAttr("x2", String(p.x)); line.setAttr("y2", String(p.y));
      const t = dot.ownerDocument.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>("[data-plan-path]") ?? null;
      const target = t && t.dataset.planPath !== from ? t : null;
      if (target !== over) { over?.removeClass("vt-map-drop"); over = target; over?.addClass("vt-map-drop"); }
    };
    place();
    const stopScroll = autoScroll(scroller, () => pointer, place);
    const finish = (e: PointerEvent | null): void => {
      stopScroll();
      ac.abort();
      over?.removeClass("vt-map-drop");
      const target = e ? targetAt(e) : null, to = target?.dataset.planPath;
      if (!target || !to) { svg.remove(); return; }
      const verdict = canLink(plan, from, to);
      if (verdict !== "ok") {
        svg.remove();
        new Notice(verdict === "loop" ? "That would make a loop: the other to-do already comes before this one." : verdict === "already" ? "Already linked." : "A to-do cannot come after itself.");
        return;
      }
      const t = target.getBoundingClientRect(), end = at(t.left, t.top + t.height / 2);   // the arrow is drawn first and stays until the map redraws
      line.setAttr("x2", String(end.x)); line.setAttr("y2", String(end.y)); line.addClass("vt-map-pending");
      link(o, from, to).catch(() => { svg.remove(); new Notice("Could not link those to-dos."); });
    };
    dot.addEventListener("pointermove", e => { pointer = { x: e.clientX, y: e.clientY }; place(); }, { signal: ac.signal });
    dot.addEventListener("pointerup", e => finish(e), { signal: ac.signal });
    dot.addEventListener("pointercancel", () => finish(null), { signal: ac.signal });
    dot.ownerDocument.addEventListener("keydown", e => { if (e.key === "Escape") finish(null); }, { signal: ac.signal });
  });
}

const NEST_NO: Record<Exclude<NestVerdict, "ok">, string> = {
  self: "A to-do cannot be its own subtask.",
  already: "Already a subtask of that to-do.",
  "has-subs": "That to-do has subtasks of its own: subtasks go one level only.",
  "parent-is-sub": "That to-do is itself a subtask: subtasks go one level only.",
};

/** Makes `to-do from` a subtask of `to` (or, `to` null, clears it) and offers Undo. The card disappears from the map (a subtask lives in its parent's list), so its arrows do too: the notice says so. */
async function nest(o: MapOptions, plan: Plan, from: string, to: string | null): Promise<void> {
  let old: unknown;
  const row = plan.rows.find(r => r.path === from);
  const parent = to ? plan.rows.find(r => r.path === to) : undefined;
  const text = to ? linkText(o.app, to, from) : undefined;
  await changeSub(o.app, from, v => { old = v; return text; });
  const arrows = !!row && (row.afterPaths.length > 0 || plan.rows.some(r => r.afterPaths.includes(from)));
  undoNotice(to ? `Made a subtask of ${parent?.name ?? "that to-do"}.${arrows ? " Its arrows are hidden while it is a subtask." : ""}` : "Subtask cleared.", () => changeSub(o.app, from, () => old));
}

/** Makes `grip` a handle: dragging from it moves the whole to-do (`source` is its card or subtask line; a ghost follows the pointer). Dropped on another card it becomes that card's subtask; a subtask dropped on the map background stops being one. Under 5 px of movement it is a click and opens the note. Esc cancels. */
function dragNest(wrap: HTMLElement, plan: Plan, o: MapOptions, grip: HTMLElement, from: string, source: HTMLElement): void {
  grip.addEventListener("click", stopEvent);
  grip.addEventListener("mousedown", stopEvent);   // Live Preview opens a code block for editing on a click inside it
  grip.addEventListener("pointerdown", down => {
    const row = plan.rows.find(r => r.path === from);
    if (down.button !== 0 || !row) return;
    stopEvent(down);
    grip.setPointerCapture(down.pointerId);
    const ac = new AbortController();
    const at = (x: number, y: number): { x: number; y: number } => { const w = wrap.getBoundingClientRect(); return { x: x - w.left, y: y - w.top }; };
    const scroller = wrap.querySelector<HTMLElement>(".vt-map-scroll");
    let pointer = { x: down.clientX, y: down.clientY };
    let ghost: HTMLElement | null = null, over: HTMLElement | null = null, stopScroll: (() => void) | null = null;
    const hit = (): HTMLElement | null => {
      const t = grip.ownerDocument.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>("[data-plan-path]") ?? null;
      return t && t.dataset.planPath !== from ? t : null;
    };
    const place = (): void => {
      if (!ghost) return;
      const p = at(pointer.x, pointer.y);
      ghost.setCssProps({ "--vt-ghost-x": `${p.x}px`, "--vt-ghost-y": `${p.y}px` });
      const t = hit();
      if (t !== over) { over?.removeClass("vt-map-nest-drop"); over = t; over?.addClass("vt-map-nest-drop"); }
    };
    const begin = (): void => {
      ghost = wrap.createDiv({ cls: "vt-map-ghost", text: row.name });
      ghost.setCssProps({ "--vt-ghost-w": `${CARD_W * (o.zoom ?? 1)}px` });
      source.addClass("vt-map-lifted");
      stopScroll = autoScroll(scroller, () => pointer, place);
      place();
    };
    const finish = (e: PointerEvent | null): void => {
      if (e) pointer = { x: e.clientX, y: e.clientY };
      const dragged = ghost !== null, target = e ? hit() : null, w = wrap.getBoundingClientRect();
      const inside = pointer.x >= w.left && pointer.x <= w.right && pointer.y >= w.top && pointer.y <= w.bottom;
      stopScroll?.(); ac.abort();
      over?.removeClass("vt-map-nest-drop"); source.removeClass("vt-map-lifted"); ghost?.remove();
      if (!e) return;
      if (!dragged) { open(o, from, Keymap.isModEvent(e)); return; }
      const act = nestAction(plan, from, target?.dataset.planPath ?? null, inside && !target);
      if (act.do === "refuse") new Notice(NEST_NO[act.verdict]);
      else if (act.do === "nest" || act.do === "clear") nest(o, plan, from, act.do === "nest" ? act.to : null).catch(() => { new Notice("Could not change that to-do."); });
    };
    grip.addEventListener("pointermove", e => {
      pointer = { x: e.clientX, y: e.clientY };
      if (!ghost && Math.hypot(pointer.x - down.clientX, pointer.y - down.clientY) >= 5) begin(); else place();
    }, { signal: ac.signal });
    grip.addEventListener("pointerup", e => finish(e), { signal: ac.signal });
    grip.addEventListener("pointercancel", () => finish(null), { signal: ac.signal });
    grip.ownerDocument.addEventListener("keydown", e => { if (e.key === "Escape") finish(null); }, { signal: ac.signal });
  });
}

/** A parent's "▸ 2/3" toggle; a click opens or closes its list of subtasks. */
function subsToggle(parent: HTMLElement, row: PlanRow, o: MapOptions): void {
  const { text, allDone } = subsLabel(row);
  if (!text) return;
  const open = o.expanded.has(row.path);
  const b = parent.createEl("button", { cls: allDone ? "vt-map-subs-toggle vt-map-subsdone" : "vt-map-subs-toggle", text: `${open ? "\u25be" : "\u25b8"} ${allDone ? "\u2713 " : ""}${text}`, attr: { "aria-label": "Subtasks", title: allDone ? "All subtasks done" : "Subtasks" } });
  b.addEventListener("mousedown", stopEvent);
  b.addEventListener("click", e => { stopEvent(e); if (open) o.expanded.delete(row.path); else o.expanded.add(row.path); o.redraw(); });
}

/** The open list of a parent's subtasks: each with a tick circle (ticks and unticks) and its name (click opens). */
function subsList(parent: HTMLElement, row: PlanRow, o: MapOptions, cls: string, drag: { wrap: HTMLElement; plan: Plan }): void {
  const list = parent.createDiv({ cls });
  for (const ev of ["click", "mousedown", "contextmenu"]) list.addEventListener(ev, e => e.stopPropagation());   // not the parent card's open / menu
  for (const s of row.subs) {
    const line = list.createDiv({ cls: s.done ? "vt-map-sub vt-map-sub-done" : "vt-map-sub" });
    dragNest(drag.wrap, drag.plan, o, line.createDiv({ cls: "vt-map-grip vt-map-sub-grip", attr: { "aria-label": "Drag out to make it a plain to-do, or onto another to-do to move it" } }), s.path, line);
    let done = s.done;
    const tick = line.createEl("button", { cls: "vt-map-tick vt-map-sub-tick", attr: { "aria-label": "Mark done" } });
    const look = (): void => { setIcon(tick, done ? "check-circle-2" : "circle"); tick.setAttr("aria-label", done ? "Mark not done" : "Mark done"); line.toggleClass("vt-map-sub-done", done); };
    look();
    tick.addEventListener("mousedown", stopEvent);
    tick.addEventListener("click", e => { stopEvent(e); done = !done; look(); markDone(o, s.path, done).catch(() => { done = !done; look(); new Notice("Could not change that to-do."); }); });
    const a = line.createEl("a", { text: s.name, cls: "internal-link", attr: { href: s.path, "data-href": s.path } });
    a.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); open(o, s.path, Keymap.isModEvent(e)); });
    a.addEventListener("mousedown", e => e.stopPropagation());
  }
}

/** The map and the unlinked list inside `box`. The scroll box carries `data-start-scroll`: where to scroll once it is in the page. */
export function drawPlanMap(box: HTMLElement, plan: Plan, map: PlanMap, o: MapOptions): void {
  const wrap = box.createDiv({ cls: "vt-map" });
  if (map.cards.length) {
    const openLists = map.cards.filter(c => o.expanded.has(c.path) && c.row.subs.length);
    const g = mapGeometry(map, openLists.length ? Math.max(...openLists.map(c => c.row.subs.length)) * SUB_LINE_H + 12 : 0, o.direction);
    if (o.direction === "down") wrap.addClass("vt-map-down");
    const scroller = wrap.createDiv({ cls: "vt-map-scroll" });
    const canvas = scroller.createDiv({ cls: "vt-map-canvas" });
    if (g.scrollLeft > 0 || g.scrollTop > 0) scroller.createDiv({ cls: "vt-map-spacer" });   // room to scroll the start step to the edge even when everything fits
    canvas.setCssProps({ "--vt-map-w": `${g.width}px`, "--vt-map-h": `${g.height}px`, "--vt-map-card-w": `${CARD_W}px`, "--vt-map-card-h": `${CARD_H}px`, "--vt-map-zoom": String(o.zoom ?? 1) });
    const svg = canvas.createSvg("svg", { cls: "vt-map-arrows", attr: { width: String(g.width), height: String(g.height) } });
    const arrows = new Map<SVGPathElement, { from: string; to: string }>();
    for (const c of g.curves) {
      const visible = svg.createSvg("path", { cls: "vt-map-arrow", attr: { d: c.d } });
      arrows.set(visible, c);
      const hit = svg.createSvg("path", { cls: "vt-map-arrow-hit", attr: { d: c.d } });   // a wide invisible stroke to click on
      hit.addEventListener("click", e => {
        stopEvent(e);
        const m = new Menu();
        m.addItem(i => i.setTitle("Remove link").setIcon("unlink").onClick(() => {
          visible.addClass("vt-map-hidden"); hit.addClass("vt-map-hidden");
          unlink(o, c.from, c.to).catch(() => { visible.removeClass("vt-map-hidden"); hit.removeClass("vt-map-hidden"); new Notice("Could not remove that link."); });
        }));
        m.showAtMouseEvent(e);
      });
      hit.addEventListener("mousedown", stopEvent);
    }
    const cards = new Map<string, HTMLElement>();
    for (const c of map.cards) {
      const r = c.row, p = g.pos.get(c.path)!;
      const el = canvas.createDiv({ cls: ["vt-map-card", r.blocked ? "vt-map-blocked" : "", map.cyclic.has(c.path) ? "vt-map-cyclic" : ""].filter(Boolean).join(" ") });
      el.setCssProps({ "--vt-map-x": `${p.x}px`, "--vt-map-y": `${p.y}px` });
      el.dataset.planPath = c.path;
      dragNest(wrap, plan, o, el.createDiv({ cls: "vt-map-grip", attr: { "aria-label": "Drag onto another to-do to make it a subtask" } }), c.path, el);
      dragLink(wrap, plan, o, el.createDiv({ cls: "vt-map-handle", attr: { "aria-label": "Drag onto another to-do to link it after this one" } }), c.path);
      const tick = el.createEl("button", { cls: "vt-map-tick", attr: { "aria-label": r.done ? "Mark not done" : "Mark done" } });   // a circle: ticks and unticks, so a wrong tick can be undone
      let done = r.done;   // what the card shows now: it changes at the click, before the note's properties are saved and the map redraws
      const look = (): void => { setIcon(tick, done ? "check-circle-2" : "circle"); tick.setAttr("aria-label", done ? "Mark not done" : "Mark done"); el.toggleClass("vt-map-done", done); el.toggleClass("vt-map-ready", !done && !r.blocked); };
      look();
      const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
      tick.addEventListener("mousedown", stop);
      tick.addEventListener("click", e => {
        stop(e);
        done = !done; look();
        markDone(o, r.path, done).catch(() => { done = !done; look(); new Notice("Could not change that to-do."); });
      });
      el.createDiv({ cls: "vt-map-title", text: r.name });
      const meta = el.createDiv({ cls: "vt-map-meta" });
      if (r.priority) meta.createSpan({ cls: "vt-badge vt-planned", text: `P${r.priority}` });
      if (r.due) meta.createSpan({ cls: "vt-muted", text: r.due });
      if (r.blocked) meta.createSpan({ cls: "vt-muted", text: "blocked" });
      const exp = r.experiment;
      if (exp) {   // the experiment: its status and name; a click on the row opens the lab note (no note found: the name alone)
        const row = el.createDiv({ cls: exp.path ? "vt-map-exp" : "vt-map-exp vt-map-exp-missing", attr: { title: exp.name } });
        if (exp.status) row.createSpan({ cls: `vt-badge ${statusClass(exp.status)}`, text: exp.status });
        row.createSpan({ cls: "vt-map-exp-name", text: exp.name });
        if (exp.path) row.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); open(o, exp.path, Keymap.isModEvent(e)); });
      }
      if (r.result) el.createDiv({ cls: "vt-muted vt-map-result", text: `→ ${r.result}`, attr: { title: r.result } });   // cut with an ellipsis (clear of the subtask toggle); the whole text on hover
      if (r.subs.length) el.addClass("vt-map-has-subs");
      subsToggle(el, r, o);
      if (o.expanded.has(c.path) && r.subs.length) subsList(el, r, o, "vt-map-subs", { wrap, plan });
      el.addEventListener("click", e => { e.preventDefault(); open(o, r.path, Keymap.isModEvent(e)); });
      el.addEventListener("contextmenu", e => menu(o, e, r));
      el.addEventListener("mouseenter", () => {   // the card and everything before and after it; the rest is dimmed (desktop only: a phone has no hover)
        const chain = chainOf(plan, c.path);
        for (const [path, other] of cards) { const on = path === c.path || chain.has(path); other.toggleClass("vt-map-hl", on); other.toggleClass("vt-map-dim", !on); }
        for (const [a, link] of arrows) { const on = (link.from === c.path || chain.has(link.from)) && (link.to === c.path || chain.has(link.to)); a.classList.toggle("vt-map-hl", on); a.classList.toggle("vt-map-dim", !on); }
      });
      el.addEventListener("mouseleave", () => {
        for (const other of cards.values()) { other.removeClass("vt-map-hl"); other.removeClass("vt-map-dim"); }
        for (const a of arrows.keys()) { a.classList.remove("vt-map-hl", "vt-map-dim"); }
      });
      cards.set(c.path, el);
    }
    const z = o.zoom ?? 1;   // the start positions are in map pixels; the scroll box counts the zoomed ones
    scroller.dataset.startScroll = String(g.scrollLeft * z);
    scroller.dataset.startScrollTop = String(g.scrollTop * z);
    scroller.dataset.mapWidth = String(g.width);
  }
  if (map.unlinked.length) {
    const side = wrap.createDiv({ cls: "vt-map-unlinked" });
    side.createDiv({ cls: "vt-map-unlinked-title", text: "Not linked" });
    const ul = side.createEl("ul");
    for (const r of map.unlinked) {
      const li = ul.createEl("li", { cls: "vt-map-unlinked-row" });
      li.dataset.planPath = r.path;
      dragLink(wrap, plan, o, li.createDiv({ cls: "vt-map-handle", attr: { "aria-label": "Drag onto another to-do to link it after this one" } }), r.path);
      const a = li.createEl("a", { text: r.name, cls: "internal-link", attr: { href: r.path, "data-href": r.path } });
      a.addEventListener("click", e => { e.preventDefault(); open(o, r.path, Keymap.isModEvent(e)); });
      a.addEventListener("contextmenu", e => menu(o, e, r));
      subsToggle(li, r, o);
      if (o.expanded.has(r.path) && r.subs.length) subsList(li, r, o, "vt-map-subs vt-map-subs-inline", { wrap, plan });
    }
  }
}
