// The entry window: a title box with a row of chips under it, so a new note is made with everything set at once. Enter creates, Esc cancels.
// The fields and what they show are in entry-fields.ts (pure); the to-do's are in todo-bar.ts. The in-note chip bar uses `editEntryField` too.
import { Modal, Platform, setIcon, type App } from "obsidian";
import { openFieldPopover } from "./entry-popover";
import { chipView, entryResult, missingRequired, setEntryValue, visibleFields, type EntryField, type EntryValue, type EntryValues } from "./entry-fields";

export interface EntryAnswer { title: string; values: EntryValues }
/** Where to open the window: just under this point (screen pixels). */
export interface EntryAnchor { left: number; bottom: number; /** The highlighted text as a DOM range, to underline while the window is open. */ range?: Range }

/** The screen position just under the end of the selection in the open note (desktop only), else null: the window opens in the middle. Uses the editor's CodeMirror view, which Obsidian does not document, so it is read defensively here and nowhere else. */
export function selectionAnchor(app: App): EntryAnchor | null {
  if (!Platform.isDesktop) return null;
  const editor = app.workspace.activeEditor?.editor;
  if (!editor?.somethingSelected()) return null;
  try {
    const cm = (editor as unknown as { cm?: { coordsAtPos(pos: number): { left: number; bottom: number } | null } }).cm;
    const end = cm?.coordsAtPos(editor.posToOffset(editor.getCursor("to"))), start = cm?.coordsAtPos(editor.posToOffset(editor.getCursor("from")));
    const sel = window.getSelection();
    return end ? { left: start?.left ?? end.left, bottom: end.bottom, ...(sel && sel.rangeCount && !sel.isCollapsed ? { range: sel.getRangeAt(0).cloneRange() } : {}) } : null;
  } catch { return null; }
}

/** Asks for the value of one field in a dropdown under `anchor` (the chip); null when it was closed without a choice. A toggle just flips. */
export async function editEntryField(app: App, field: EntryField, current: EntryValue | undefined, anchor: HTMLElement): Promise<EntryValue | null> {
  if (field.kind === "toggle") return current !== true;
  return openFieldPopover(app, anchor, field, current);
}

class EntryModal extends Modal {
  private settled = false;
  private values: EntryValues;
  private input!: HTMLInputElement;
  private chips!: HTMLElement;
  private hint!: HTMLElement;
  private busy = false;   // a list or the date box is open: a click on another chip waits (no stack of boxes)

  constructor(app: App, private heading: string, private fields: EntryField[], private title: string, values: EntryValues, private anchor: EntryAnchor | null, private requireTitle: boolean, private validate: ((a: EntryAnswer) => string | null) | null, private done: (a: EntryAnswer | null) => void) {
    super(app);
    this.values = { ...values };
  }

  onOpen(): void {
    this.modalEl.addClass("vt-entry");   // styles.css
    if (this.anchor) {   // under the highlighted line, kept inside the window
      this.containerEl.addClass("vt-entry-anchored");   // no dimmed background; a click outside closes it
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
      this.underline(true);
      const w = Math.min(560, window.innerWidth * 0.92);
      this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.min(this.anchor.bottom + 8, Math.max(8, window.innerHeight - 260))}px` });
    }
    this.contentEl.createEl("h3", { text: this.heading, cls: "vt-entry-heading" });
    this.input = this.contentEl.createEl("input", { type: "text", cls: "vt-entry-title", attr: { placeholder: "Title" } });
    this.input.value = this.title;
    this.chips = this.contentEl.createDiv({ cls: "vt-todo-bar vt-entry-chips" });
    this.hint = this.contentEl.createDiv({ cls: "vt-entry-hint", text: "Enter creates with what is set. Esc cancels." });
    this.input.addEventListener("keydown", e => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      const missing = missingRequired(this.fields, this.values);
      if (this.requireTitle && !this.input.value.trim()) { this.hint.setText("Type a title first."); this.hint.addClass("is-bad"); return; }
      if (missing) { this.hint.setText(`Pick a ${missing.name.toLowerCase()} first.`); this.hint.addClass("is-bad"); return; }
      const answer = { title: this.input.value.trim(), values: entryResult(this.fields, this.values) };
      const problem = this.validate?.(answer);
      if (problem) { this.hint.setText(problem); this.hint.addClass("is-bad"); return; }
      this.finish(answer);
      this.close();
    });
    this.drawChips();
    this.input.focus();
    this.input.select();
  }

  private drawChips(): void {
    this.chips.empty();
    for (const f of visibleFields(this.fields, this.values)) {
      const view = chipView(f, this.values[f.key]);
      const btn = this.chips.createEl("button", { cls: `vt-todo-chip ${view.set ? "is-set" : "is-empty"}`, attr: { "aria-label": f.name } });
      if (view.set || f.kind === "toggle") setIcon(btn.createSpan({ cls: "vt-todo-chip-icon" }), f.icon);
      btn.createSpan({ text: view.text });
      btn.addEventListener("click", () => { void this.edit(f, btn); });
    }
  }

  private async edit(f: EntryField, anchor: HTMLElement): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const got = await editEntryField(this.app, f, this.values[f.key], anchor);
      if (got !== null) { this.values = setEntryValue(this.fields, this.values, f.key, got); this.drawChips(); }
    } finally { this.busy = false; }
    this.input.focus();
  }

  private finish(a: EntryAnswer | null): void { if (!this.settled) { this.settled = true; this.done(a); } }
  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".vt-pop")) this.close(); };

  /** Underlines the highlighted text while the window is open (the CSS Custom Highlight API: nothing is written to the note). Skipped where the browser has none. */
  private underline(on: boolean): void {
    const css = (window as unknown as { CSS?: { highlights?: { set(n: string, h: unknown): void; delete(n: string): void } } }).CSS;
    const Hl = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!css?.highlights || !Hl) return;
    if (on && this.anchor?.range) css.highlights.set("vt-quick-todo", new Hl(this.anchor.range)); else css.highlights.delete("vt-quick-todo");
  }

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    this.underline(false);
    this.contentEl.empty();
    window.setTimeout(() => this.finish(null), 0);
  }
}

/** The button the user just clicked (a plugin button, a Meta Bind button), as a place to open the window under; null when the focus is in a note or nowhere (a hotkey, the command palette). Rule: a window with something on screen to point at opens next to it with no dimmed background; one with nothing to point at is centred and dims. */
export function buttonAnchor(): EntryAnchor | null {
  if (!Platform.isDesktop) return null;
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || (el.tagName !== "BUTTON" && el.getAttribute("role") !== "button") || !el.closest(".workspace-leaf-content")) return null;   // a real button, or a box that acts as one (the empty-project box on the map)
  const r = el.getBoundingClientRect();
  return r.width ? { left: r.left, bottom: r.bottom } : null;
}

/** Opens the entry window; the title and the values set (only visible, non-empty ones), or null when Esc was pressed. `initial` fills it in (quick capture). */
export const openEntry = (app: App, heading: string, fields: EntryField[], initial: { title?: string; values?: EntryValues; anchor?: EntryAnchor | null; requireTitle?: boolean; validate?: (a: EntryAnswer) => string | null } = {}): Promise<EntryAnswer | null> =>
  new Promise(resolve => new EntryModal(app, heading, fields, initial.title ?? "", initial.values ?? {}, initial.anchor ?? buttonAnchor(), initial.requireTitle ?? false, initial.validate ?? null, resolve).open());
