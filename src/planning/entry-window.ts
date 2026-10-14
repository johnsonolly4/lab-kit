// The entry window: a title box with a row of chips under it, so a new note is made with everything set at once. Enter creates, Esc cancels.
// The fields and what they show are in entry-fields.ts (pure); the to-do's are in todo-bar.ts. The in-note chip bar uses `editEntryField` too.
import { Modal, setIcon, type App } from "obsidian";
import { ask, pick } from "./ask";
import { chipView, entryResult, setEntryValue, visibleFields, type EntryField, type EntryValue, type EntryValues } from "./entry-fields";
import { readDueText } from "./todo-bar";

export interface EntryAnswer { title: string; values: EntryValues }

/** Asks for the value of one field; null when Esc was pressed (nothing changes). A toggle just flips. */
export async function editEntryField(app: App, field: EntryField, current: EntryValue | undefined, side = true): Promise<EntryValue | null> {
  if (field.kind === "toggle") return current !== true;
  if (field.kind === "pick") {
    const options = field.options ?? [];
    return pick<EntryValue>(app, options.map(o => o.label), options.map(o => o.value), field.prompt, side);
  }
  let prompt = field.prompt;
  for (;;) {
    const text = await ask(app, prompt, typeof current === "string" ? current : "");
    if (text === null) return null;
    const read = readDueText(text, new Date());
    if (read) return read.date ?? "";
    prompt = `"${text}" is not a date. Try fri, 15 nov, 15/11, in 3 days or YYYY-MM-DD (empty clears)`;
  }
}

class EntryModal extends Modal {
  private settled = false;
  private values: EntryValues;
  private input!: HTMLInputElement;
  private chips!: HTMLElement;
  private busy = false;   // a list or the date box is open: a click on another chip waits (no stack of boxes)

  constructor(app: App, private heading: string, private fields: EntryField[], private title: string, values: EntryValues, private done: (a: EntryAnswer | null) => void) {
    super(app);
    this.values = { ...values };
  }

  onOpen(): void {
    this.modalEl.addClass("vt-entry");   // styles.css
    this.contentEl.createEl("h3", { text: this.heading, cls: "vt-entry-heading" });
    this.input = this.contentEl.createEl("input", { type: "text", cls: "vt-entry-title", attr: { placeholder: "Title" } });
    this.input.value = this.title;
    this.chips = this.contentEl.createDiv({ cls: "vt-todo-bar vt-entry-chips" });
    this.contentEl.createDiv({ cls: "vt-entry-hint", text: "Enter creates with what is set. Esc cancels." });
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); this.finish({ title: this.input.value.trim(), values: entryResult(this.fields, this.values) }); this.close(); }
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
      btn.addEventListener("click", () => { void this.edit(f); });
    }
  }

  private async edit(f: EntryField): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const got = await editEntryField(this.app, f, this.values[f.key], false);
      if (got !== null) { this.values = setEntryValue(this.fields, this.values, f.key, got); this.drawChips(); }
    } finally { this.busy = false; }
    this.input.focus();
  }

  private finish(a: EntryAnswer | null): void { if (!this.settled) { this.settled = true; this.done(a); } }
  onClose(): void { this.contentEl.empty(); window.setTimeout(() => this.finish(null), 0); }
}

/** Opens the entry window; the title and the values set (only visible, non-empty ones), or null when Esc was pressed. `initial` fills it in (quick capture). */
export const openEntry = (app: App, heading: string, fields: EntryField[], initial: { title?: string; values?: EntryValues } = {}): Promise<EntryAnswer | null> =>
  new Promise(resolve => new EntryModal(app, heading, fields, initial.title ?? "", initial.values ?? {}, resolve).open());
