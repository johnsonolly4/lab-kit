// Renders ```solution blocks (read only): the set-up and the typed actuals of the block, worked out by src/solution/view.ts and drawn with div rows
// (no <table>, so a vault's table styling cannot reach it). Redrawn when the note or the reagent's chemical note changes.
// Plan: docs/plans/solution-live-block.md, Phase 3. Typing into the block is Phase 4.
import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { ChemSettings } from "../calc/render";
import { readReagent } from "./reagent";
import { blockRange, parseSolution } from "./block";
import { buildView, reagentName, TEXT, type ReagentLookup, type View } from "./view";

export class SolutionRenderer {
  /** The open blocks, so an edit to their note or to their reagent's note redraws them. */
  private views = new Set<SolutionView>();

  constructor(private plugin: Plugin, private settings: () => ChemSettings = () => ({})) {}

  get app(): App { return this.plugin.app; }

  /** Registers the ```solution processor and the redraw-on-edit listeners. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("solution", (source, el, ctx) => { ctx.addChild(new SolutionView(el, this, source, ctx)); });

    const timers = new Map<string, number>();
    const later = (path: string, hit: (v: SolutionView) => boolean) => {
      if (![...this.views].some(hit)) return;
      window.clearTimeout(timers.get(path));
      timers.set(path, window.setTimeout(() => { for (const v of this.views) if (hit(v)) v.draw(); }, 250));
    };
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => later(file.path, v => v.sourcePath === file.path)));
    this.plugin.registerEvent(this.app.metadataCache.on("changed", (file) => later(file.path, v => v.reagentPath === file.path && v.sourcePath !== file.path)));
  }

  add(v: SolutionView): void { this.views.add(v); }
  remove(v: SolutionView): void { this.views.delete(v); }

  /** The reagent note for a name, as the maths reads it. */
  lookup(name: string, sourcePath: string): ReagentLookup & { path: string | null } {
    const f = this.app.metadataCache.getFirstLinkpathDest(name, sourcePath);
    if (!f) return { name, read: null, path: null };
    const fm: Record<string, unknown> | undefined = this.app.metadataCache.getFileCache(f)?.frontmatter;
    return { name, read: readReagent(fm, this.settings().mwProperty), path: f.path };
  }
}

class SolutionView extends MarkdownRenderChild {
  reagentPath: string | null = null;
  private shown: string | null = null;
  private drawing = 0;

  constructor(el: HTMLElement, private owner: SolutionRenderer, private source: string, private ctx: MarkdownPostProcessorContext) { super(el); }

  get sourcePath(): string { return this.ctx.sourcePath; }

  onload(): void { this.owner.add(this); this.paint(); }
  onunload(): void { this.owner.remove(this); }

  /** Re-reads the block text from the note (it may have been edited), then draws. */
  draw(): void {
    const run = ++this.drawing;
    void this.reread().then(() => { if (run === this.drawing) this.paint(); }).catch(e => { console.error("Lab Kit solution block", e); });
  }

  private async reread(): Promise<void> {
    const app = this.owner.app;
    const info = this.ctx.getSectionInfo(this.containerEl);
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    if (!info || !(file instanceof TFile)) return;
    const r = blockRange(await app.vault.cachedRead(file), info.lineStart);
    if (r) this.source = r.source;
  }

  private paint(): void {
    let found: (ReagentLookup & { path: string | null }) | null = null;
    const name = reagentName(parseSolution(this.source).setup.reagent);
    const view = buildView(this.source, n => (found = this.owner.lookup(n, this.sourcePath)));
    this.reagentPath = name && found ? (found as { path: string | null }).path : null;
    const sig = JSON.stringify(view);
    if (sig === this.shown) return;
    this.shown = sig;
    this.containerEl.empty();
    drawView(this.containerEl, view);
  }
}

/** The DOM of one block: `div` rows with ARIA roles, `.lk-sol-*` classes (styles.css). */
export function drawView(host: HTMLElement, view: View): void {
  const box = host.createDiv({ cls: "lk-sol" });
  if (view.newer) { box.createDiv({ cls: "lk-sol-note", text: view.newer }); return; }
  if (view.errors.length) {
    const list = box.createDiv({ cls: "lk-sol-errors" });
    for (const e of view.errors) list.createDiv({ cls: "lk-sol-error", text: e });
    return;
  }
  const head = box.createDiv({ cls: "lk-sol-head" });
  head.createSpan({ cls: "lk-sol-title", text: view.title });
  head.createSpan({ cls: view.status === "done" ? "lk-sol-chip is-done" : "lk-sol-chip", text: view.status });
  box.createDiv({ cls: "lk-sol-summary", text: view.summary });
  for (const step of view.steps) {
    const sec = box.createDiv({ cls: step.done ? "lk-sol-step is-done" : "lk-sol-step" });
    sec.createDiv({ cls: "lk-sol-step-title", text: step.title });
    const grid = sec.createDiv({ cls: "lk-sol-grid", attr: { role: "table" } });
    const head = grid.createDiv({ cls: "lk-sol-row is-head", attr: { role: "row" } });
    head.createDiv({ cls: "lk-sol-cell", attr: { role: "columnheader" } });
    head.createDiv({ cls: "lk-sol-cell is-num", text: "Target", attr: { role: "columnheader" } });
    head.createDiv({ cls: "lk-sol-cell is-num", text: "Actual", attr: { role: "columnheader" } });
    for (const r of step.rows) {
      const row = grid.createDiv({ cls: "lk-sol-row", attr: { role: "row" } });
      row.createDiv({ cls: "lk-sol-cell", text: r.label, attr: { role: "cell" } });
      row.createDiv({ cls: "lk-sol-cell is-num is-target", text: r.target, attr: { role: "cell" } });
      row.createDiv({ cls: r.actual ? "lk-sol-cell is-num is-actual" : "lk-sol-cell is-num is-actual is-empty", text: r.actual, attr: { role: "cell" } });
    }
  }
  if (view.estimate) {
    const est = box.createDiv({ cls: "lk-sol-estimate" });
    est.createSpan({ text: `${TEXT.estimate} ` });
    est.createSpan({ cls: "lk-sol-estimate-value", text: `${view.estimate.pH}*` });
    if (view.estimate.range) est.createSpan({ cls: "lk-sol-estimate-range", text: ` (${view.estimate.range})` });
  }
  box.createDiv({ cls: "lk-sol-caution", text: view.caution });
  if (view.approx) box.createDiv({ cls: "lk-sol-approx", text: view.approx });
}
