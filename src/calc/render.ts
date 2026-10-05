// Renders ```calc blocks as live tables: click-to-edit, + Row, A1 grid, Copy, row menu.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.
import { MarkdownRenderChild, MarkdownRenderer, Menu, Notice, TFile, getIcon, type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import {
  ERR, cleanLink, colToIndex, extractBlocks, formatValue, indexToCol, isErr, parseBlock, text, Workbook,
  type Env, type ParsedBlock, type Value
} from "./engine";
import { autoInsertIndex, editRows, writeCellText } from "./rewrite";
import { formulaRefs } from "./refs";
import { listChemicals, type Chemical } from "../chem";
import { ChemicalSuggest } from "../chem/suggest";
import { prop } from "../frontmatter";

/** The chemical-database settings the calc tables use (the plugin's `kit` settings). */
export interface ChemSettings { chemicalFolder?: string; mwProperty?: string }

/** One rendered ```calc block. */
export interface CalcEntry {
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  source: string;
  /** When the block was made: a block Obsidian has not attached to the page yet is kept for a few seconds, not dropped. */
  born?: number;
  parsed?: ParsedBlock;
  grid?: boolean;
  /** Body cells of the current render, keyed `row|col`, so a click can be carried over a re-render. */
  tds?: Map<string, HTMLElement>;
  /** Every cell of the current render including the header row, keyed `row|col`: the live highlight finds cells here. */
  cells?: Map<string, HTMLElement>;
}

export class CalcRenderer {
  /** Rendered blocks per note path, so edits to the note refresh them. */
  live = new Map<string, Set<CalcEntry>>();
  /** The cell being edited, if any (one at a time). */
  private editor: { entry: CalcEntry; showRefs?: () => void } | null = null;
  /** Cells marked as referenced by the formula being typed. */
  private marked: HTMLElement[] = [];
  /**
   * Cell clicked while another was being edited: opened once the save and redraw are done.
   * Obsidian may rebuild the whole block after the save (new element, new entry), so it is
   * matched by note path + block start line, not by entry.
   */
  private pending: { entry: CalcEntry; path: string; line: number | null; r: number; c: number } | null = null;
  private pendingTimer = 0;
  private retryTimer = 0;
  /** Until this time (ms) Obsidian may still rebuild blocks after a save: a cell opened before then would be wiped by the rebuild. */
  private quietUntil = 0;
  /** Scroll position of the note while an edit is saved: a rebuilt block can collapse for a moment and drag the page. */
  private hold: { scroller: HTMLElement; top: number; until: number; start: number } | null = null;

  constructor(private plugin: Plugin, private settings: () => ChemSettings = () => ({})) {}

  get app(): App { return this.plugin.app; }

  /** Registers the ```calc processor and the refresh-on-edit listener. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("calc", async (source, el, ctx) => {
      const entry: CalcEntry = { el, ctx, source, born: Date.now() };
      if (!this.live.has(ctx.sourcePath)) this.live.set(ctx.sourcePath, new Set());
      this.live.get(ctx.sourcePath)!.add(entry);
      await this.render(entry);
      this.quietUntil = Math.max(this.quietUntil, Date.now() + (this.pending ? 300 : 0));   // a rebuild just happened: wait for a quiet moment
      this.openPending();
      this.restoreScroll();
    });

    const timers = new Map<string, number>();
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (!this.live.has(file.path)) return;
      window.clearTimeout(timers.get(file.path));
      timers.set(file.path, window.setTimeout(() => void this.refreshFile(file.path), 250));
    }));
  }

  env(sourcePath: string): Env {
    const app = this.app;
    return {
      prop: (note, keys, isMW): Value => {
        const f = app.metadataCache.getFirstLinkpathDest(note, sourcePath);
        if (!f) return ERR("#NOTE?", `no note called "${note}"`);
        const fm: Record<string, unknown> = app.metadataCache.getFileCache(f)?.frontmatter ?? {};
        const wanted = keys.map(k => k.toLowerCase());
        const mine = isMW ? this.settings().mwProperty?.trim() : "";   // the user's own MW property name wins over the built-in names
        const own = mine ? prop(fm, mine) : undefined;
        const key = Object.keys(fm).find(k => wanted.includes(k.toLowerCase()));
        const v = own != null && own !== "" ? own : key == null ? undefined : fm[key];
        if (v == null || v === "") return ERR("#PROP?", `"${note}" has no ${isMW ? "MW" : keys[0]} property`);
        if (typeof v === "number") return v;
        const num = parseFloat(text(v).replace(",", "."));
        return isMW ? (isNaN(num) ? ERR("#PROP?", `MW of "${note}" isn't a number`) : num) : (isNaN(num) ? text(v) : num);
      }
    };
  }

  async refreshFile(path: string, known?: string): Promise<void> {
    const set = this.live.get(path); if (!set) return;
    const file = this.app.vault.getAbstractFileByPath(path); if (!(file instanceof TFile)) return;
    const text = known ?? await this.app.vault.cachedRead(file);
    const blocks = extractBlocks(text);
    for (const entry of [...set]) {
      if (!entry.el.isConnected) { if (Date.now() - (entry.born ?? 0) > 5000) set.delete(entry); continue; }   // a new block may not be attached yet
      const info = entry.ctx.getSectionInfo(entry.el);
      if (info) { const blk = blocks.find(b => b.lineStart === info.lineStart); if (blk) entry.source = blk.source; }
      if (this.editor?.entry === entry) continue; // don't wipe a cell being typed in; saving redraws it
      await this.render(entry, text);
    }
    if (!set.size) this.live.delete(path);
    this.editor?.showRefs?.();                      // another table was redrawn: its marks are gone
  }

  async render(entry: CalcEntry, fileText?: string): Promise<void> {
    const { el, ctx } = entry;
    const self = parseBlock(entry.source);
    let others: ParsedBlock[] = [];
    try {
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      const text = fileText ?? (file instanceof TFile ? await this.app.vault.cachedRead(file) : "");
      const info = ctx.getSectionInfo(el);
      const blocks = extractBlocks(text);
      // Without section info, drop only the first block that is this one (not every same-named block).
      const selfAt = info ? blocks.findIndex(b => b.lineStart === info.lineStart) : blocks.findIndex(b => b.source === entry.source);
      others = blocks.filter((_, i) => i !== selfAt).map(b => parseBlock(b.source));
    } catch { /* evaluate on its own */ }
    const wb = new Workbook([self, ...others], this.env(ctx.sourcePath));
    const opts = self.opts;
    entry.parsed = self;

    el.empty();
    el.addClass("lab-kit");

    // ----- Caption: icon, title, name, then tools (kept left, clear of Obsidian's </> button) -----
    const cap = el.createDiv({ cls: "lab-kit-caption" });
    const ic = cap.createSpan({ cls: "lab-kit-icon" });
    const svg = getIcon(opts.icon || "table-2") ?? getIcon("table");
    if (svg) ic.appendChild(svg);
    cap.createSpan({ cls: "lab-kit-title", text: opts.title || opts.name || "Calculation" });
    if (self.name) cap.createEl("code", { cls: "lab-kit-name", text: self.name });
    if (wb.isDuplicate(self.name)) {
      cap.createSpan({
        cls: "lab-kit-warn", text: "⚠ name used twice",
        attr: { title: `Another table in this note is also named "${self.name}". Rename one, or references to it show #REF!` }
      });
    }
    const tools = cap.createSpan({ cls: "lab-kit-tools" });
    const mkBtn = (text: string, label: string): HTMLButtonElement => tools.createEl("button", { cls: "lab-kit-btn", text, attr: { "aria-label": label } });
    const addBtn = mkBtn("+ Row", "Add a row (formulas fill down)");
    const gridBtn = mkBtn("A1", "Show cell letters and row numbers");
    const copyBtn = mkBtn("Copy", opts.copy ? "Copy as one column for Excel" : "Copy results for Excel");

    const nCols = Math.max(0, ...self.cells.map(r => r.length));
    const scroller = el.createDiv({ cls: "lab-kit-scroll" });
    const table = scroller.createEl("table");
    let showGrid = /^(true|yes|1|on)$/i.test(opts.grid ?? "") || entry.grid === true;

    // Which blank inputs are blocking results in this table?
    const needed = new Set<string>();
    self.cells.forEach((row, r) => row.forEach((cell, c) => {
      if (cell.kind !== "formula") return;
      const v = wb.cell(0, r, c);
      if (isErr(v)) wb.blanksOf(0, r, c).forEach(k => needed.add(k));
    }));

    const build = (): void => {
      table.empty();
      entry.tds = new Map();
      entry.cells = new Map();
      table.toggleClass("show-grid", showGrid);
      const head = table.createEl("thead");
      if (showGrid) {
        const gr = head.createEl("tr", { cls: "lab-kit-grid-row" });
        gr.createEl("th", { cls: "lab-kit-corner" });
        for (let c = 0; c < nCols; c++) gr.createEl("th", { cls: "lab-kit-col", text: indexToCol(c) });
      }
      const body = table.createEl("tbody");
      self.cells.forEach((row, r) => {
        const tr = (r === 0 ? head : body).createEl("tr");
        if (showGrid) tr.createEl(r === 0 ? "th" : "td", { cls: "lab-kit-rownum", text: String(r + 1) });
        if (r > 0) tr.addEventListener("contextmenu", (ev) => this.rowMenu(ev, entry, r));
        for (let c = 0; c < nCols; c++) {
          const cell = row[c] ?? { raw: "", kind: "blank" as const };
          const td = tr.createEl(r === 0 ? "th" : "td");
          const addr = indexToCol(c) + (r + 1);
          if (cell.kind === "formula") {
            const v = wb.cell(0, r, c);
            td.addClass("is-formula");
            if (isErr(v)) {
              const blanks = [...wb.blanksOf(0, r, c)].map(k => wb.label(k));
              if (blanks.length) {
                td.addClass("is-needs");
                td.setText("needs " + blanks[0].text + (blanks.length > 1 ? ` +${blanks.length - 1}` : ""));
                td.setAttr("title", `${addr}  ${cell.raw}\nFill in first:\n` + blanks.map(b => `• ${b.text} (${b.addr})`).join("\n"));
              } else {
                td.addClass("is-error");
                td.setText(v.err);
                td.setAttr("title", `${addr}  ${cell.raw}\n${v.msg ?? cell.parseError ?? ""}`);
              }
            } else {
              if (typeof v === "number") td.addClass("is-number");
              td.setText(formatValue(v, opts));
              td.setAttr("title", `${addr}  ${cell.raw}`);
            }
          } else {
            if (cell.kind === "number") td.addClass("is-number");
            if (r > 0 && cell.kind === "blank") td.addClass("is-blank");
            if (r > 0 && cell.kind === "blank" && needed.has(`0|${r}|${c}`)) td.addClass("is-needed");
            this.fillText(td, cell.raw, ctx);
            if (r > 0) td.setAttr("title", `${addr}  click to edit`);
          }
          entry.cells?.set(`${r}|${c}`, td);
          if (r > 0) {
            td.addClass("is-editable");
            entry.tds?.set(`${r}|${c}`, td);
            // Pressing here blurs the open editor, whose save redraws the table before the click lands
            td.addEventListener("mousedown", (ev) => {
              const t = ev.target as HTMLElement;
              if (t.closest("a") || t.closest("input")) return;
              if (this.editor) this.setPending(entry, r, c);
            });
            td.addEventListener("click", (ev) => {
              if ((ev.target as HTMLElement).closest("a")) return;
              const p = this.pending;
              if (p && p.entry === entry && p.r === r && p.c === c) return; // opened after the save
              this.editCell(entry, r, c, td, cell.raw);
            });
          }
        }
      });
    };
    build();
    this.restoreScroll(); // every redraw during an edit's hold puts the page back, not only the edited block's

    const stop = (e: Event): void => { e.preventDefault(); e.stopPropagation(); };
    gridBtn.addEventListener("click", (e) => { stop(e); showGrid = !showGrid; entry.grid = showGrid; build(); });
    addBtn.addEventListener("click", (e) => { stop(e); void this.structural(entry, "insert", autoInsertIndex(self)); });
    const copy = async (): Promise<void> => {
      const val = (r: number, c: number): string => {
        const cell = self.cells[r]?.[c];
        if (!cell) return "";
        return cell.kind === "formula" ? formatValue(wb.cell(0, r, c), { sig: 10 }) : cleanLink(cell.raw);
      };
      let text: string;
      const colMatch = String(opts.copy ?? "").match(/^column\s+([A-Za-z]{1,3})$/i);
      if (colMatch) {
        const c = colToIndex(colMatch[1]);
        text = self.cells.slice(1).map((_, k) => val(k + 1, c)).filter(v => v !== "").join("\n");
      } else if (opts.copy === "list") {
        const out: string[] = [];
        for (let r = 1; r < self.cells.length; r++) for (let c = 1; c < nCols; c++) { const v = val(r, c); if (v !== "") out.push(v); }
        text = out.join("\n");
      } else {
        text = self.cells.map((row, r) => Array.from({ length: nCols }, (_, c) => val(r, c)).join("\t")).join("\n");
      }
      try { await navigator.clipboard.writeText(text); new Notice(opts.copy ? "Copied as one column, paste into Excel" : "Table copied, paste into Excel"); }
      catch { new Notice("Couldn't copy to the clipboard"); }
    };
    copyBtn.addEventListener("click", (e) => { stop(e); void copy(); });
  }

  rowMenu(ev: MouseEvent, entry: CalcEntry, r: number): void {
    ev.preventDefault();
    const menu = new Menu();
    menu.addItem(i => i.setTitle("Insert row above").setIcon("arrow-up").onClick(() => void this.structural(entry, "insert", r)));
    menu.addItem(i => i.setTitle("Insert row below").setIcon("arrow-down").onClick(() => void this.structural(entry, "insert", r + 1)));
    menu.addItem(i => i.setTitle("Delete row").setIcon("trash-2").onClick(() => void this.structural(entry, "delete", r)));
    menu.showAtMouseEvent(ev);
  }

  async structural(entry: CalcEntry, kind: "insert" | "delete", at: number): Promise<void> {
    const info = entry.ctx.getSectionInfo(entry.el);
    const file = this.app.vault.getAbstractFileByPath(entry.ctx.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice("Couldn't find this calc block. Edit it in source mode instead."); return; }
    let ok = true;
    await this.app.vault.process(file, (data) => {
      const out = editRows(data, info.lineStart, kind, at);
      if (out == null) { ok = false; return data; }
      return out;
    });
    if (!ok) new Notice("That row can't be changed");
  }

  fillText(td: HTMLElement, raw: string, ctx: MarkdownPostProcessorContext): void {
    if (/[[*_$<`~]/.test(raw)) {
      const span = td.createSpan();
      const child = new MarkdownRenderChild(span);
      ctx.addChild(child);
      void MarkdownRenderer.render(this.app, raw, span, ctx.sourcePath, child).then(() => {
        const p = span.querySelector("p");
        if (p && span.childElementCount === 1) { while (p.firstChild) span.appendChild(p.firstChild); p.remove(); }
      });
    } else td.setText(raw);
  }

  /** Marks the cells that the formula being typed points at (this table and other tables of the note). */
  private markRefs(entry: CalcEntry, r: number, c: number, text: string): void {
    this.clearRefs();
    if (!text.trim().startsWith("=")) return;
    const others = [...(this.live.get(entry.ctx.sourcePath) ?? [])].filter(e => e.el.isConnected);
    for (const ref of formulaRefs(text, { r, c })) {
      const target = ref.qual === null ? entry : others.find(e => e.parsed?.name === ref.qual);
      if (!target?.cells) continue;
      for (let rr = ref.r1; rr <= Math.min(ref.r2, ref.r1 + 200); rr++) for (let cc = ref.c1; cc <= Math.min(ref.c2, ref.c1 + 50); cc++) {
        const td = target.cells.get(`${rr}|${cc}`);
        if (td && td.isConnected && !td.hasClass("is-editing")) { td.addClass("is-ref"); this.marked.push(td); }
      }
    }
  }

  private clearRefs(): void {
    for (const td of this.marked) td.removeClass("is-ref");
    this.marked = [];
  }

  /** Click-to-edit for any body cell (values and formulas). */
  editCell(entry: CalcEntry, r: number, c: number, td: HTMLElement, current: string): void {
    if (td.querySelector("input")) return;
    td.setCssProps({ "--lab-kit-cell-w": `${td.offsetWidth}px` }); // keeps the column from widening
    td.empty();
    td.addClass("is-editing");
    const input = td.createEl("input", { cls: "lab-kit-input", attr: { type: "text" } });
    input.value = current;
    const mine: { entry: CalcEntry; showRefs?: () => void } = { entry };
    mine.showRefs = () => this.markRefs(entry, r, c, input.value);
    this.editor = mine;
    input.focus({ preventScroll: true }); input.select();
    // Typing [[ suggests the notes in the chemical folder, when one is set
    const folder = this.settings().chemicalFolder?.trim();
    let chemicals: Chemical[] | null = null;
    const suggest = folder ? new ChemicalSuggest(this.app, input, () => chemicals ??= listChemicals(this.app, folder)) : null;
    let done = false;
    const finish = async (save: boolean): Promise<void> => {
      if (done) return; done = true;
      this.clearRefs();
      if (this.editor === mine) this.editor = null;
      suggest?.close();
      const val = input.value.trim();
      if (save && val !== current) { this.holdScroll(entry.el); this.quietUntil = Date.now() + 400; }
      try {
        if (!save || val === current) await this.render(entry);
        else await this.refreshFile(entry.ctx.sourcePath, await this.writeCell(entry, r, c, val));
      } finally { this.openPending(); this.settleScroll(); }
    };
    input.addEventListener("keydown", (e) => {
      // With suggestions showing, Enter and Escape belong to the suggestion popup (pick / close)
      if (suggest?.shown && (e.key === "Enter" || e.key === "Escape")) return;
      // Enter / Tab save, Escape discards; stopPropagation keeps the editor and Obsidian's hotkeys from also acting on the key
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); void finish(true); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); void finish(false); }
    });
    input.addEventListener("blur", () => {
      if (!suggest?.shown) { void finish(true); return; }
      // Clicking a suggestion blurs the input for a moment: save only if the focus did not come back
      window.setTimeout(() => { if (input.ownerDocument.activeElement !== input) void finish(true); }, 200);
    });
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("input", () => mine.showRefs?.());
    mine.showRefs();                                // a formula already in the cell shows what it points at
  }

  /** Remembers where the note is scrolled to (Live Preview or Reading view), until the user scrolls themselves. */
  private holdScroll(el: HTMLElement): void {
    const scroller = el.closest<HTMLElement>(".cm-scroller") ?? el.closest<HTMLElement>(".markdown-preview-view");
    if (!scroller) { this.hold = null; return; }
    const now = Date.now();
    const h = { scroller, top: scroller.scrollTop, until: now + 1500, start: now };
    this.hold = h;
    // The user taking over (wheel, touch, or grabbing the scrollbar) ends the hold
    const ac = new AbortController();
    const drop = (): void => { if (this.hold === h) this.hold = null; ac.abort(); };
    scroller.addEventListener("wheel", drop, { signal: ac.signal, passive: true });
    scroller.addEventListener("touchmove", drop, { signal: ac.signal, passive: true });
    scroller.addEventListener("pointerdown", (e) => { if (e.target === scroller) drop(); }, { signal: ac.signal });
  }

  private restoreScroll(): void {
    const h = this.hold;
    if (!h) return;
    const now = Date.now();
    if (now > h.until) { this.hold = null; return; }
    if (h.scroller.scrollTop !== h.top) {
      h.scroller.scrollTop = h.top;
      // The layout is still moving (a big note redraws slowly): keep holding, for 8 s at most
      h.until = Math.min(Math.max(h.until, now + 1000), h.start + 8000);
    }
  }

  /** Restores at once and again while Obsidian lays out the redrawn block. */
  private settleScroll(): void {
    this.restoreScroll();
    window.requestAnimationFrame(() => this.restoreScroll());
    for (const ms of [100, 300, 700, 1200, 2000, 3500]) window.setTimeout(() => this.restoreScroll(), ms);
  }

  /** Opens the cell the user clicked while another one was being saved. */
  private openPending(): void {
    const p = this.pending;
    if (!p || this.editor) return;
    const entry = this.pendingTarget(p);
    const td = entry?.tds?.get(`${p.r}|${p.c}`);
    // Block not redrawn yet, or Obsidian may still rebuild it after the save: look again shortly (the expiry timer clears a click that never lands)
    if (!entry || !td || !td.isConnected || Date.now() < this.quietUntil) { this.retryPending(); return; }
    this.clearPending();
    this.editCell(entry, p.r, p.c, td, entry.parsed?.cells[p.r]?.[p.c]?.raw ?? "");
  }

  private retryPending(): void {
    if (this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => { this.retryTimer = 0; if (this.pending) this.openPending(); }, 80);
  }

  private setPending(entry: CalcEntry, r: number, c: number): void {
    this.clearPending();
    const line = entry.ctx.getSectionInfo(entry.el)?.lineStart ?? null;
    this.pending = { entry, path: entry.ctx.sourcePath, line, r, c };
    this.pendingTimer = window.setTimeout(() => { this.pending = null; }, 2000);
  }

  private clearPending(): void {
    window.clearTimeout(this.pendingTimer);
    this.pending = null;
  }

  /** The live block the pending click belongs to: the same entry if still on screen, else the one at the same line. */
  private pendingTarget(p: { entry: CalcEntry; path: string; line: number | null }): CalcEntry | undefined {
    if (p.entry.el.isConnected) return p.entry;
    if (p.line == null) return undefined;
    for (const e of this.live.get(p.path) ?? []) {
      if (e.el.isConnected && e.ctx.getSectionInfo(e.el)?.lineStart === p.line) return e;
    }
    return undefined;
  }

  /** Writes one cell back into the note; returns the new note text (undefined if it couldn't). */
  async writeCell(entry: CalcEntry, r: number, c: number, val: string): Promise<string | undefined> {
    const { el, ctx } = entry;
    const info = ctx.getSectionInfo(el);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice("Couldn't find this calc block. Edit it in source mode instead."); return undefined; }
    let out: string | undefined;
    await this.app.vault.process(file, (data) => (out = writeCellText(data, info.lineStart, r, c, val)));
    return out;
  }
}
