// Draws a project's card map (planning kit, `show: project-map`): cards in the vault theme, arrows behind them, the to-dos with no links in a list beside it.
// Layout: src/planning/plan-map.ts. Styles: `.vt-map*` in styles.css.
import { Keymap, Menu, Notice, setIcon, type App, type PaneType } from "obsidian";
import { statusClass, type Plan, type PlanFix, type PlanIssue, type PlanRow } from "./plan";
import { CARD_H, CARD_W, chainOf, mapGeometry, openSubs, subsLabel, type Direction, type PlanMap } from "./plan-map";
import { linkText, namesOf, recordChange, recordTick, runHistory, undoNotice } from "./after-write";
import type { HistoryStep, PlanHistory } from "./plan-history";
import { askTickSubs, type TickChoice } from "./tick-subs-ui";
import { addAfter, canLink, nestAction, removeAfter, removeItem, type NestVerdict } from "./plan-link";
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
  /** The note's Undo / Redo steps (kept by the block's owner, so a redraw or a switch of view keeps them). */
  history: PlanHistory;
  /** The problems list under the map is open (it is hidden until opened, or until something is refused because of a problem). */
  problemsOpen: boolean;
  /** Opens or closes the problems list and draws the map again. */
  showProblems: (open: boolean) => void;
  /** "+ add after this": dropped on the box that shows while a node is dragged; asks which to-do comes after `from` (search the vault, or make a new one). Left out: no box. */
  addAfter?: (from: string) => void;
  /** Draws the map again (after a list was opened or closed). */
  redraw: () => void;
}

/** Opens a to-do: a click, Ctrl / Cmd-click for a new tab. */
/** Height of one subtask line, for the room under the map. */
const SUB_LINE_H = 26;
const stopEvent = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
const open = (o: MapOptions, path: string, newTab: PaneType | boolean): void => { void o.app.workspace.openLinkText(path, o.sourcePath, newTab); };

/** Ticks or unticks a to-do and puts it in the Undo / Redo steps; the to-do engine stamps or clears `done_on` when it sees the change. */
async function markDone(o: MapOptions, path: string, done: boolean, name: string, group?: number): Promise<void> {
  if (!o.app.vault.getFileByPath(path)) { new Notice("That to-do is not there any more."); return; }
  await recordTick(o.app, o.history, path, done, `${done ? "Ticked" : "Unticked"} ${name}`, group);
}

/** Ticking `row`: when it has open subtasks, asks whether to tick them too (never blocks). */
async function askTick(o: MapOptions, row: PlanRow): Promise<TickChoice> {
  const open = openSubs(row);
  return open.length ? askTickSubs(o.app, row.name, open.map(s => s.name)) : "one";
}

let tickGroup = 0;
/** Ticks `row` and, for "all", its open subtasks too: one step in the Undo / Redo buttons for the lot, and a notice with Undo. */
async function tickAs(o: MapOptions, row: PlanRow, choice: TickChoice): Promise<void> {
  if (choice !== "all") { await markDone(o, row.path, true, row.name); return; }
  const open = openSubs(row), group = ++tickGroup;
  await recordTick(o.app, o.history, row.path, true, `Ticked ${open.length + 1} to-dos`, group);
  let first: HistoryStep | undefined;
  for (const sb of open) { const st = await recordTick(o.app, o.history, sb.path, true, `Ticked ${open.length + 1} to-dos`, group); first ??= st; }
  const step = first ?? o.history.peek("undo");
  if (step) undoNotice(`Ticked ${open.length + 1} to-dos.`, () => runHistory(o.app, o.history, "undo", step));
}

function menu(o: MapOptions, e: MouseEvent, row: PlanRow, plan?: Plan): void {
  e.preventDefault();
  const m = new Menu();
  m.addItem(i => i.setTitle("Open").setIcon("file").onClick(() => open(o, row.path, false)));
  m.addItem(i => i.setTitle("Open in new tab").setIcon("file-plus").onClick(() => open(o, row.path, true)));
  m.addItem(i => i.setTitle(row.done ? "Mark not done" : "Mark done").setIcon(row.done ? "circle" : "check").onClick(() => {
    if (row.done) { void markDone(o, row.path, false, row.name); return; }
    askTick(o, row).then(c => (c === "cancel" ? undefined : tickAs(o, row, c))).catch(() => { new Notice("Could not change that to-do."); });
  }));
  if (row.parent && plan) m.addItem(i => i.setTitle("Remove from parent").setIcon("corner-up-left").onClick(() => { nest(o, plan, row.path, null).catch(() => { new Notice("Could not change that to-do."); }); }));
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
  const step = await recordChange(o.app, o.history, to, "after", "Linked", v => addAfter(v, text));
  undoNotice("Linked.", () => runHistory(o.app, o.history, "undo", step));
}

/** Removes the link "`to` comes after `from`" and offers Undo. */
async function unlink(o: MapOptions, from: string, to: string): Promise<void> {
  const step = await recordChange(o.app, o.history, to, "after", "Link removed", v => removeAfter(v, namesOf(from)));
  undoNotice("Link removed.", () => runHistory(o.app, o.history, "undo", step));
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

const ADD_W = 130, ADD_H = 54;

/** Where the "+ add after this" box goes while `source` (the card or tile being dragged from) is dragged: right of it (below it in the top-to-bottom layout) when that spot is free, else the other side, else the right edge of the map. In client coordinates. */
function addBoxSpot(wrap: HTMLElement, source: HTMLElement, direction: Direction): { x: number; y: number } {
  const w = wrap.getBoundingClientRect(), s = source.getBoundingClientRect();
  const others: DOMRect[] = [];
  wrap.querySelectorAll<HTMLElement>("[data-plan-path]").forEach(el => { if (el !== source) others.push(el.getBoundingClientRect()); });
  const right = { x: s.right + 16, y: s.top + (s.height - ADD_H) / 2 }, below = { x: s.left + (s.width - ADD_W) / 2, y: s.bottom + 16 };
  const edge = { x: w.right - ADD_W - 12, y: Math.min(Math.max(s.top, w.top), w.bottom - ADD_H) };
  const free = (p: { x: number; y: number }): boolean => p.x >= w.left && p.y >= w.top && p.x + ADD_W <= w.right && p.y + ADD_H <= w.bottom
    && !others.some(o => p.x < o.right + 6 && p.x + ADD_W > o.left - 6 && p.y < o.bottom + 6 && p.y + ADD_H > o.top - 6);
  return [direction === "down" ? below : right, direction === "down" ? right : below].find(free) ?? edge;
}

/** Makes `dot` a handle: dragging from it onto another card or Not linked row makes that to-do come after `from`; onto the "+ add after this" box that shows meanwhile asks for one (or a new one). A line follows the pointer; Esc cancels. */
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
    let addBox: HTMLElement | null = null;
    if (o.addAfter && dot.parentElement) {
      const spot = addBoxSpot(wrap, dot.parentElement, o.direction), p0 = at(spot.x, spot.y);
      addBox = wrap.createDiv({ cls: "vt-map-addbox", text: "+ add after this" });
      addBox.setCssProps({ "--vt-add-x": `${p0.x}px`, "--vt-add-y": `${p0.y}px`, "--vt-add-w": `${ADD_W}px`, "--vt-add-h": `${ADD_H}px` });
    }
    const overBox = (): boolean => !!addBox && dot.ownerDocument.elementFromPoint(pointer.x, pointer.y)?.closest(".vt-map-addbox") === addBox;
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
      addBox?.toggleClass("vt-map-drop", overBox());
    };
    place();
    const stopScroll = autoScroll(scroller, () => pointer, place);
    const finish = (e: PointerEvent | null): void => {
      stopScroll();
      ac.abort();
      over?.removeClass("vt-map-drop");
      if (e) pointer = { x: e.clientX, y: e.clientY };
      const onBox = !!e && overBox();
      addBox?.remove();
      if (onBox) { svg.remove(); o.addAfter?.(from); return; }
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

/** Why a drop onto `parent` was refused, in words: what is wrong and what to do. */
function nestNo(verdict: Exclude<NestVerdict, "ok">, plan: Plan, parent: string): string {
  const p = plan.rows.find(r => r.path === parent);
  const name = p?.name ?? "That to-do", via = p?.subOf ? plan.rows.find(r => r.path === p.subOf)?.name : undefined;
  switch (verdict) {
    case "self": return "A to-do cannot be its own subtask.";
    case "already": return "Already a subtask of that to-do.";
    case "has-subs": return "That to-do has subtasks of its own: subtasks go one level only.";
    case "parent-is-sub": return `"${name}" is itself a subtask: subtasks go one level only. Drop it on "${plan.rows.find(r => r.path === p?.parent)?.name ?? "its parent"}" instead.`;
    case "parent-bad-sub": return `"${name}" can't take subtasks: it is a subtask of ${via ? `"${via}"` : "another to-do"}, which is itself a subtask. Fix it in the problems list below, then try again.`;
  }
}

/** Makes `to-do from` a subtask of `to` (or, `to` null, clears it) and offers Undo. The card disappears from the map (a subtask lives in its parent's list), so its arrows do too: the notice says so. */
async function nest(o: MapOptions, plan: Plan, from: string, to: string | null): Promise<void> {
  const row = plan.rows.find(r => r.path === from);
  const parent = to ? plan.rows.find(r => r.path === to) : undefined;
  const text = to ? linkText(o.app, to, from) : undefined;
  const step = await recordChange(o.app, o.history, from, "sub", to ? "Made a subtask" : "Subtask cleared", () => text);
  const arrows = !!row && (row.afterPaths.length > 0 || plan.rows.some(r => r.afterPaths.includes(from)));
  undoNotice(to ? `Made a subtask of ${parent?.name ?? "that to-do"}.${arrows ? " Its arrows are hidden while it is a subtask." : ""}` : "Subtask cleared.", () => runHistory(o.app, o.history, "undo", step));
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
      if (act.do === "refuse") { new Notice(nestNo(act.verdict, plan, target?.dataset.planPath ?? ""), 10000); if (act.verdict === "parent-bad-sub") o.showProblems(true); }
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
  const b = parent.createEl("button", { cls: allDone ? "vt-map-subs-toggle vt-map-subsdone" : row.done ? "vt-map-subs-toggle vt-map-subsopen" : "vt-map-subs-toggle", text: `${open ? "\u25be" : "\u25b8"} ${allDone ? "\u2713 " : ""}${text}`, attr: { "aria-label": "Subtasks", title: allDone ? "All subtasks done" : "Subtasks" } });
  b.addEventListener("mousedown", stopEvent);
  b.addEventListener("click", e => { stopEvent(e); if (open) o.expanded.delete(row.path); else o.expanded.add(row.path); o.redraw(); });
}

/** The open list of a parent's subtasks: each with a tick circle (ticks and unticks) and its name (click opens). */
function subsList(parent: HTMLElement, row: PlanRow, o: MapOptions, cls: string, drag: { wrap: HTMLElement; plan: Plan }): void {
  const list = parent.createDiv({ cls });
  for (const ev of ["click", "mousedown", "contextmenu"]) list.addEventListener(ev, e => e.stopPropagation());   // not the parent card's open / menu
  for (const s of row.subs) {
    const line = list.createDiv({ cls: s.done ? "vt-map-sub vt-map-sub-done" : row.done ? "vt-map-sub vt-map-sub-missing" : "vt-map-sub" });   // missing: the parent is finished and this is not
    dragNest(drag.wrap, drag.plan, o, line.createDiv({ cls: "vt-map-grip vt-map-sub-grip", attr: { "aria-label": "Drag out or onto a to-do" } }), s.path, line);
    let done = s.done;
    const tick = line.createEl("button", { cls: "vt-map-tick vt-map-sub-tick", attr: { "aria-label": "Mark done" } });
    const look = (): void => { setIcon(tick, done ? "check-circle-2" : "circle"); tick.setAttr("aria-label", done ? "Mark not done" : "Mark done"); line.toggleClass("vt-map-sub-done", done); };
    look();
    tick.addEventListener("mousedown", stopEvent);
    tick.addEventListener("click", e => { stopEvent(e); done = !done; look(); markDone(o, s.path, done, s.name).catch(() => { done = !done; look(); new Notice("Could not change that to-do."); }); });
    const a = line.createEl("a", { text: s.name, cls: "internal-link", attr: { href: s.path, "data-href": s.path } });
    line.addEventListener("contextmenu", e => { const sr = drag.plan.rows.find(x => x.path === s.path); if (sr) menu(o, e, sr, drag.plan); });
    a.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); open(o, s.path, Keymap.isModEvent(e)); });
    a.addEventListener("mousedown", e => e.stopPropagation());
  }
}

/** The tick circle of a card or tile: ticks and unticks, so a wrong tick can be undone. `card`: also marks the card ready (open and not blocked). */
function tickButton(el: HTMLElement, r: PlanRow, o: MapOptions, card: boolean): void {
  const tick = el.createEl("button", { cls: "vt-map-tick", attr: { "aria-label": r.done ? "Mark not done" : "Mark done" } });
  let done = r.done;   // what it shows now: it changes at the click, before the note's properties are saved and the map redraws
  const look = (): void => { setIcon(tick, done ? "check-circle-2" : "circle"); tick.setAttr("aria-label", done ? "Mark not done" : "Mark done"); el.toggleClass("vt-map-done", done); if (card) el.toggleClass("vt-map-ready", !done && !r.blocked); };
  look();
  tick.addEventListener("mousedown", stopEvent);
  tick.addEventListener("click", e => {
    stopEvent(e);
    if (done) { done = false; look(); markDone(o, r.path, false, r.name).catch(() => { done = true; look(); new Notice("Could not change that to-do."); }); return; }
    askTick(o, r).then(c => {   // with open subtasks the answer comes first; the circle changes only after it
      if (c === "cancel") return undefined;
      done = true; look();
      return tickAs(o, r, c);
    }).catch(() => { done = false; look(); new Notice("Could not change that to-do."); });
  });
}

/** One problem as a line: the plain sentence, a button for each fix, and one to open the note (or each note). */
function issueLine(parent: HTMLElement, plan: Plan, o: MapOptions, is: PlanIssue): HTMLElement {
  const line = parent.createDiv({ cls: "vt-map-issue" });
  line.dataset.issue = String(plan.issues.indexOf(is));   // the ⚠ of its card or tile finds the line by this
  line.createSpan({ cls: "vt-muted", text: is.text });
  const bar = line.createSpan({ cls: "vt-map-issue-btns" });
  const button = (text: string, hint: string, run: (e: MouseEvent, b: HTMLButtonElement) => void): void => {
    const b = bar.createEl("button", { cls: "vt-map-dir vt-map-fix", text, attr: { "aria-label": hint } });
    b.addEventListener("mousedown", stopEvent);
    b.addEventListener("click", e => { stopEvent(e); run(e, b); });
  };
  for (const f of is.fixes) button(f.label, f.does, (_e, b) => { b.disabled = true; fixIssue(o, f).catch(() => { b.disabled = false; new Notice("Could not fix that."); }); });
  for (const p of is.paths.slice(0, 3)) button(is.paths.length > 1 ? `Open "${plan.rows.find(x => x.path === p)?.name ?? "note"}"` : "Open note", "Opens the note so you can look at it", e => { open(o, p, Keymap.isModEvent(e)); });
  return line;
}

/** The problems under the map: one row ("3 problems", Show / Hide) until it is opened; open, one line each. Hovering a line marks the card or tile it is about. */
export function drawProblems(box: HTMLElement, plan: Plan, o: MapOptions): void {
  if (!plan.issues.length) return;
  const head = box.createDiv({ cls: "vt-map-issues-head" });
  setIcon(head.createSpan({ cls: "vt-map-warnmark" }), "alert-triangle");
  head.createSpan({ cls: "vt-muted", text: `${plan.issues.length} ${plan.issues.length === 1 ? "problem" : "problems"} in this plan` });
  const toggle = head.createEl("button", { cls: "vt-map-dir vt-map-fix", text: o.problemsOpen ? "Hide" : "Show" });
  toggle.addEventListener("mousedown", stopEvent);
  toggle.addEventListener("click", e => { stopEvent(e); o.showProblems(!o.problemsOpen); });
  if (!o.problemsOpen) return;
  const mark = (is: PlanIssue, on: boolean): void => { box.querySelectorAll<HTMLElement>("[data-plan-path]").forEach(el => { if (is.paths.includes(el.dataset.planPath ?? "")) el.toggleClass("vt-map-flag", on); }); };
  for (const is of plan.issues) {
    const line = issueLine(box, plan, o, is);
    const both = (on: boolean): void => { mark(is, on); line.toggleClass("vt-map-flag", on); };   // the line and its card or tile light up together
    line.addEventListener("mouseenter", () => both(true));
    line.addEventListener("mouseleave", () => both(false));
  }
}

/** A box with a card's or tile's problems and their fix buttons, under its ⚠; it closes on a click outside, on Esc, and when the map redraws. */
function issuePopup(wrap: HTMLElement, anchor: HTMLElement, plan: Plan, o: MapOptions, issues: PlanIssue[]): void {
  wrap.querySelector(".vt-map-pop")?.remove();
  const pop = wrap.createDiv({ cls: "vt-map-pop" });
  for (const is of issues) issueLine(pop, plan, o, is);
  const w = wrap.getBoundingClientRect(), a = anchor.getBoundingClientRect();
  pop.setCssProps({ "--vt-pop-x": `${Math.max(0, Math.min(a.left - w.left, w.width - 470))}px`, "--vt-pop-y": `${a.bottom - w.top + 4}px` });
  const ac = new AbortController();
  const close = (): void => { pop.remove(); ac.abort(); };
  const doc = anchor.ownerDocument;
  doc.addEventListener("mousedown", e => { if (!pop.contains(e.target as Node)) close(); }, { signal: ac.signal, capture: true });
  doc.addEventListener("keydown", e => { if (e.key === "Escape") close(); }, { signal: ac.signal });
}

/** A ⚠ on a card or tile whose note has problems: hover for what, click for the fixes. */
function warnMark(box: HTMLElement, wrap: HTMLElement, el: HTMLElement, plan: Plan, o: MapOptions, issues: PlanIssue[] | undefined): void {
  if (!issues?.length) return;
  el.addClass("vt-map-warn");
  const text = issues.map(i => i.text).join("\n");
  const mark = el.createDiv({ cls: "vt-map-warnmark", attr: { "aria-label": text } });   // Obsidian's tooltip only: a `title` too would show a second one
  const both = (on: boolean): void => {   // the card or tile and its problem lines light up together, as they do when a line is hovered
    el.toggleClass("vt-map-flag", on);
    box.querySelectorAll<HTMLElement>("[data-issue]").forEach(l => { if (issues.some(i => String(plan.issues.indexOf(i)) === l.dataset.issue)) l.toggleClass("vt-map-flag", on); });
  };
  el.addEventListener("mouseenter", () => both(true));   // anywhere on the card or tile, not only on the small ⚠
  el.addEventListener("mouseleave", () => both(false));
  setIcon(mark, "alert-triangle");
  mark.addEventListener("mousedown", stopEvent);
  mark.addEventListener("click", e => { stopEvent(e); issuePopup(wrap, mark, plan, o, issues); });
}

/** Clears the property a fix names (for `after`: only the one dead link); one step in Undo / Redo, and a notice with Undo. */
async function fixIssue(o: MapOptions, f: PlanFix): Promise<void> {
  const step = await recordChange(o.app, o.history, f.path, f.key, f.label, f.key === "after" ? v => removeItem(v, f.target ?? "") : () => undefined);
  undoNotice(f.done, () => runHistory(o.app, o.history, "undo", step));
}

/** The map and the unlinked tiles inside `box`. The scroll box carries `data-start-scroll`: where to scroll once it is in the page. */
export function drawPlanMap(box: HTMLElement, plan: Plan, map: PlanMap, o: MapOptions): void {
  const wrap = box.createDiv({ cls: "vt-map" });
  const flagged = new Map<string, PlanIssue[]>();   // the problems of each to-do that has any: its ⚠
  for (const is of plan.issues) for (const p of is.paths) flagged.set(p, [...(flagged.get(p) ?? []), is]);
  if (map.cards.length) {
    const openLists = map.cards.filter(c => o.expanded.has(c.path) && c.row.subs.length);
    const g = mapGeometry(map, openLists.length ? Math.max(...openLists.map(c => c.row.subs.length)) * SUB_LINE_H + 12 : 0, o.direction);
    if (o.direction === "down") wrap.addClass("vt-map-down");
    const scroller = wrap.createDiv({ cls: "vt-map-scroll" });
    const canvas = scroller.createDiv({ cls: "vt-map-canvas" });
    canvas.setCssProps({ "--vt-map-w": `${g.width}px`, "--vt-map-h": `${g.height}px`, "--vt-map-card-w": `${CARD_W}px`, "--vt-map-card-h": `${CARD_H}px`, "--vt-map-zoom": String(o.zoom ?? 1) });
    const svg = canvas.createSvg("svg", { cls: "vt-map-arrows", attr: { width: String(g.width), height: String(g.height) } });
    const arrows = new Map<SVGPathElement, { from: string; to: string }>();
    for (const c of g.curves) {
      const visible = svg.createSvg("path", { cls: "vt-map-arrow", attr: { d: c.d } });
      if (c.via) visible.addClass("vt-map-arrow-via");   // one class in `cls`: createSvg may refuse a class with a space, and a throw empties the whole block
      arrows.set(visible, c);
      if (c.via) continue;   // drawn to the parent card for a subtask's link: not a link of its own, so nothing to remove here
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
      dragNest(wrap, plan, o, el.createDiv({ cls: "vt-map-grip", attr: { "aria-label": "Drag onto a to-do to make a subtask" } }), c.path, el);
      dragLink(wrap, plan, o, el.createDiv({ cls: "vt-map-handle", attr: { "aria-label": "Drag onto another to-do to link it after this one" } }), c.path);
      tickButton(el, r, o, true);
      warnMark(box, wrap, el, plan, o, flagged.get(c.path));
      el.createDiv({ cls: "vt-map-title", text: r.name, attr: { title: r.name } });
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
  if (map.unlinked.length) {   // small tiles in a wrapping grid: the strip (subtask drag) on the left, the node ("comes after" drag) on the right, the full name on hover
    const side = wrap.createDiv({ cls: "vt-map-unlinked" });
    const room = Math.max(0, ...map.unlinked.filter(r => o.expanded.has(r.path)).map(r => r.subs.length));
    if (room) side.setCssProps({ "--vt-map-tile-room": `${room * SUB_LINE_H + 12}px` });   // a subtask list floats under its tile: keep clear of what comes after
    side.createDiv({ cls: "vt-map-unlinked-title", text: "Not linked" });
    const grid = side.createDiv({ cls: "vt-map-tiles" });
    for (const r of map.unlinked) {
      const tile = grid.createDiv({ cls: "vt-map-tile", attr: { title: r.name } });
      tile.dataset.planPath = r.path;
      dragNest(wrap, plan, o, tile.createDiv({ cls: "vt-map-grip", attr: { "aria-label": "Drag onto a to-do to make a subtask" } }), r.path, tile);
      dragLink(wrap, plan, o, tile.createDiv({ cls: "vt-map-handle", attr: { "aria-label": "Drag onto another to-do to link it after this one" } }), r.path);
      tile.createDiv({ cls: "vt-map-tile-title", text: r.name });
      warnMark(box, wrap, tile, plan, o, flagged.get(r.path));
      subsToggle(tile, r, o);
      tickButton(tile, r, o, false);
      if (o.expanded.has(r.path) && r.subs.length) subsList(tile, r, o, "vt-map-subs", { wrap, plan });
      tile.addEventListener("click", e => { e.preventDefault(); open(o, r.path, Keymap.isModEvent(e)); });
      tile.addEventListener("contextmenu", e => menu(o, e, r, plan));
    }
  }
}
