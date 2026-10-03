// Renders ```calc blocks as live tables: click-to-edit, + Row, A1 grid, Copy, row menu.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.
import { MarkdownRenderChild, MarkdownRenderer, Menu, Notice, TFile, getIcon, type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import {
  ERR, cleanLink, colToIndex, extractBlocks, formatValue, indexToCol, isErr, parseBlock, text, Workbook,
  type Env, type ParsedBlock, type Value
} from "./engine";
import { autoInsertIndex, editRows, writeCellText } from "./rewrite";

/** One rendered ```calc block. */
export interface CalcEntry {
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  source: string;
  parsed?: ParsedBlock;
  grid?: boolean;
  /** Body cells of the current render, keyed `row|col`, so a click can be carried over a re-render. */
  tds?: Map<string, HTMLElement>;
}

export class CalcRenderer {
  /** Rendered blocks per note path, so edits to the note refresh them. */
  live = new Map<string, Set<CalcEntry>>();
  /** The cell being edited, if any (one at a time). */
  private editor: { entry: CalcEntry } | null = null;
  /**
   * Cell clicked while another was being edited: opened once the save and redraw are done.
   * Obsidian may rebuild the whole block after the save (new element, new entry), so it is
   * matched by note path + block start line, not by entry.
   */
  private pending: { entry: CalcEntry; path: string; line: number | null; r: number; c: number } | null = null;
  private pendingTimer = 0;
  /** Scroll position of the note while an edit is saved: a rebuilt block can collapse for a moment and drag the page. */
  private hold: { scroller: HTMLElement; top: number; until: number } | null = null;

  constructor(private plugin: Plugin) {}

  get app(): App { return this.plugin.app; }

  /** Registers the ```calc processor and the refresh-on-edit listener. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("calc", async (source, el, ctx) => {
      const entry: CalcEntry = { el, ctx, source };
      if (!this.live.has(ctx.sourcePath)) this.live.set(ctx.sourcePath, new Set());
      this.live.get(ctx.sourcePath)!.add(entry);
      await this.render(entry);
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
        const key = Object.keys(fm).find(k => wanted.includes(k.toLowerCase()));
        if (key == null || fm[key] == null || fm[key] === "") return ERR("#PROP?", `"${note}" has no ${isMW ? "MW" : keys[0]} property`);
        const v = fm[key];
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
      if (!entry.el.isConnected) { set.delete(entry); continue; }
      const info = entry.ctx.getSectionInfo(entry.el);
      if (info) { const blk = blocks.find(b => b.lineStart === info.lineStart); if (blk) entry.source = blk.source; }
      if (this.editor?.entry === entry) continue; // don't wipe a cell being typed in; saving redraws it
      await this.render(entry, text);
    }
    if (!set.size) this.live.delete(path);
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

  /** Click-to-edit for any body cell (values and formulas). */
  editCell(entry: CalcEntry, r: number, c: number, td: HTMLElement, current: string): void {
    if (td.querySelector("input")) return;
    td.setCssProps({ "--lab-kit-cell-w": `${td.offsetWidth}px` }); // keeps the column from widening
    td.empty();
    td.addClass("is-editing");
    const input = td.createEl("input", { cls: "lab-kit-input", attr: { type: "text" } });
    input.value = current;
    const mine = { entry };
    this.editor = mine;
    input.focus({ preventScroll: true }); input.select();
    let done = false;
    const finish = async (save: boolean): Promise<void> => {
      if (done) return; done = true;
      if (this.editor === mine) this.editor = null;
      const val = input.value.trim();
      if (save && val !== current) this.holdScroll(entry.el);
      try {
        if (!save || val === current) await this.render(entry);
        else await this.refreshFile(entry.ctx.sourcePath, await this.writeCell(entry, r, c, val));
      } finally { this.openPending(); this.settleScroll(); }
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); void finish(true); }
      if (e.key === "Escape") { e.preventDefault(); void finish(false); }
    });
    input.addEventListener("blur", () => void finish(true));
    input.addEventListener("click", (e) => e.stopPropagation());
  }

  /** Remembers where the note is scrolled to (Live Preview or Reading view), until the user scrolls themselves. */
  private holdScroll(el: HTMLElement): void {
    const scroller = el.closest<HTMLElement>(".cm-scroller") ?? el.closest<HTMLElement>(".markdown-preview-view");
    if (!scroller) { this.hold = null; return; }
    const h = { scroller, top: scroller.scrollTop, until: Date.now() + 1500 };
    this.hold = h;
    const drop = (): void => { if (this.hold === h) this.hold = null; };
    scroller.addEventListener("wheel", drop, { once: true });
    scroller.addEventListener("touchmove", drop, { once: true });
  }

  private restoreScroll(): void {
    const h = this.hold;
    if (!h) return;
    if (Date.now() > h.until) { this.hold = null; return; }
    if (h.scroller.scrollTop !== h.top) h.scroller.scrollTop = h.top;
  }

  /** Restores at once and again while Obsidian lays out the redrawn block. */
  private settleScroll(): void {
    this.restoreScroll();
    window.requestAnimationFrame(() => this.restoreScroll());
    for (const ms of [100, 300, 700]) window.setTimeout(() => this.restoreScroll(), ms);
  }

  /** Opens the cell the user clicked while another one was being saved. */
  private openPending(): void {
    const p = this.pending;
    if (!p || this.editor) return;
    const entry = this.pendingTarget(p);
    const td = entry?.tds?.get(`${p.r}|${p.c}`);
    if (!entry || !td || !td.isConnected) return; // block not redrawn yet: the expiry timer clears it
    this.clearPending();
    this.editCell(entry, p.r, p.c, td, entry.parsed?.cells[p.r]?.[p.c]?.raw ?? "");
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
