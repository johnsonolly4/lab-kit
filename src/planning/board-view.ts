// The to-do board as a Bases view the plugin draws itself (Board-B Phase 1): days across the top, the Backlog tray along the bottom.
// Bases filters and sorts (the .base file); this draws and writes `done` / `day`. Public API only (registerBasesView, since 1.10.0).
// Pure parts: board-card.ts, board-drag.ts (pointer drag for mouse, pen and touch). Plan: docs/plans/board-own-view.md.
import { BasesView, Keymap, TFile, type Plugin, type QueryController } from "obsidian";
import type { KitData } from "../kit/paths";
import { todoFolder } from "../kit/paths";
import { inFolder, type NoteRec } from "./lists";
import type { Series } from "./meetings";
import { attachCardDrag, dragJustEnded } from "./board-drag";
import { buildBoard, cardOf, filterTray, readyPaths, trayProjects, type BoardCard, type TrayFilter } from "./board-card";

export const BOARD_VIEW = "lab-kit-board";
/** Per-device (this vault's local storage, not synced): the tray is folded to one bar. */
export const TRAY_FOLDED_KEY = "lk-board-tray-folded";

/** What the view needs from the plugin. */
export interface BoardEnv { kit: () => KitData; series: () => Series[] }

const open = new Set<BoardView>();
/** Draw every open board again (Show weekend or Busy day from changed). */
export const refreshBoards = (): void => { for (const v of open) v.draw(); };

class BoardView extends BasesView {
  type = BOARD_VIEW;
  private filter: TrayFilter = { kind: "all" };
  private root!: HTMLElement;
  private dragging = false;
  private late = false;

  constructor(controller: QueryController, private el: HTMLElement, private env: BoardEnv) {
    super(controller);
    open.add(this);
  }

  onunload(): void { open.delete(this); }
  onDataUpdated(): void { this.draw(); }

  private rec(f: TFile): NoteRec {
    return { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm: this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}, ctime: f.stat.ctime, mtime: f.stat.mtime };
  }

  private folded(): boolean { try { return this.app.loadLocalStorage(TRAY_FOLDED_KEY) === "1"; } catch { return false; } }
  private setFolded(v: boolean): void { try { this.app.saveLocalStorage(TRAY_FOLDED_KEY, v ? "1" : null); } catch { /* no local storage: the fold is not kept */ } }

  draw(): void {
    if (this.dragging) { this.late = true; return; }
    const kit = this.env.kit(), now = new Date();
    const keep = this.el.querySelector<HTMLElement>(".lk-board-trayrow")?.scrollLeft ?? 0;
    this.el.empty();
    const cards: BoardCard[] = this.data.data.map(e => cardOf({ path: e.file.path, title: e.file.basename, fm: this.app.metadataCache.getFileCache(e.file)?.frontmatter ?? {} }, kit.dueCountdown, now));
    const files = this.app.vault.getMarkdownFiles();
    const todos = files.filter(f => inFolder(f.path, todoFolder(kit.planningFolders))).map(f => this.rec(f));
    const hubs = files.filter(f => inFolder(f.path, kit.planningFolders.projects) || inFolder(f.path, kit.planningFolders.meetings)).map(f => this.rec(f))
      .filter(n => n.fm.kind === "project" || n.fm.kind === "meeting-series");
    const board = buildBoard(cards, { series: this.env.series(), todos, hubs }, { weekend: kit.boardWeekend, busyFrom: kit.boardBusyFrom, countdown: kit.dueCountdown, now });

    const root = this.root = this.el.createDiv({ cls: "lk-board" });
    const days = root.createDiv({ cls: board.days.length > 5 ? "lk-board-days has-weekend" : "lk-board-days" });
    for (const d of board.days) {
      const col = days.createEl("section", { cls: "lk-board-col" });
      col.dataset.day = d.day;
      col.dataset.drop = d.day;
      if (d.today) col.addClass("is-today");
      const head = col.createDiv({ cls: "lk-board-head" });
      head.createSpan({ cls: "lk-board-name", text: d.day });
      head.createSpan({ cls: d.busy ? "lk-board-count is-busy" : "lk-board-count", text: String(d.count) });
      for (const m of d.markers) col.createDiv({ cls: `lk-board-mark is-${m.kind}`, text: m.text });
      const list = col.createDiv({ cls: "lk-board-list" });
      for (const c of d.open) this.card(list, c);
      if (d.done) col.createDiv({ cls: "lk-board-donecount", text: `${d.done} done` });
    }

    const tray = root.createDiv({ cls: "lk-board-tray" });
    tray.dataset.drop = "Backlog";
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

  private card(parent: HTMLElement, c: BoardCard): void {
    const el = parent.createDiv({ cls: "lk-board-card" });
    el.dataset.path = c.path;
    if (c.rolled) el.addClass("is-rolled");
    if (c.waiting) el.addClass("is-waiting");
    const top = el.createDiv({ cls: "lk-board-top" });
    const done = top.createEl("button", { cls: "lk-board-done", attr: { type: "button", "aria-label": "Mark done" } });
    done.addEventListener("click", ev => { ev.stopPropagation(); this.toggleDone(c.path); });
    top.createSpan({ cls: "lk-board-title", text: c.title });
    const foot = c.tag || c.waiting || c.countdown ? el.createDiv({ cls: "lk-board-foot" }) : null;
    if (foot) {
      if (c.tag) { const t = foot.createSpan({ cls: "lk-board-tag", text: c.tag.text }); t.dataset.prio = c.tag.level; }
      if (c.waiting) foot.createSpan({ cls: "lk-board-wait", text: `Waiting: ${c.waiting}` });
      if (c.countdown) { const d = foot.createSpan({ cls: "lk-board-due", text: c.countdown.text }); d.dataset.level = c.countdown.level; }
    }
    el.addEventListener("click", ev => { if (dragJustEnded()) return; const f = this.app.vault.getFileByPath(c.path); if (f) void this.app.workspace.getLeaf(Keymap.isModEvent(ev)).openFile(f); });
    attachCardDrag(el, c.path, c.title, {
      root: this.root,
      onDrop: (path, day) => { void this.write(path, x => { if (x.day !== day) x.day = day; }); },
      onState: on => { this.dragging = on; if (!on && this.late) { this.late = false; this.draw(); } },
    });
  }

  private toggleDone(path: string): void { void this.write(path, x => { x.done = x.done !== true; }); }

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
