// Renders ```raft blocks: the set-up and the typed `used:` masses of the block, worked out by ./view.ts and drawn with the same div rows and classes as the
// Solution prep block (.lk-sol-*, no <table>, so a vault's table styling cannot reach it), plus the collapsed "How it's worked out" fold.
// Typing an actual writes its own `used:` line only; Edit set-up rewrites the changed set-up lines and the `#` worked-out lines (Q36 a).
// Plan: docs/plans/templater-replacement-and-live-snippets.md, Phase 9. The Actual input is the solution block's, adapted (BACKLOG: move it into ../core.ts).
import { MarkdownRenderChild, Notice, Platform, TFile, type App, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { ChemSettings } from "../../calc/render";
import type { FormFn } from "../../kit/snippet-form";
import { askReagent } from "../../solution/ask-reagent";
import { readReagent } from "../../solution/reagent";
import { reagentChoices } from "../../solution/setup";
import { NOT_A_MASS, actualText, blockRange, holdScroll, nextCell, parseBlock, processNote } from "../core";
import { openRaftSetup, type RaftSetupFn } from "./setup";
import { applyOps, inBlock, raftChanges, raftLines, replaceWorkedOut, valuesFromBlock, workedFor, writeUsed } from "./text";
import { buildRaftView, cellsOf, TEXT, type MwLookup, type RaftView, type UsedField } from "./view";

/** The hint under the Edit set-up window (the Solution prep window's). */
const HINT_EDIT = "Enter saves · Esc closes";

/** The chemical note for a name and its MW, as the maths reads it. */
export function lookupMw(app: App, mwProperty: string | undefined, name: string, sourcePath: string): MwLookup & { path: string | null } {
  const f = app.metadataCache.getFirstLinkpathDest(name, sourcePath);
  if (!f) return { name, mw: null, state: "no-note", path: null };
  const fm: Record<string, unknown> | undefined = app.metadataCache.getFileCache(f)?.frontmatter;
  const read = readReagent(fm, mwProperty);
  const mw = read.reagent.mw;
  return { name, mw: mw ?? null, state: mw !== undefined ? "ok" : read.invalid.includes("mw") ? "bad-mw" : "no-mw", path: f.path };
}

export class RaftRenderer {
  /** The open blocks, so an edit to their note or to a reagent's note redraws them. */
  private views = new Set<RaftBlockView>();
  /** Blocks whose fold the user opened (`path:line`), kept while the view is open so typing an actual does not close it. */
  readonly open = new Set<string>();

  /** The Actual cell to open once the block is drawn again (Enter / Tab moved on). */
  pending: { path: string; line: number; idx: number; until: number } | null = null;

  constructor(private plugin: Plugin, private settings: () => ChemSettings = () => ({}), readonly form: FormFn | null = null, readonly setup: RaftSetupFn = openRaftSetup) {}

  get app(): App { return this.plugin.app; }
  get mwProperty(): string { return this.settings().mwProperty ?? ""; }

  /** The chemical notes the set-up window suggests. */
  names(): string[] { return reagentChoices(this.app, this.settings().chemicalFolder ?? "", this.settings().mwProperty).map(c => c.name); }

  lookup(name: string, sourcePath: string): MwLookup & { path: string | null } { return lookupMw(this.app, this.settings().mwProperty, name, sourcePath); }

  /** Registers the ```raft processor and the redraw-on-edit listeners. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("raft", (source, el, ctx) => { ctx.addChild(new RaftBlockView(el, this, source, ctx)); });

    const timers = new Map<string, number>();
    const later = (path: string, hit: (v: RaftBlockView) => boolean) => {
      if (![...this.views].some(hit)) return;
      window.clearTimeout(timers.get(path));
      timers.set(path, window.setTimeout(() => { for (const v of this.views) if (hit(v)) v.draw(); }, 250));
    };
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => later(file.path, v => v.sourcePath === file.path)));
    this.plugin.registerEvent(this.app.metadataCache.on("changed", (file) => later(file.path, v => v.reagentPaths.has(file.path) && v.sourcePath !== file.path)));
  }

  add(v: RaftBlockView): void { this.views.add(v); }
  remove(v: RaftBlockView): void { this.views.delete(v); }
}

class RaftBlockView extends MarkdownRenderChild {
  reagentPaths = new Set<string>();
  private shown: string | null = null;
  private drawing = 0;
  private view: RaftView | null = null;
  private cells: HTMLElement[] = [];
  /** The Actual cell being typed in; while it is open a redraw waits. */
  private editing: number | null = null;
  private stale = false;

  constructor(el: HTMLElement, private owner: RaftRenderer, private source: string, private ctx: MarkdownPostProcessorContext) { super(el); }

  get sourcePath(): string { return this.ctx.sourcePath; }
  get line(): number | null { return this.ctx.getSectionInfo(this.containerEl)?.lineStart ?? null; }
  private get foldKey(): string { return `${this.sourcePath}:${this.line ?? 0}`; }

  onload(): void { this.owner.add(this); this.paint(); }
  onunload(): void { this.owner.remove(this); }

  /** Re-reads the block text from the note (it may have been edited), then draws. */
  draw(): void {
    const run = ++this.drawing;
    void this.reread().then(() => { if (run === this.drawing) this.paint(); }).catch(e => { console.error("Lab Kit raft block", e); });
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
    const paths = new Set<string>();
    const view = buildRaftView(this.source, n => { const f = this.owner.lookup(n, this.sourcePath); if (f.path) paths.add(f.path); return f; });
    this.reagentPaths = paths;
    const open = this.owner.open.has(this.foldKey);
    const sig = JSON.stringify(view) + (open ? "+" : "");
    if (sig === this.shown) return;
    this.shown = sig;
    this.containerEl.empty();
    this.view = view;
    this.cells = drawRaft(this.containerEl, view, {
      edit: i => { this.owner.pending = null; this.edit(i); },
      ask: name => { void this.ask(name); },
      editSetup: btn => { void this.editSetup(btn); },
      fold: { open, toggle: o => { if (o) this.owner.open.add(this.foldKey); else this.owner.open.delete(this.foldKey); this.shown = JSON.stringify(this.view) + (o ? "+" : ""); } },
    });
    this.openPending();
  }

  private openPending(): void {
    const p = this.owner.pending;
    if (!p || Date.now() > p.until || p.path !== this.sourcePath || p.line !== this.line || !this.cells[p.idx] || this.editing !== null) return;
    // A copy that is not on screen (Reading view and Live Preview both keep one) must not take the editor; look again shortly
    if (!this.containerEl.isConnected || this.containerEl.offsetParent === null) { window.setTimeout(() => this.openPending(), 100); return; }
    this.edit(p.idx);
  }

  /** A reagent without a MW: ask for it and save it in the chemical note (the block redraws when the note changes). */
  private async ask(name: string): Promise<void> {
    const form = this.owner.form, path = this.owner.lookup(name, this.sourcePath).path;
    const file = path ? this.owner.app.vault.getAbstractFileByPath(path) : null;
    if (!form || !(file instanceof TFile)) return;
    if (await askReagent(this.owner.app, form, file, ["mw"], this.owner.mwProperty)) this.draw();
  }

  /** Edit set-up: the window opens under the button with the block's set-up; Save rewrites only the lines that changed, then the worked-out lines. */
  private async editSetup(btn: HTMLElement): Promise<void> {
    const app = this.owner.app;
    const info = this.ctx.getSectionInfo(this.containerEl);
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice(TEXT.noBlock); return; }
    const r = blockRange(await app.vault.cachedRead(file), info.lineStart);
    const block = r ? parseBlock(r.source) : null;
    if (!block || block.newer) return;
    const values = valuesFromBlock(block);
    const box = btn.getBoundingClientRect();
    const got = await this.owner.setup(app, { values, names: this.owner.names(), anchor: Platform.isDesktop ? { left: box.left, bottom: box.bottom } : null, submit: "Save", hint: HINT_EDIT });
    if (!got) return;
    const ops = raftChanges(values, got.values);
    if (!ops.length) return;
    holdScroll(this.containerEl);
    const mwOf = (n: string): number | null => this.owner.lookup(n, this.sourcePath).mw;
    const out = await processNote(app, file, data => inBlock(data, info.lineStart, src => {
      let next = applyOps(src, ops);
      const l = raftLines(valuesFromBlock(parseBlock(next)));
      const worked = "lines" in l ? workedFor(l.lines, mwOf) : [];
      if (worked.length) next = replaceWorkedOut(next, worked);
      return next;
    }));
    if (out === null) { new Notice(TEXT.noChange); return; }
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

  /** Writes one actual into its own `used:` line of the note, keeps the page where it was, and draws the block again. */
  private async save(f: UsedField, text: string): Promise<void> {
    const app = this.owner.app;
    const info = this.ctx.getSectionInfo(this.containerEl);
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    if (!info || !(file instanceof TFile)) { new Notice(TEXT.noBlock); this.stopEditing(); return; }
    holdScroll(this.containerEl);
    const out = await processNote(app, file, data => writeUsed(data, info.lineStart, f.key, text));
    if (out === null) { new Notice(TEXT.noChange); this.stopEditing(); return; }
    const r = blockRange(out, info.lineStart);
    if (r) this.source = r.source;
    this.stopEditing();
  }
}

/** What a click on the block does; without it (tests, a print) the block is only drawn. */
export interface RaftHandlers {
  edit: (cell: number) => void;
  ask: (reagent: string) => void;
  editSetup: (button: HTMLElement) => void;
  /** The "How it's worked out" fold: whether it is open and what to do when it is toggled. */
  fold: { open: boolean; toggle: (open: boolean) => void };
}

/** The `Edit set-up` button, at the right of the title row. */
function editButton(head: HTMLElement, on: RaftHandlers): void {
  const btn = head.createEl("button", { cls: "lk-sol-edit", text: TEXT.editSetup, attr: { type: "button" } });
  btn.addEventListener("click", () => on.editSetup(btn));
}

/** The DOM of one block: `div` rows with ARIA roles, `.lk-sol-*` classes (styles.css). Returns the Actual cells in order. */
export function drawRaft(host: HTMLElement, view: RaftView, on?: RaftHandlers): HTMLElement[] {
  const cells: HTMLElement[] = [];
  const box = host.createDiv({ cls: "lk-sol lk-raft" });
  if (view.newer) { box.createDiv({ cls: "lk-sol-note", text: view.newer }); return cells; }
  if (view.errors.length) {
    const list = box.createDiv({ cls: "lk-sol-errors" });
    if (on) editButton(box.createDiv({ cls: "lk-sol-head" }), on);
    for (const e of view.errors) {
      const ask = e.ask;
      if (on && ask) list.createEl("button", { cls: "lk-sol-error is-ask", text: e.text }).addEventListener("click", () => on.ask(ask));
      else list.createDiv({ cls: "lk-sol-error", text: e.text });
    }
    return cells;
  }
  const head = box.createDiv({ cls: "lk-sol-head" });
  head.createSpan({ cls: "lk-sol-title", text: view.title });
  head.createSpan({ cls: view.status === TEXT.done ? "lk-sol-chip is-done" : "lk-sol-chip", text: view.status });
  if (on) editButton(head, on);
  box.createDiv({ cls: "lk-sol-summary", text: view.summary });
  for (const step of view.steps) {
    const sec = box.createDiv({ cls: step.done ? "lk-sol-step is-done" : "lk-sol-step" });
    sec.createDiv({ cls: "lk-sol-step-title", text: step.title });
    const grid = sec.createDiv({ cls: "lk-sol-grid", attr: { role: "table" } });
    const hrow = grid.createDiv({ cls: "lk-sol-row is-head", attr: { role: "row" } });
    hrow.createDiv({ cls: "lk-sol-cell", attr: { role: "columnheader" } });
    hrow.createDiv({ cls: "lk-sol-cell is-num", text: "Target", attr: { role: "columnheader" } });
    hrow.createDiv({ cls: "lk-sol-cell is-num", text: "Actual", attr: { role: "columnheader" } });
    for (const r of step.rows) {
      const row = grid.createDiv({ cls: "lk-sol-row", attr: { role: "row" } });
      const label = row.createDiv({ cls: "lk-sol-cell", text: r.label, attr: { role: "cell" } });
      label.createSpan({ cls: "lk-sol-sub", text: r.sub });
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
    est.createSpan({ cls: "lk-sol-estimate-value", text: view.estimate.mn });
    est.createSpan({ cls: "lk-sol-estimate-range", text: ` ${view.estimate.range}` });
  }
  drawFold(box, view.worked, on?.fold);
  return cells;
}

/** "How it's worked out": closed until the head is clicked (Q33 a), the sums as the note's `#` lines. */
function drawFold(box: HTMLElement, lines: string[], fold?: RaftHandlers["fold"]): void {
  const wrap = box.createDiv({ cls: fold?.open ? "lk-sol-fold is-open" : "lk-sol-fold" });
  const head = wrap.createEl("button", { cls: "lk-sol-fold-head", attr: { type: "button", "aria-expanded": fold?.open ? "true" : "false" } });
  const chev = head.createSpan({ cls: "chev", text: fold?.open ? "▾" : "▸" });
  head.createSpan({ text: TEXT.fold });
  head.createSpan({ cls: "cnt", text: TEXT.foldNote });
  wrap.createDiv({ cls: "lk-sol-fold-body", text: lines.join("\n") });
  head.addEventListener("click", () => {
    const open = !wrap.hasClass("is-open");
    wrap.toggleClass("is-open", open);
    head.setAttr("aria-expanded", String(open));
    chev.setText(open ? "▾" : "▸");
    fold?.toggle(open);
  });
}
