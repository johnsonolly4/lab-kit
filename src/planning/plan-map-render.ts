// Draws a project's card map (planning kit, `show: project-map`): cards in the vault theme, arrows behind them, the to-dos with no links in a list beside it.
// Layout: src/planning/plan-map.ts. Styles: `.vt-map*` in vault-theme.css.
import { Keymap, Menu, Notice, setIcon, type App, type PaneType } from "obsidian";
import { statusClass, type Plan, type PlanRow } from "./plan";
import { CARD_H, CARD_W, chainOf, mapGeometry, setDone, type PlanMap } from "./plan-map";

export interface MapOptions {
  app: App;
  /** The note the map is drawn in (to resolve links). */
  sourcePath: string;
}

/** Opens a to-do: a click, Ctrl / Cmd-click for a new tab. */
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
  m.showAtMouseEvent(e);
}

/** The map and the unlinked list inside `box`. The scroll box carries `data-start-scroll`: where to scroll once it is in the page. */
export function drawPlanMap(box: HTMLElement, plan: Plan, map: PlanMap, o: MapOptions): void {
  const wrap = box.createDiv({ cls: "vt-map" });
  if (map.cards.length) {
    const g = mapGeometry(map);
    const scroller = wrap.createDiv({ cls: "vt-map-scroll" });
    const canvas = scroller.createDiv({ cls: "vt-map-canvas" });
    if (g.scrollLeft > 0) scroller.createDiv({ cls: "vt-map-spacer" });   // room to scroll the start step to the left edge even when everything fits
    canvas.setCssProps({ "--vt-map-w": `${g.width}px`, "--vt-map-h": `${g.height}px`, "--vt-map-card-w": `${CARD_W}px`, "--vt-map-card-h": `${CARD_H}px` });
    const svg = canvas.createSvg("svg", { cls: "vt-map-arrows", attr: { width: String(g.width), height: String(g.height) } });
    const arrows = new Map<SVGPathElement, { from: string; to: string }>();
    for (const c of g.curves) arrows.set(svg.createSvg("path", { cls: "vt-map-arrow", attr: { d: c.d } }), c);
    const cards = new Map<string, HTMLElement>();
    for (const c of map.cards) {
      const r = c.row, p = g.pos.get(c.path)!;
      const el = canvas.createDiv({ cls: ["vt-map-card", r.blocked ? "vt-map-blocked" : "", map.cyclic.has(c.path) ? "vt-map-cyclic" : ""].filter(Boolean).join(" ") });
      el.setCssProps({ "--vt-map-x": `${p.x}px`, "--vt-map-y": `${p.y}px` });
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
      if (r.result) el.createDiv({ cls: "vt-muted vt-map-result", text: `→ ${r.result}` });
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
    scroller.dataset.startScroll = String(g.scrollLeft);
  }
  if (map.unlinked.length) {
    const side = wrap.createDiv({ cls: "vt-map-unlinked" });
    side.createDiv({ cls: "vt-map-unlinked-title", text: "Not linked" });
    const ul = side.createEl("ul");
    for (const r of map.unlinked) {
      const a = ul.createEl("li").createEl("a", { text: r.name, cls: "internal-link", attr: { href: r.path, "data-href": r.path } });
      a.addEventListener("click", e => { e.preventDefault(); open(o, r.path, Keymap.isModEvent(e)); });
      a.addEventListener("contextmenu", e => menu(o, e, r));
    }
  }
}
