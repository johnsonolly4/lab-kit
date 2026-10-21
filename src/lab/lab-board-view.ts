// The lab notes board as a Bases view the plugin draws itself (prototype B3, owner chat 2026-10-21): Running | Summary | Completed tabs in one view,
// so the switch is one click with no undocumented controller call. Bases selects the notes (the .base file); this draws them and writes only `Status` (a drag).
// Public API only (registerBasesView, since 1.10.0), except Obsidian's toolbar class names for Hide toolbar (CSS, fails soft). Model: lab-board.ts.
// Plan: docs/plans/lab-notes-board-and-completed-view.md, "Build phases from B3".
import { BasesView, Keymap, Notice, Platform, TFile, setIcon, type Plugin, type QueryController } from "obsidian";
import { attachCardDrag, dragJustEnded, stepDay, swipeDir } from "../planning/board-drag";
import { NARROW_PX } from "../planning/board-view";
import { inFolder } from "../planning/lists";
import { chemText, chipValues, COMPLETED_COLS, COMPLETED_START, completedRows, cellText, isCompleted, LAB_BOARD_VIEW, labRow, nextSort, openTodosByNote, OTHER, pickColumn, progress, RESULT_LOOK, RUNNING, runningColumns, summary, type CompletedState, type LabRow } from "./lab-board";

/** Per-device (this vault's local storage, not synced): Hide toolbar and the last tab, for every lab board. */
export const LAB_BOARD_KEY = "lk-lab-board";
/** Set on the tab's `.workspace-leaf-content` while Hide toolbar is on: styles.css hides Obsidian's Bases toolbar under it. */
const HIDE_CLS = "lk-lab-hide-toolbar";

type Tab = "running" | "summary" | "completed";
const TABS: [Tab, string][] = [["running", "Running"], ["summary", "Summary"], ["completed", "Completed"]];

/** What the view needs from the plugin. */
export interface LabBoardEnv {
  /** The to-dos folder (open to-dos that link to a note by `experiment` are counted on its card), null when the planning kit is off. */
  todoFolder: () => string | null;
  /** Opens the New lab entry window; the new note gets `status` (null: the template's own, Planned). */
  newLabEntry: (status: string | null) => void;
}

class LabBoardView extends BasesView {
  type = LAB_BOARD_VIEW;
  private root!: HTMLElement;
  private tab: Tab = "running";
  private hide = false;
  private pick = "";
  private dragging = false;
  private late = false;
  private cst: CompletedState = { ...COMPLETED_START };
  /** Note text for the completed search, read once per data update (cachedRead). */
  private bodies = new Map<string, string>();
  private sizer: ResizeObserver;

  constructor(controller: QueryController, private el: HTMLElement, private env: LabBoardEnv) {
    super(controller);
    el.createDiv({ cls: "lk-lab-loading", text: "Loading the lab board…" });   // an embed with an empty container never gets onDataUpdated (spike, 2026-10-20)
    try {
      const saved = JSON.parse((this.app.loadLocalStorage(LAB_BOARD_KEY) as string | null) ?? "{}") as { hide?: unknown; tab?: unknown };
      this.hide = saved.hide === true;
      if (TABS.some(([k]) => k === saved.tab)) this.tab = saved.tab as Tab;
    } catch { /* nothing saved: defaults */ }
    this.sizer = new ResizeObserver(() => this.root?.toggleClass("is-narrow", this.narrow()));
    this.sizer.observe(el);
  }

  onunload(): void { this.sizer.disconnect(); this.leaf()?.removeClass(HIDE_CLS); }
  onDataUpdated(): void { this.bodies.clear(); this.draw(); }

  private narrow(): boolean { return Platform.isPhone || (this.el.clientWidth > 0 && this.el.clientWidth < NARROW_PX); }
  private save(): void { try { this.app.saveLocalStorage(LAB_BOARD_KEY, JSON.stringify({ hide: this.hide, tab: this.tab })); } catch { /* no local storage: not kept */ } }
  /** The tab this board fills, or null inside a note (an embed: the toolbar of every base in that note would go, so the switch is not offered there). */
  private leaf(): HTMLElement | null { return this.el.closest(".markdown-preview-view, .markdown-source-view") ? null : this.el.closest<HTMLElement>(".workspace-leaf-content"); }

  private rows(): LabRow[] {
    const folder = this.env.todoFolder();
    const fmOf = (f: TFile): Record<string, unknown> => this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
    const todos = folder ? openTodosByNote(this.app.vault.getMarkdownFiles().filter(f => inFolder(f.path, folder)).map(f => ({ fm: fmOf(f) }))) : new Map<string, number>();
    return this.data.data.map(e => {
      const boxes = (this.app.metadataCache.getFileCache(e.file)?.listItems ?? []).filter(i => i.task !== undefined);
      return labRow({ path: e.file.path, name: e.file.basename, fm: fmOf(e.file), boxes: boxes.length, ticked: boxes.filter(i => i.task !== " ").length, todos: todos.get(e.file.basename) ?? 0 });
    });
  }

  draw(): void {
    if (this.dragging) { this.late = true; return; }
    const typing = this.el.ownerDocument.activeElement;
    const caret = typing instanceof HTMLInputElement && this.el.contains(typing) ? typing.selectionStart : null;
    const rows = this.rows();
    this.el.empty();
    const root = this.root = this.el.createDiv({ cls: "lk-board lk-lab" });
    root.toggleClass("is-narrow", this.narrow());
    const leaf = this.leaf();
    leaf?.toggleClass(HIDE_CLS, this.hide);

    // The header row (the to-do board's week row): the tabs as chips on the left, Hide toolbar and New lab entry on the right
    const row = root.createDiv({ cls: "lk-board-weekrow" });
    const chips = row.createDiv({ cls: "lk-board-chips lk-lab-tabs", attr: { role: "tablist" } });
    for (const [k, label] of TABS) {
      const b = chips.createEl("button", { cls: k === this.tab ? "lk-board-chip is-on" : "lk-board-chip", text: label, attr: { type: "button", role: "tab", "aria-selected": String(k === this.tab) } });
      b.addEventListener("click", () => { this.tab = k; this.save(); this.draw(); });
    }
    const acts = row.createDiv({ cls: "lk-board-weekacts" });
    if (leaf) {
      const hb = acts.createEl("button", { cls: this.hide ? "lk-board-weekbtn lk-lab-hide is-on" : "lk-board-weekbtn lk-lab-hide", text: "Hide toolbar", attr: { type: "button", "aria-pressed": String(this.hide) } });
      hb.addEventListener("click", () => { this.hide = !this.hide; this.save(); leaf.toggleClass(HIDE_CLS, this.hide); hb.toggleClass("is-on", this.hide); hb.setAttr("aria-pressed", String(this.hide)); });
    }
    const nb = acts.createEl("button", { cls: "lk-board-weekbtn lk-lab-new", attr: { type: "button" } });
    setIcon(nb.createSpan({ cls: "lk-lab-new-icon" }), "plus");
    nb.createSpan({ text: "New lab entry" });
    nb.addEventListener("click", () => this.env.newLabEntry(null));

    const body = root.createDiv({ cls: "lk-lab-body" });
    if (this.tab === "summary") this.drawSummary(body, rows);
    else if (this.tab === "completed") this.drawCompleted(body, rows, caret);
    else this.drawRunning(body, rows);
  }

  // ---- Running: a column per running Status, cards only as tall as their content
  private drawRunning(host: HTMLElement, rows: LabRow[]): void {
    const cols = runningColumns(rows);
    this.pick = pickColumn(cols, this.pick);
    const tabs = host.createDiv({ cls: "lk-board-tabs", attr: { role: "tablist", "aria-label": "Status" } });
    for (const c of cols) {
      const t = tabs.createEl("button", { cls: c.key === this.pick ? "lk-board-tab is-on" : "lk-board-tab", attr: { type: "button", role: "tab", "aria-selected": String(c.key === this.pick) } });
      if (c.key !== OTHER) t.dataset.drop = c.key;   // Other is not a Status to write: no drop
      t.createSpan({ cls: "lk-board-name", text: c.label });
      t.createSpan({ cls: "lk-board-count", text: String(c.rows.length) });
      t.addEventListener("click", () => { this.pick = c.key; this.draw(); });
    }
    const days = host.createDiv({ cls: "lk-lab-cols" });
    days.setCssProps({ "--lk-lab-n": String(cols.length) });
    this.swipe(days, cols.map(c => c.key));
    for (const c of cols) {
      const col = days.createEl("section", { cls: c.key === this.pick ? "lk-board-col is-picked" : "lk-board-col" });
      if (c.key !== OTHER) col.dataset.drop = c.key;
      const head = col.createDiv({ cls: "lk-board-head" });
      head.createSpan({ cls: "lk-board-name", text: c.label });
      head.createSpan({ cls: "lk-board-count", text: String(c.rows.length) });
      if (c.key !== OTHER) {   // like the day header's `+`: a round button to the real New lab entry window, with this column's Status
        const add = head.createEl("button", { cls: "lk-board-add", text: "+", attr: { type: "button", "aria-label": `New lab entry in ${c.label}` } });
        add.addEventListener("click", ev => { ev.stopPropagation(); add.focus(); this.env.newLabEntry(c.key === "Planned" ? null : c.key); });
      }
      const list = col.createDiv({ cls: "lk-board-list" });
      if (!c.rows.length) list.createDiv({ cls: "lk-lab-empty", text: "Nothing here" });
      for (const r of c.rows) this.card(list, r);
    }
  }

  /** Narrow pane: a touch swipe sideways moves to the next / previous column. */
  private swipe(days: HTMLElement, keys: string[]): void {
    let start: { x: number; y: number } | null = null;
    days.addEventListener("pointerdown", e => { start = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null; });
    days.addEventListener("pointerup", e => {
      const s = start; start = null;
      if (!s || this.dragging || !this.root.hasClass("is-narrow")) return;
      const dir = swipeDir(e.clientX - s.x, e.clientY - s.y);
      const next = dir ? stepDay(keys, this.pick, dir) : this.pick;
      if (next !== this.pick) { this.pick = next; this.draw(); }
    });
  }

  /** Code and name always; Exp. Class, start date, open to-dos, chemicals and progress only when the note has them. Long text stops at two lines. */
  private card(parent: HTMLElement, r: LabRow): void {
    const el = parent.createDiv({ cls: "lk-board-card lk-lab-card" });
    el.dataset.path = r.path;
    const t = el.createDiv({ cls: "lk-board-top" }).createDiv({ cls: "lk-board-title lk-lab-clamp" });
    t.createEl("b", { text: r.code });
    if (r.title) t.createSpan({ text: ` ${r.title}` });
    if (r.cls || r.start || r.todos) {
      const foot = el.createDiv({ cls: "lk-board-foot" });
      if (r.cls) foot.createSpan({ cls: "lk-board-tag", text: r.cls });
      if (r.start) foot.createSpan({ cls: "lk-board-due", text: `Started ${r.start}` });
      if (r.todos) foot.createSpan({ cls: "lk-board-tag lk-lab-todos", text: `${r.todos} open to-do${r.todos === 1 ? "" : "s"}` });
    }
    if (r.chems.length) el.createDiv({ cls: "lk-lab-chems lk-lab-clamp", text: chemText(r.chems) });
    const p = progress(r);
    if (p !== null) {
      const pr = el.createDiv({ cls: "lk-lab-progress" });
      pr.createDiv({ cls: "lk-lab-bar" }).createDiv({ cls: "lk-lab-fill" }).setCssProps({ "--lk-lab-p": `${p}%` });
      pr.createSpan({ text: `${r.ticked}/${r.boxes}` });
    }
    el.addEventListener("click", ev => { if (!dragJustEnded()) this.open(r.path, ev); });
    attachCardDrag(el, r.path, r.name, {
      root: this.root,
      onDrop: (path, key) => void this.drop(path, key),
      onState: on => { this.dragging = on; if (!on && this.late) { this.late = false; this.draw(); } },
    });
  }

  /** A drop on a running column or its tab writes that Status; nothing else is changed (no Closed target: Close experiment closes a note). */
  private async drop(path: string, key: string): Promise<void> {
    if (!(RUNNING as readonly string[]).includes(key)) return;
    const f = this.app.vault.getFileByPath(path);
    if (!f) return;
    try { await this.app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => { fm.Status = key; }); }
    catch (e) { console.error("Lab Kit lab board", e); new Notice(`Could not change the Status of ${f.basename}. See the developer console for details.`); }
  }

  private open(path: string, ev: MouseEvent): void {
    const f = this.app.vault.getFileByPath(path);
    if (f) void this.app.workspace.getLeaf(Keymap.isModEvent(ev)).openFile(f);
  }

  // ---- Summary: tiles at the card corner
  private drawSummary(host: HTMLElement, rows: LabRow[]): void {
    for (const g of summary(rows)) {
      host.createDiv({ cls: "lk-lab-h", text: g.title });
      const tiles = host.createDiv({ cls: "lk-lab-tiles" });
      for (const [label, n] of g.tiles) {
        const tile = tiles.createDiv({ cls: "lk-lab-tile" });
        tile.createDiv({ cls: "lk-lab-tile-n", text: String(n) });
        tile.createDiv({ cls: "lk-lab-tile-l", text: label });
      }
    }
  }

  // ---- Completed: the Alt+S menu's search box, filter chips, a table box with Result badges
  private drawCompleted(host: HTMLElement, rows: LabRow[], caret: number | null): void {
    const done = rows.filter(isCompleted);
    const search = host.createDiv({ cls: "lk-snip-search lk-lab-search" });
    setIcon(search.createSpan({ cls: "lk-snip-search-icon" }), "search");
    const input = search.createEl("input", { type: "text", attr: { placeholder: "Search name, chemicals, outcome and note text", "aria-label": "Search completed experiments" } });
    input.value = this.cst.q;
    const filters = host.createDiv({ cls: "lk-lab-filters" });
    const holder = host.createDiv();
    const chipRow = (label: string, key: "cls" | "result"): void => {
      const values = chipValues(rows, key);
      if (!values.length) return;
      const w = filters.createDiv({ cls: "lk-lab-filter" });
      w.createSpan({ cls: "lk-lab-filter-label", text: label });
      const cc = w.createDiv({ cls: "lk-board-chips" });
      for (const v of values) {
        const b = cc.createEl("button", { cls: this.cst[key] === v ? "lk-board-chip is-on" : "lk-board-chip", text: v, attr: { type: "button", "aria-pressed": String(this.cst[key] === v) } });
        b.addEventListener("click", () => { this.cst[key] = this.cst[key] === v ? "" : v; this.draw(); });
      }
    };
    chipRow("Exp. Class", "cls");
    chipRow("Result", "result");
    const fill = (): void => {
      holder.empty();
      const list = completedRows(rows, this.cst, p => this.bodies.get(p));
      const box = holder.createDiv({ cls: "lk-lab-tablebox" });
      const table = box.createEl("table", { cls: "lk-lab-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const [key, label] of COMPLETED_COLS) {
        const th = hr.createEl("th", { cls: `lk-lab-col-${key}`, text: label, attr: { "aria-sort": this.cst.sortKey === key ? (this.cst.sortDir === 1 ? "ascending" : "descending") : "none" } });
        if (this.cst.sortKey === key) th.createSpan({ cls: "lk-lab-sortmark", text: this.cst.sortDir === 1 ? "▲" : "▼" });
        th.addEventListener("click", () => { Object.assign(this.cst, nextSort(this.cst, key)); fill(); });
      }
      const tbody = table.createEl("tbody");
      for (const r of list) {
        const tr = tbody.createEl("tr");
        tr.addEventListener("click", ev => this.open(r.path, ev));
        for (const [key] of COMPLETED_COLS) {
          const td = tr.createEl("td", { cls: `lk-lab-col-${key}` });
          if (key === "name") { td.createEl("b", { text: r.code }); if (r.title) td.createSpan({ text: ` ${r.title}` }); }
          else if (key === "cls") { if (r.cls) td.createSpan({ cls: "lk-board-tag", text: r.cls }); }
          else if (key === "result") { if (r.result) td.createSpan({ cls: `lab-kit-badge ${RESULT_LOOK[r.result] ?? ""}`.trim(), text: r.result }); }
          else td.createDiv({ cls: "lk-lab-clamp", text: cellText(r, key) });
        }
      }
      if (!list.length) holder.createDiv({ cls: "lk-lab-empty", text: "No completed experiment matches." });
      holder.createDiv({ cls: "lk-lab-rowcount", text: `${list.length} of ${done.length} completed` });
    };
    input.addEventListener("input", () => { this.cst.q = input.value; fill(); });
    fill();
    if (caret !== null) { input.focus(); input.setSelectionRange(caret, caret); }   // a redraw while typing keeps the cursor in the box
    void this.loadBodies(done).then(() => { if (host.isConnected && this.cst.q.trim()) fill(); });
  }

  /** The note text of `rows` not read yet (for a word that is only in the body). */
  private async loadBodies(rows: LabRow[]): Promise<void> {
    await Promise.all(rows.filter(r => !this.bodies.has(r.path)).map(async r => {
      const f = this.app.vault.getFileByPath(r.path);
      if (f) this.bodies.set(r.path, await this.app.vault.cachedRead(f));
    }));
  }
}

/** Register the lab board view with Bases. False when Bases is off in this vault (the kit's .base keeps its built-in views after it). */
export function registerLabBoardView(plugin: Plugin, env: LabBoardEnv): boolean {
  return plugin.registerBasesView(LAB_BOARD_VIEW, {
    name: "Lab Kit lab board",
    icon: "flask-conical",
    factory: (controller, el) => new LabBoardView(controller, el, env),
  });
}
