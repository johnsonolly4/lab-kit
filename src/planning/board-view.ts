// The to-do board as a Bases view the plugin draws itself (Board-B Phase 1): days across the top, the Backlog tray along the bottom.
// Bases filters and sorts (the .base file); this draws by planned date (`scheduled`, docs/plans/planned-dates.md) and writes `done` / `scheduled`. Public API only (registerBasesView, since 1.10.0).
// Pure parts: board-card.ts, board-drag.ts (pointer drag for mouse, pen and touch). Plan: docs/plans/board-own-view.md.
import { BasesView, Keymap, Notice, Platform, TFile, type Plugin, type QueryController } from "obsidian";
import type { KitData } from "../kit/paths";
import { todoFolder } from "../kit/paths";
import { inFolder, type NoteRec } from "./lists";
import type { Series } from "./meetings";
import { attachCardDrag, dragJustEnded, stepDay, swipeDir } from "./board-drag";
import { buildWeek, datePill, filterTray, readyPaths, trayProjects, weekCardOf, type BoardCard, type TrayFilter, type WeekCard } from "./board-card";
import { applyPatch, dropPatch, parseDay, ymd } from "./todo";
import { toggleDoneWithUndo } from "./undo-notice";
import { drawDone } from "./board-done";
import { drawHeadAdd } from "./board-head";

export const BOARD_VIEW = "lab-kit-board";
/** Per-device (this vault's local storage, not synced): the tray is folded to one bar. */
export const TRAY_FOLDED_KEY = "lk-board-tray-folded";
/** Phone layout (one day at a time with tabs) below this width of the board's own area, or on a phone (px). */
export const NARROW_PX = 600;
/** The tray's drop key (a column's key is its date). */
const TRAY_KEY = "Backlog";

/** What the view needs from the plugin. */
export interface BoardEnv { kit: () => KitData; series: () => Series[]; /** Opens the New to-do window with `day` (YYYY-MM-DD) in its Day chip. */ newTodo: (day: string) => void }

const open = new Set<BoardView>();
/** Draw every open board again (Show weekend or Busy day from changed). */
export const refreshBoards = (): void => { for (const v of open) v.draw(); };

class BoardView extends BasesView {
  type = BOARD_VIEW;
  private filter: TrayFilter = { kind: "all" };
  private root!: HTMLElement;
  private dragging = false;
  private late = false;
  private pick = "";
  /** The days (YYYY-MM-DD) whose `N done` is unfolded: kept across redraws, until the view closes. */
  private unfolded = new Set<string>();
  private sizer: ResizeObserver;

  constructor(controller: QueryController, private el: HTMLElement, private env: BoardEnv) {
    super(controller);
    open.add(this);
    this.sizer = new ResizeObserver(() => this.root?.toggleClass("is-narrow", this.narrow()));
    this.sizer.observe(el);
  }

  onunload(): void { open.delete(this); this.sizer.disconnect(); }
  private narrow(): boolean { return Platform.isPhone || (this.el.clientWidth > 0 && this.el.clientWidth < NARROW_PX); }
  onDataUpdated(): void { this.draw(); }

  private rec(f: TFile): NoteRec {
    return { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm: this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}, ctime: f.stat.ctime, mtime: f.stat.mtime };
  }

  /** The saved choice; with none saved the tray starts folded in the phone layout. */
  private folded(): boolean { try { const v: unknown = this.app.loadLocalStorage(TRAY_FOLDED_KEY); return v === null ? this.narrow() : v === "1"; } catch { return this.narrow(); } }
  private setFolded(v: boolean): void { try { this.app.saveLocalStorage(TRAY_FOLDED_KEY, v ? "1" : "0"); } catch { /* no local storage: the fold is not kept */ } }

  draw(): void {
    if (this.dragging) { this.late = true; return; }
    const kit = this.env.kit(), now = new Date();
    const keep = this.el.querySelector<HTMLElement>(".lk-board-trayrow")?.scrollLeft ?? 0;
    this.el.empty();
    const cards: WeekCard[] = this.data.data.map(e => weekCardOf({ path: e.file.path, title: e.file.basename, fm: this.app.metadataCache.getFileCache(e.file)?.frontmatter ?? {} }, kit.dueCountdown, now));
    const files = this.app.vault.getMarkdownFiles();
    const todos = files.filter(f => inFolder(f.path, todoFolder(kit.planningFolders))).map(f => this.rec(f));
    const hubs = files.filter(f => inFolder(f.path, kit.planningFolders.projects) || inFolder(f.path, kit.planningFolders.meetings)).map(f => this.rec(f))
      .filter(n => n.fm.kind === "project" || n.fm.kind === "meeting-series");
    const board = buildWeek(cards, { series: this.env.series(), todos, hubs }, { weekend: kit.boardWeekend, busyFrom: kit.boardBusyFrom, countdown: kit.dueCountdown, now });

    const root = this.root = this.el.createDiv({ cls: "lk-board" });
    root.toggleClass("is-narrow", this.narrow());
    const names = board.days.map(d => d.day);
    if (!names.includes(this.pick)) this.pick = board.days.find(d => d.today)?.day ?? names[0] ?? "";
    const tabs = root.createDiv({ cls: "lk-board-tabs", attr: { role: "tablist", "aria-label": "Days" } });
    for (const d of board.days) {
      const tab = tabs.createEl("button", { cls: "lk-board-tab", attr: { type: "button", role: "tab", "aria-selected": String(d.day === this.pick) } });
      this.zone(tab, d.date, d.past);
      if (d.day === this.pick) tab.addClass("is-on");
      if (d.today) tab.addClass("is-today");
      this.dayName(tab, d.day, d.date);
      tab.createSpan({ cls: d.busy ? "lk-board-count is-busy" : "lk-board-count", text: String(d.count) });
      tab.addEventListener("click", () => { this.pick = d.day; this.draw(); });
    }
    const days = root.createDiv({ cls: board.days.length > 5 ? "lk-board-days has-weekend" : "lk-board-days" });
    this.swipe(days, names);
    for (const d of board.days) {
      const col = days.createEl("section", { cls: "lk-board-col" });
      col.dataset.day = d.day;
      this.zone(col, d.date, d.past);
      if (d.today) col.addClass("is-today");
      if (d.day === this.pick) col.addClass("is-picked");
      const head = col.createDiv({ cls: "lk-board-head" });
      this.dayName(head, d.day, d.date);
      head.createSpan({ cls: d.busy ? "lk-board-count is-busy" : "lk-board-count", text: String(d.count) });
      drawHeadAdd(head, d, b => { b.focus(); this.env.newTodo(ymd(d.date)); });   // focused first: the window opens under the button (Safari does not focus on click)
      for (const m of d.markers) col.createDiv({ cls: `lk-board-mark is-${m.kind}`, text: m.text });
      const list = col.createDiv({ cls: "lk-board-list" });
      for (const c of d.open) this.card(list, c);
      const key = ymd(d.date);
      drawDone(col, d.finished, this.unfolded.has(key), {
        toggle: () => { if (!this.unfolded.delete(key)) this.unfolded.add(key); this.draw(); },
        untick: path => this.toggleDone(path),
        open: (path, ev) => { const f = this.app.vault.getFileByPath(path); if (f) void this.app.workspace.getLeaf(Keymap.isModEvent(ev)).openFile(f); },
      });
    }

    const tray = root.createDiv({ cls: "lk-board-tray" });
    tray.dataset.drop = TRAY_KEY;
    const folded = this.folded();
    if (folded) tray.addClass("is-folded");
    const thead = tray.createDiv({ cls: "lk-board-trayhead" });
    thead.createEl("b", { text: `Backlog (${board.tray.length})` });
    if (!folded) this.chips(thead, board.tray);
    const fold = thead.createEl("button", { cls: "lk-board-fold", text: folded ? "Unfold" : "Fold", attr: { type: "button" } });
    fold.addEventListener("click", () => { this.setFolded(!folded); this.draw(); });
    if (!folded) {
      const ready = readyPaths(todos, hubs);
      const row = tray.createDiv({ cls: "lk-board-trayrow" });
      for (const c of filterTray(board.tray, this.filter, ready)) this.card(row, c);
      row.scrollLeft = keep;
    }
  }

  /** A column or day tab as a drop zone, keyed by its date. A past day stays a zone (a drop there gets the notice) but is never highlighted. */
  private zone(el: HTMLElement, date: Date, past: boolean): void {
    el.dataset.drop = ymd(date);
    if (past) { el.dataset.past = ""; el.addClass("is-past"); }
  }

  /** `Mon 19`. */
  private dayName(parent: HTMLElement, day: string, date: Date): void {
    const name = parent.createSpan({ cls: "lk-board-name", text: `${day} ` });
    name.createSpan({ cls: "lk-board-date", text: String(date.getDate()) });
  }

  /** Phone layout: a touch swipe sideways on the days moves to the next / previous day. */
  private swipe(days: HTMLElement, names: string[]): void {
    let start: { x: number; y: number } | null = null;
    days.addEventListener("pointerdown", e => { start = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null; });
    days.addEventListener("pointerup", e => {
      const s = start; start = null;
      if (!s || this.dragging || !this.root.hasClass("is-narrow")) return;
      const dir = swipeDir(e.clientX - s.x, e.clientY - s.y);
      const next = dir ? stepDay(names, this.pick, dir) : this.pick;
      if (next !== this.pick) { this.pick = next; this.draw(); }
    });
  }

  private chips(parent: HTMLElement, tray: BoardCard[]): void {
    const projects = trayProjects(tray);
    if (this.filter.kind === "project" && !projects.includes(this.filter.name)) this.filter = { kind: "all" };
    const wrap = parent.createDiv({ cls: "lk-board-chips" });
    const chip = (label: string, f: TrayFilter): void => {
      const on = f.kind === this.filter.kind && (f.kind !== "project" || (this.filter.kind === "project" && this.filter.name === f.name));
      const b = wrap.createEl("button", { cls: on ? "lk-board-chip is-on" : "lk-board-chip", text: label, attr: { type: "button" } });
      b.addEventListener("click", () => { this.filter = f; this.draw(); });
    };
    chip("All", { kind: "all" });
    chip("Ready", { kind: "ready" });
    for (const p of projects) chip(p, { kind: "project", name: p });
    if (tray.some(c => !c.project)) chip("No project", { kind: "none" });
  }

  private card(parent: HTMLElement, c: WeekCard): void {
    const el = parent.createDiv({ cls: "lk-board-card" });
    el.dataset.path = c.path;
    if (c.carried) el.addClass("is-rolled");
    if (c.waiting) el.addClass("is-waiting");
    const top = el.createDiv({ cls: "lk-board-top" });
    const done = top.createEl("button", { cls: "lk-board-done", attr: { type: "button", "aria-label": "Mark done" } });
    done.addEventListener("click", ev => { ev.stopPropagation(); this.toggleDone(c.path); });
    top.createSpan({ cls: "lk-board-title", text: c.title });
    const foot = c.tag || c.waiting || c.countdown || c.pill ? el.createDiv({ cls: "lk-board-foot" }) : null;
    if (foot) {
      if (c.pill) foot.createSpan({ cls: "lk-board-pill is-later", text: c.pill });
      if (c.tag) { const t = foot.createSpan({ cls: "lk-board-tag", text: c.tag.text }); t.dataset.prio = c.tag.level; }
      if (c.waiting) foot.createSpan({ cls: "lk-board-wait", text: `Waiting: ${c.waiting}` });
      if (c.countdown) { const d = foot.createSpan({ cls: "lk-board-due", text: c.countdown.text }); d.dataset.level = c.countdown.level; }
    }
    el.addEventListener("click", ev => { if (dragJustEnded()) return; const f = this.app.vault.getFileByPath(c.path); if (f) void this.app.workspace.getLeaf(Keymap.isModEvent(ev)).openFile(f); });
    attachCardDrag(el, c.path, c.title, {
      root: this.root,
      onDrop: (path, key) => this.drop(path, key),
      onState: on => { this.dragging = on; if (!on && this.late) { this.late = false; this.draw(); } },
    });
  }

  /** A drop on a column (its date) or the tray: `dropPatch`, or the notice for a past day. The to-do engine stamps nothing on a drop. */
  private drop(path: string, key: string): void {
    const target = key === TRAY_KEY ? null : parseDay(key);
    if (key !== TRAY_KEY && !target) return;
    const f = this.app.vault.getFileByPath(path);
    if (!f) return;
    const r = dropPatch(this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}, target, new Date());
    if (!r) return;
    if ("refused" in r) { new Notice(`${datePill(target!)} has passed: drop on today or a later day.`); return; }
    void this.write(path, x => applyPatch(x, r.patch));
  }

  /** The to-do engine stamps `done_on` (tickPatch); a tick gets the Undo notice (undo-notice.ts). */
  private toggleDone(path: string): void {
    const f = this.app.vault.getFileByPath(path);
    if (f) toggleDoneWithUndo(this.app, f).catch(e => console.error("Lab Kit board", e));
  }

  private async write(path: string, change: (x: Record<string, unknown>) => void): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) await this.app.fileManager.processFrontMatter(f, change);
  }
}

/** Register the board view with Bases. False when Bases is off in this vault (the kit's .base keeps its built-in kanban view as the second view). */
export function registerBoardView(plugin: Plugin, env: BoardEnv): boolean {
  return plugin.registerBasesView(BOARD_VIEW, {
    name: "Lab Kit board",
    icon: "square-kanban",
    factory: (controller, el) => new BoardView(controller, el, env),
  });
}
