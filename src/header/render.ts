// Renders ```lab-header blocks: data-folder button + hazard summary for the note's Chemicals.
// Unlike the old Dataview script it redraws only when this note's Chemicals or a linked chemical note really changed.
import type { App, MarkdownPostProcessorContext, Plugin } from "obsidian";
import { hasNode } from "../platform";
import { openDataFolder } from "../kit/datafolder";
import { LEVELS } from "./ghs";
import { collectHazards, hazardSignature, hazardSources, levelCounts, type HazardData, type HazardRow, type Phrase } from "./hazards";
import { hazardView, parseBlock, splitClasses, type BlockOptions, type HazardView, type HeaderStore } from "./settings";

/** One rendered ```lab-header block. */
export interface HeaderEntry {
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
  /** Where the hazards go; redrawn on its own so the button is never rebuilt. */
  hazardsEl: HTMLElement;
  /** Options written inside this block, on top of the plugin settings. */
  over: Partial<HazardView>;
  block: BlockOptions;
  sig: string;
  sources: Set<string>;
  hasMissing: boolean;
  /** Whether the user left the summary open; kept across redraws. */
  open: boolean;
}

const H_CODES = /H\d{3}[A-Za-z]*(?:\s*\+\s*H\d{3}[A-Za-z]*)*/;

export class HeaderRenderer {
  /** Rendered blocks per note path. */
  live = new Map<string, Set<HeaderEntry>>();
  /** Number of times a block's DOM was rebuilt (read by tests). */
  draws = 0;

  constructor(private plugin: Plugin, private store: HeaderStore) {}

  get app(): App { return this.plugin.app; }

  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("lab-header", (source, el, ctx) => {
      const entry = this.build(source, el, ctx);
      if (!this.live.has(ctx.sourcePath)) this.live.set(ctx.sourcePath, new Set());
      this.live.get(ctx.sourcePath)!.add(entry);
      this.draw(entry);
    });
    const touch = (path: string): void => this.refreshFor(path);
    this.plugin.registerEvent(this.app.metadataCache.on("changed", (file) => touch(file.path)));
    this.plugin.registerEvent(this.app.vault.on("delete", (file) => touch(file.path)));
    this.plugin.registerEvent(this.app.vault.on("rename", (_file, oldPath) => touch(oldPath)));
    this.store.onChange = () => this.refreshAll();
  }

  /** Builds the fixed parts of a block (button bar); hazards are filled in by draw(). */
  build(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): HeaderEntry {
    const { block, over } = parseBlock(source);
    el.addClass("lab-header");
    if (block.dataFolder) {
      const bar = el.createDiv({ cls: "lab-header-bar" });
      if (hasNode()) {
        const noteName = ctx.sourcePath.split("/").pop()!.replace(/\.md$/, "");
        const btn = bar.createEl("button", { text: "📁 Open data folder" });
        btn.addEventListener("click", () => openDataFolder(noteName, this.store.settings));
      } else {
        bar.createSpan({ cls: "lab-header-muted", text: "📁 Data folder: desktop only" });
      }
    }
    const hazardsEl = el.createDiv({ cls: "lab-hazards-host" });
    return { ctx, el, hazardsEl, over, block, sig: "", sources: new Set(), hasMissing: false, open: true };
  }

  view(entry: HeaderEntry): HazardView { return hazardView(this.store.settings, entry.over); }

  collect(entry: HeaderEntry, v: HazardView): HazardData {
    return collectHazards(this.app, entry.ctx.sourcePath, {
      chemicalsProperty: v.chemicalsProperty, classProperty: v.classProperty,
      hideForClasses: splitClasses(v.hideForClasses), sortByWorstHazard: v.sortByWorstHazard, showMissing: v.showMissing
    });
  }

  /** Recomputes the hazards and rebuilds the DOM only if something visible changed. */
  draw(entry: HeaderEntry): void {
    if (!entry.block.hazards) return;
    const v = this.view(entry);
    const data = this.collect(entry, v);
    const sig = JSON.stringify(v) + "|" + hazardSignature(data);
    entry.sources = hazardSources(entry.ctx.sourcePath, data);
    entry.hasMissing = data.rows.some(r => !r.path);
    if (sig === entry.sig) return;
    entry.sig = sig;
    this.draws++;

    const host = entry.hazardsEl;
    const old = host.querySelector("details");
    if (old) entry.open = old.open;
    else if (!host.childElementCount) entry.open = v.startOpen;
    host.empty();
    if (data.hidden) return;

    let body: HTMLElement = host;
    if (v.collapsed) {
      const details = host.createEl("details", { cls: "lab-hazards" });
      details.open = entry.open;
      this.summary(details.createEl("summary"), data, v);
      body = details;
    }
    if (!data.rows.length) return;
    const content = v.collapsed ? body.createDiv() : body;
    if (v.layout === "table") this.table(content, data.rows, entry, v); else this.chips(content, data.rows, entry, v);
    if (v.showLegend) this.legend(content, v);
  }

  summary(el: HTMLElement, data: HazardData, v: HazardView): void {
    el.createSpan({ text: "⚠️ " });
    el.createEl("b", { text: "Hazards" });
    if (!data.rows.length) {
      el.createSpan({ cls: "lab-header-muted", text: `: add chemicals to the ${v.chemicalsProperty} property` });
      return;
    }
    if (!v.showSummaryCounts) return;
    const n = data.rows.length;
    el.createSpan({ cls: "lab-header-muted", text: ` · ${n} chemical${n === 1 ? "" : "s"} ` });
    for (const c of levelCounts(data.rows)) {
      el.createSpan({ cls: "lab-hazard-chip is-bold", text: `${LEVELS[c.level].name} ${c.n}`, attr: { "data-level": String(c.level) } });
      el.appendText(" ");
    }
  }

  legend(parent: HTMLElement, v: HazardView): void {
    const legend = parent.createDiv({ cls: "lab-hazard-legend" });
    LEVELS.forEach((l, i) => {
      const item = legend.createSpan({ cls: "lab-hazard-legend-item", attr: { title: l.desc } });
      if (v.legendDetails) item.addClass("has-details");
      item.createSpan({ cls: "lab-hazard-chip is-bold", text: l.name, attr: { "data-level": String(i) } });
      if (v.legendDetails) item.createSpan({ cls: "lab-header-muted lab-hazard-legend-desc", text: l.desc });
    });
  }

  /** Chemical name as a clickable link to its note, or plain text when there is no note. */
  link(parent: HTMLElement, row: HazardRow, entry: HeaderEntry): void {
    if (!row.path) { parent.createSpan({ text: row.name }); return; }
    const path = row.path;
    const a = parent.createEl("a", { cls: "internal-link", text: row.name, attr: { href: path, "data-href": path } });
    a.addEventListener("click", (e) => {
      e.preventDefault();
      void this.app.workspace.openLinkText(path, entry.ctx.sourcePath, e.ctrlKey || e.metaKey);
    });
  }

  note(parent: HTMLElement, row: HazardRow, v: HazardView): void {
    if (!v.showMissing) return;
    parent.createSpan({ cls: "lab-header-muted", text: row.path ? "⚠ no H_Phrase in this chemical's note" : "⚠ no chemical note found" });
  }

  /** The coloured part of a phrase: the whole phrase, or just the H-code (plus the category when asked). */
  chip(parent: HTMLElement, p: Phrase, v: HazardView): void {
    const code = p.text.match(H_CODES)?.[0];
    parent.createSpan({
      cls: v.highlightWholePhrase ? "lab-hazard-chip" : "lab-hazard-chip is-bold",
      text: v.highlightWholePhrase ? p.text : code ?? p.text,
      attr: { "data-level": String(p.level), title: p.text }
    });
    if (v.showCategoryLabels && p.cat !== "9") parent.createSpan({ cls: "lab-header-muted lab-hazard-cat", text: ` Cat ${p.cat}` });
  }

  /** Compact layout: one row per chemical, one chip per H-code (full phrase on hover). */
  chips(body: HTMLElement, rows: HazardRow[], entry: HeaderEntry, v: HazardView): void {
    const list = body.createDiv({ cls: "lab-hazard-list" });
    for (const row of rows) {
      const line = list.createDiv({ cls: "lab-hazard-row" });
      const name = line.createDiv({ cls: "lab-hazard-name" });
      if (v.shadeChemicalCell && row.phrases.length) name.setAttr("data-level", String(row.topLevel));
      this.link(name, row, entry);
      const chips = line.createDiv({ cls: "lab-hazard-chips" });
      if (!row.phrases.length) { this.note(chips, row, v); continue; }
      for (const p of row.phrases) this.chip(chips.createSpan({ cls: "lab-hazard-phrase" }), p, v);
    }
  }

  /** The two-column table as in the Dataview version. */
  table(body: HTMLElement, rows: HazardRow[], entry: HeaderEntry, v: HazardView): void {
    const table = body.createEl("table", { cls: "lab-hazard-table" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: "Chemical" });
    head.createEl("th", { text: "Hazard phrase" });
    const tbody = table.createEl("tbody");
    for (const row of rows) {
      const tr = tbody.createEl("tr");
      const first = tr.createEl("td", { cls: v.centreChemicalCell ? "lab-hazard-name is-centred" : "lab-hazard-name" });
      if (v.shadeChemicalCell && row.phrases.length) first.setAttr("data-level", String(row.topLevel));
      this.link(first, row, entry);
      const cell = tr.createEl("td");
      if (!row.phrases.length) { this.note(cell, row, v); continue; }
      for (const p of row.phrases) {
        const line = cell.createDiv();
        const code = p.text.match(H_CODES)?.[0];
        if (v.highlightWholePhrase || !code) { this.chip(line, p, v); continue; }
        const at = p.text.indexOf(code);
        line.appendText(p.text.slice(0, at));
        line.createSpan({ cls: "lab-hazard-chip is-bold", text: code, attr: { "data-level": String(p.level) } });
        line.appendText(p.text.slice(at + code.length));
        if (v.showCategoryLabels && p.cat !== "9") line.createSpan({ cls: "lab-header-muted lab-hazard-cat", text: ` Cat ${p.cat}` });
      }
    }
  }

  /** A file changed: redraw only the blocks that depend on it. */
  refreshFor(path: string): void {
    for (const [notePath, set] of this.live) {
      for (const entry of [...set]) {
        if (!entry.el.isConnected) { set.delete(entry); continue; }
        // A block with an unresolved chemical also reacts to any change, since the missing note may just have appeared
        if (path === notePath || entry.sources.has(path) || entry.hasMissing) this.draw(entry);
      }
      if (!set.size) this.live.delete(notePath);
    }
  }

  refreshAll(): void {
    for (const set of this.live.values()) for (const entry of set) if (entry.el.isConnected) this.draw(entry);
  }
}
