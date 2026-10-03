// Renders ```calc blocks as live tables: click-to-edit, + Row, A1 grid, Copy, row menu.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.
import { MarkdownRenderer, Menu, Notice, getIcon, type App, type MarkdownPostProcessorContext, type Plugin, type TFile } from "obsidian";
import {
  ERR, cleanLink, colToIndex, extractBlocks, formatValue, indexToCol, isErr, parseBlock, Workbook,
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
}

export class CalcRenderer {
  /** Rendered blocks per note path, so edits to the note refresh them. */
  live = new Map<string, Set<CalcEntry>>();

  constructor(private plugin: Plugin) {}

  get app(): App { return this.plugin.app; }

  /** Registers the ```calc processor and the refresh-on-edit listener. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("calc", async (source, el, ctx) => {
      const entry: CalcEntry = { el, ctx, source };
      if (!this.live.has(ctx.sourcePath)) this.live.set(ctx.sourcePath, new Set());
      this.live.get(ctx.sourcePath)!.add(entry);
      await this.render(entry);
    });

    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (!this.live.has(file.path)) return;
      clearTimeout(timers.get(file.path));
      timers.set(file.path, setTimeout(() => void this.refreshFile(file.path), 250));
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
        const num = parseFloat(String(v).replace(",", "."));
        return isMW ? (isNaN(num) ? ERR("#PROP?", `MW of "${note}" isn't a number`) : num) : (isNaN(num) ? String(v) : num);
      }
    };
  }

  async refreshFile(path: string): Promise<void> {
    const set = this.live.get(path); if (!set) return;
    const file = this.app.vault.getAbstractFileByPath(path); if (!file) return;
    const text = await this.app.vault.cachedRead(file as TFile);
    const blocks = extractBlocks(text);
    for (const entry of [...set]) {
      if (!entry.el.isConnected) { set.delete(entry); continue; }
      const info = entry.ctx.getSectionInfo(entry.el);
      if (info) { const blk = blocks.find(b => b.lineStart === info.lineStart); if (blk) entry.source = blk.source; }
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
      const text = fileText ?? (file ? await this.app.vault.cachedRead(file as TFile) : "");
      const info = ctx.getSectionInfo(el);
      others = extractBlocks(text)
        .filter(b => !info || b.lineStart !== info.lineStart)
        .map(b => parseBlock(b.source))
        .filter(b => !self.name || b.name !== self.name);
    } catch (e) { /* evaluate on its own */ }
    const wb = new Workbook([self, ...others], this.env(ctx.sourcePath));
    const opts = self.opts;
    entry.parsed = self;

    el.empty();
    el.addClass("lab-calc");

    // ----- Caption: icon, title, name, then tools (kept left, clear of Obsidian's </> button) -----
    const cap = el.createDiv({ cls: "lab-calc-caption" });
    const ic = cap.createSpan({ cls: "lab-calc-icon" });
    const svg = getIcon(opts.icon || "table-2") ?? getIcon("table");
    if (svg) ic.appendChild(svg);
    cap.createSpan({ cls: "lab-calc-title", text: opts.title || opts.name || "Calculation" });
    if (self.name) cap.createEl("code", { cls: "lab-calc-name", text: self.name });
    const tools = cap.createSpan({ cls: "lab-calc-tools" });
    const mkBtn = (text: string, label: string): HTMLButtonElement => tools.createEl("button", { cls: "lab-calc-btn", text, attr: { "aria-label": label } });
    const addBtn = mkBtn("+ Row", "Add a row (formulas fill down)");
    const gridBtn = mkBtn("A1", "Show cell letters and row numbers");
    const copyBtn = mkBtn("Copy", opts.copy ? "Copy as one column for Excel" : "Copy results for Excel");

    const nCols = Math.max(0, ...self.cells.map(r => r.length));
    const scroller = el.createDiv({ cls: "lab-calc-scroll" });
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
      table.toggleClass("show-grid", showGrid);
      const head = table.createEl("thead");
      if (showGrid) {
        const gr = head.createEl("tr", { cls: "lab-calc-grid-row" });
        gr.createEl("th", { cls: "lab-calc-corner" });
        for (let c = 0; c < nCols; c++) gr.createEl("th", { cls: "lab-calc-col", text: indexToCol(c) });
      }
      const body = table.createEl("tbody");
      self.cells.forEach((row, r) => {
        const tr = (r === 0 ? head : body).createEl("tr");
        if (showGrid) tr.createEl(r === 0 ? "th" : "td", { cls: "lab-calc-rownum", text: String(r + 1) });
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
            if (r > 0 && cell.kind === "blank" && needed.has(`0|${r}|${c}`)) td.addClass("is-needed");
            this.fillText(td, cell.raw, ctx);
            if (r > 0) td.setAttr("title", `${addr}  click to edit`);
          }
          if (r > 0) {
            td.addClass("is-editable");
            td.addEventListener("click", (ev) => {
              if ((ev.target as HTMLElement).closest("a")) return;
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
    copyBtn.addEventListener("click", async (e) => {
      stop(e);
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
    });
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
    if (!info || !file) { new Notice("Couldn't find this calc block. Edit it in source mode instead."); return; }
    let ok = true;
    await this.app.vault.process(file as TFile, (data) => {
      const out = editRows(data, info.lineStart, kind, at);
      if (out == null) { ok = false; return data; }
      return out;
    });
    if (!ok) new Notice("That row can't be changed");
  }

  fillText(td: HTMLElement, raw: string, ctx: MarkdownPostProcessorContext): void {
    if (/[[*_$<`~]/.test(raw)) {
      const span = td.createSpan();
      void MarkdownRenderer.render(this.app, raw, span, ctx.sourcePath, this.plugin).then(() => {
        const p = span.querySelector("p");
        if (p && span.childElementCount === 1) { while (p.firstChild) span.appendChild(p.firstChild); p.remove(); }
      });
    } else td.setText(raw);
  }

  /** Click-to-edit for any body cell (values and formulas). */
  editCell(entry: CalcEntry, r: number, c: number, td: HTMLElement, current: string): void {
    if (td.querySelector("input")) return;
    td.empty();
    td.addClass("is-editing");
    const input = td.createEl("input", { cls: "lab-calc-input", attr: { type: "text" } });
    input.value = current;
    input.focus(); input.select();
    let done = false;
    const finish = async (save: boolean): Promise<void> => {
      if (done) return; done = true;
      const val = input.value.trim();
      if (!save || val === current) { await this.render(entry); return; }
      await this.writeCell(entry, r, c, val);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); void finish(true); }
      if (e.key === "Escape") { e.preventDefault(); void finish(false); }
    });
    input.addEventListener("blur", () => void finish(true));
    input.addEventListener("click", (e) => e.stopPropagation());
  }

  async writeCell(entry: CalcEntry, r: number, c: number, val: string): Promise<void> {
    const { el, ctx } = entry;
    const info = ctx.getSectionInfo(el);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!info || !file) { new Notice("Couldn't find this calc block. Edit it in source mode instead."); return; }
    await this.app.vault.process(file as TFile, (data) => writeCellText(data, info.lineStart, r, c, val));
  }
}
