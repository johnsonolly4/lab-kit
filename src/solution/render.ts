// Renders ```solution blocks (read only): the set-up and the typed actuals of the block, worked out by src/solution/view.ts and drawn with div rows
// (no <table>, so a vault's table styling cannot reach it). Redrawn when the note or the reagent's chemical note changes.
// Plan: docs/plans/solution-live-block.md, Phase 3 (drawing) and Phase 4 (typing an actual writes its own line; a missing reagent property is asked once).
import { MarkdownRenderChild, Notice, Platform, TFile, type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { ChemSettings } from "../calc/render";
import type { FormFn } from "../kit/snippet-form";
import { readReagent } from "./reagent";
import { blockRange, parseSolution, writeActual, writeSetup } from "./block";
import { askReagent } from "./ask-reagent";
import { NOT_A_MASS, actualText, cellsOf, nextCell } from "./edit";
import { holdScroll, processNote } from "../blocks/core";
import { openSetup, reagentChoices, SETUP_HINT, type SetupFn } from "./setup";
import { setupChanges, valuesFromSetup } from "./setup-text";
import { buildView, reagentName, TEXT, type ActualField, type ReagentLookup, type View } from "./view";

export class SolutionRenderer {
  /** The open blocks, so an edit to their note or to their reagent's note redraws them. */
  private views = new Set<SolutionView>();

  /** The Actual cell to open once the block is drawn again (Enter / Tab moved on); a redrawn block may be a new view, so it is kept here. */
  pending: { path: string; line: number; idx: number; until: number } | null = null;

  /** `form` = the plugin's question window, used to ask a missing reagent property (without it that line is only text). */
  constructor(private plugin: Plugin, private settings: () => ChemSettings = () => ({}), readonly form: FormFn | null = null, readonly setup: SetupFn = openSetup) {}

  /** The chemical notes the set-up window lists. */
  choices() { return reagentChoices(this.app, this.settings().chemicalFolder ?? "", this.settings().mwProperty); }

  get mwProperty(): string { return this.settings().mwProperty ?? ""; }

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
  private view: View | null = null;
  private cells: HTMLElement[] = [];
  /** The Actual cell being typed in; while it is open a redraw waits. */
  private editing: number | null = null;
  private stale = false;

  constructor(el: HTMLElement, private owner: SolutionRenderer, private source: string, private ctx: MarkdownPostProcessorContext) { super(el); }

  get sourcePath(): string { return this.ctx.sourcePath; }

  get line(): number | null { return this.ctx.getSectionInfo(this.containerEl)?.lineStart ?? null; }

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
    if (this.editing !== null) { this.stale = true; return; }
    let found: (ReagentLookup & { path: string | null }) | null = null;
    const name = reagentName(parseSolution(this.source).setup.reagent);
    const view = buildView(this.source, n => (found = this.owner.lookup(n, this.sourcePath)));
    this.reagentPath = name && found ? (found as { path: string | null }).path : null;
    const sig = JSON.stringify(view);
    if (sig === this.shown) return;
    this.shown = sig;
    this.containerEl.empty();
    this.view = view;
    this.cells = drawView(this.containerEl, view, { edit: i => { this.owner.pending = null; this.edit(i); }, ask: () => { void this.ask(); }, editSetup: btn => { void this.editSetup(btn); } });
    this.openPending();
  }

  private openPending(): void {
    const p = this.owner.pending;
    if (!p || Date.now() > p.until || p.path !== this.sourcePath || p.line !== this.line || !this.cells[p.idx] || this.editing !== null) return;
    // A copy that is not on screen (yet, or hidden: Reading view and Live Preview both keep one) must not take the editor; look again shortly
    if (!this.containerEl.isConnected || this.containerEl.offsetParent === null) { window.setTimeout(() => this.openPending(), 100); return; }
    this.edit(p.idx);   // kept (not cleared) so the view Obsidian draws after the note changed opens it as well; the next Enter / Esc / click sets it again or clears it
  }

  /** A missing reagent property: ask for it and save it in the chemical note (the block redraws when the note changes). */
  private async ask(): Promise<void> {
    const form = this.owner.form, file = this.reagentPath ? this.owner.app.vault.getAbstractFileByPath(this.reagentPath) : null;
    if (!form || !(file instanceof TFile) || !this.view?.ask.length) return;
    if (await askReagent(this.owner.app, form, file, this.view.ask, this.owner.mwProperty)) this.draw();
  }

  /** Edit set-up: the window opens under the button with the block's set-up; Save rewrites only the lines that changed. */
  private async editSetup(btn: HTMLElement): Promise<void> {
    const app = this.owner.app;
    const info = this.ctx.getSectionInfo(this.containerEl);
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice("Couldn't find this solution block. Edit it in source mode instead."); return; }
    const r = blockRange(await app.vault.cachedRead(file), info.lineStart);
    const sol = r ? parseSolution(r.source) : null;
    if (!sol || sol.newer) return;
    const values = valuesFromSetup(sol.setup);
    const box = btn.getBoundingClientRect();
    const got = await this.owner.setup(app, { values, choices: this.owner.choices(), anchor: Platform.isDesktop ? { left: box.left, bottom: box.bottom } : null, submit: "Save", hint: SETUP_HINT.edit });
    if (!got) return;
    const changes = setupChanges(values, got.values);
    if (!changes.length) return;
    holdScroll(this.containerEl);
    const out = await processNote(app, file, data => {
      let note: string | null = data;
      for (const [key, value] of changes) { note = note === null ? null : writeSetup(note, info.lineStart, key, value); }
      return note;
    });
    if (out === null) { new Notice("Couldn't change this solution block. Edit it in source mode instead."); return; }
    const after = blockRange(out, info.lineStart);
    if (after) this.source = after.source;
    this.shown = null;
    this.paint();
  }

  /** Opens the input in Actual cell `idx`: Enter saves and moves to the next empty one, Tab / Shift+Tab move, Esc cancels. */
  private edit(idx: number): void {
    const cell = this.cells[idx], current = cellsOf(this.view!)[idx];
    if (!cell || !current || this.editing !== null) return;
    this.editing = idx;
    cell.empty();
    cell.addClass("is-editing");
    const input = cell.createEl("input", { type: "text", cls: "lk-sol-input", attr: { placeholder: current.field.unit, "aria-label": "Actual" } });
    input.value = current.value;
    input.focus();
    input.select();
    let closed = false;
    const finish = (save: boolean, how: "enter" | "tab" | "back" | null): void => {
      if (closed) return;
      const text = save ? actualText(input.value, current.field.unit) : current.value;
      if (save && text === null) {   // not a mass: stay open (Enter / Tab) or give up (the focus left)
        if (how === null) { closed = true; this.stopEditing(); return; }
        input.addClass("is-bad");
        if (!cell.querySelector(".lk-sol-err")) cell.createDiv({ cls: "lk-sol-err", text: NOT_A_MASS });
        return;
      }
      closed = true;
      const next = how && this.view ? nextCell(cellsOf(this.view), idx, how) : null;
      this.owner.pending = next === null ? null : this.pendingFor(next);
      this.editing = null;
      void (async () => {
        if (save && text !== null && text !== current.value) await this.save(current.field, text);
        else this.stopEditing();
      })();
    };
    input.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); finish(true, "enter"); }
      else if (e.key === "Tab") { e.preventDefault(); finish(true, e.shiftKey ? "back" : "tab"); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false, null); }
    });
    input.addEventListener("input", () => { input.removeClass("is-bad"); cell.querySelector(".lk-sol-err")?.remove(); });
    input.addEventListener("click", e => e.stopPropagation());
    // A click elsewhere saves; a click that only moves the focus for a moment (a suggestion, the window) does not
    input.addEventListener("blur", () => window.setTimeout(() => {
      if (closed) return;
      if (!input.isConnected) { closed = true; this.editing = null; return; }   // Obsidian drew the block again: the new view takes over (pending), nothing to save here
      if (input.ownerDocument.activeElement !== input) finish(true, null);
    }, 150));
  }

  private pendingFor(idx: number): { path: string; line: number; idx: number; until: number } | null {
    const line = this.line;
    return line === null ? null : { path: this.sourcePath, line, idx, until: Date.now() + 2500 };
  }

  /** The editor is gone without a write: draw the block as it is (and what changed meanwhile). */
  private stopEditing(): void {
    this.editing = null;
    this.stale = false;
    this.shown = null;
    this.paint();
  }

  /** Writes one actual into its own line of the note, keeps the page where it was, and draws the block again. */
  private async save(f: ActualField, text: string): Promise<void> {
    const app = this.owner.app;
    const info = this.ctx.getSectionInfo(this.containerEl);
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice("Couldn't find this solution block. Edit it in source mode instead."); this.stopEditing(); return; }
    holdScroll(this.containerEl);
    const out = await processNote(app, file, data => writeActual(data, info.lineStart, f.step, f.key, text));
    if (out === null) { new Notice("Couldn't change this solution block. Edit it in source mode instead."); this.stopEditing(); return; }
    const r = blockRange(out, info.lineStart);
    if (r) this.source = r.source;
    this.stopEditing();
  }
}

/** What a click on the block does; without it (the closed-experiment PDF, tests) the block is only drawn. */
export interface DrawHandlers { edit: (cell: number) => void; ask: () => void; editSetup: (button: HTMLElement) => void }

/** The picture's `Edit set-up` button, at the right of the title row. */
function editButton(head: HTMLElement, on: DrawHandlers): void {
  const btn = head.createEl("button", { cls: "lk-sol-edit", text: TEXT.editSetup, attr: { type: "button" } });
  btn.addEventListener("click", () => on.editSetup(btn));
}

/** The DOM of one block: `div` rows with ARIA roles, `.lk-sol-*` classes (styles.css). Returns the Actual cells in order. */
export function drawView(host: HTMLElement, view: View, on?: DrawHandlers): HTMLElement[] {
  const cells: HTMLElement[] = [];
  const box = host.createDiv({ cls: "lk-sol" });
  if (view.newer) { box.createDiv({ cls: "lk-sol-note", text: view.newer }); return cells; }
  if (view.errors.length) {
    const list = box.createDiv({ cls: "lk-sol-errors" });
    if (on) editButton(box.createDiv({ cls: "lk-sol-head" }), on);
    for (const e of view.errors) {
      if (on && view.askLines.includes(e)) list.createEl("button", { cls: "lk-sol-error is-ask", text: e }).addEventListener("click", on.ask);
      else list.createDiv({ cls: "lk-sol-error", text: e });
    }
    return cells;
  }
  const head = box.createDiv({ cls: "lk-sol-head" });
  head.createSpan({ cls: "lk-sol-title", text: view.title });
  head.createSpan({ cls: view.status === "done" ? "lk-sol-chip is-done" : "lk-sol-chip", text: view.status });
  if (on) editButton(head, on);
  box.createDiv({ cls: "lk-sol-summary", text: view.summary });
  if (view.warning) box.createDiv({ cls: "lk-sol-caution lk-sol-warn", text: view.warning });
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
      const cell = row.createDiv({ cls: `lk-sol-cell is-num is-actual${r.actual ? "" : " is-empty"}${on ? " is-editable" : ""}`, text: r.actual, attr: { role: "cell" } });
      if (on) {
        const idx = cells.length;
        cell.tabIndex = 0;
        cell.addEventListener("click", () => on.edit(idx));
        cell.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); on.edit(idx); } });
      }
      cells.push(cell);
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
  return cells;
}
