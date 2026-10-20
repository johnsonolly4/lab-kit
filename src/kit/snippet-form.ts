// The Alt+S question window in the entry-window look: a label over a box for each field, pills for toggles and short choices.
// Same field contract and answers as the Templater script labForm.js (which stays for old copies); the pure helpers are ported with their tests.
import { AbstractInputSuggest, Modal, type App } from "obsidian";
import { text } from "../calc/engine";
import { cursorAnchor, type EntryAnchor } from "../planning/entry-window";

export interface FormOption { value: string; label?: string }
export interface SuggestEntry { name: string; aliases?: string[] }
/** One question. `type` defaults to "text"; a select has `options` and starts on `value` (else the first option). */
export interface FormField {
  key: string;
  label: string;
  type?: string;
  value?: unknown;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  options?: FormOption[];
  suggest?: SuggestEntry[];
}
export interface FormOpts { intro?: string; submitText?: string }
export type FormFn = (title: string, fields: FormField[], opts?: FormOpts) => Promise<Record<string, unknown> | null>;

/** Entries whose name or an alias contains the query, best first: name starts with it, alias starts with it, name contains it, alias contains it. */
export function matchNames(entries: SuggestEntry[], query: string, limit = 50): { name: string; alias: string | null }[] {
  const q = String(query).trim().toLowerCase();
  if (!q) return entries.slice(0, limit).map(e => ({ name: e.name, alias: null }));
  const found: { name: string; alias: string | null; rank: number }[] = [];
  for (const e of entries) {
    let best: { rank: number; alias: string | null } | null = null;
    for (const l of [{ text: e.name, alias: null as string | null }, ...(e.aliases ?? []).map(a => ({ text: a, alias: a }))]) {
      const at = l.text.toLowerCase().indexOf(q);
      if (at < 0) continue;
      const rank = (at === 0 ? 0 : 2) + (l.alias === null ? 0 : 1);
      if (!best || rank < best.rank) best = { rank, alias: l.alias };
    }
    if (best) found.push({ name: e.name, alias: best.alias, rank: best.rank });
  }
  return found.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ name, alias }) => ({ name, alias }));
}

/** The item being typed: what follows the last comma or line break before the cursor (leading spaces kept out of the query). */
export function currentItem(value: string, cursor: number): { start: number; query: string } {
  const before = value.slice(0, cursor);
  const start = Math.max(before.lastIndexOf(","), before.lastIndexOf("\n")) + 1;
  const lead = before.slice(start).match(/^\s*/)![0].length;
  return { start: start + lead, query: before.slice(start + lead) };
}

/** Value with the item being typed replaced by name. Returns the new text and cursor. */
export function replaceItem(value: string, cursor: number, name: string): { value: string; cursor: number } {
  const { start } = currentItem(value, cursor);
  return { value: value.slice(0, start) + name + value.slice(cursor), cursor: start + name.length };
}

/** Keys of the mandatory fields (`required: true`) that hold no text. Toggles, selects and headings always have an answer. */
export function missingRequired(fields: FormField[], values: Record<string, unknown>): string[] {
  return fields
    .filter(f => f.required && f.type !== "toggle" && f.type !== "select" && f.type !== "heading")
    .filter(f => text(values[f.key]).trim() === "")
    .map(f => f.key);
}

/** The answers a form starts with (and returns untouched on Insert): text as a string, a toggle as a boolean, a select on its value or first option. */
export function startValues(fields: FormField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "heading") continue;
    if (f.type === "toggle") out[f.key] = !!f.value;
    else if (f.type === "select") out[f.key] = text(f.value ?? f.options?.[0]?.value);
    else out[f.key] = text(f.value);
  }
  return out;
}

/** A select with this many options or fewer is drawn as pills, more as a dropdown. */
export const PILL_MAX = 3;

class Suggest extends AbstractInputSuggest<{ name: string; alias: string | null }> {
  shown = false;
  constructor(app: App, private input: HTMLInputElement, private entries: SuggestEntry[], private store: (v: string) => void) { super(app, input); }
  getSuggestions(value: string) {
    const found = matchNames(this.entries, currentItem(value, this.input.selectionStart ?? value.length).query);
    this.shown = found.length > 0;
    return found;
  }
  renderSuggestion(s: { name: string; alias: string | null }, el: HTMLElement): void {
    el.setText(s.name);
    if (s.alias) el.createSpan({ cls: "lab-kit-suggest-alias", text: s.alias });
  }
  selectSuggestion(s: { name: string; alias: string | null }): void {
    const done = replaceItem(this.input.value, this.input.selectionStart ?? this.input.value.length, s.name);
    this.input.value = done.value;
    this.input.setSelectionRange(done.cursor, done.cursor);
    this.store(done.value);
    this.input.focus();
    this.close();
  }
  close(): void { this.shown = false; super.close(); }
}

class FormWindow extends Modal {
  private values: Record<string, unknown>;
  private rows: Record<string, { el: HTMLElement; hint: HTMLElement; input: HTMLInputElement | HTMLTextAreaElement }> = {};
  private popups: Suggest[] = [];
  private done = false;

  constructor(app: App, private title: string, private fields: FormField[], private opts: FormOpts, private anchor: EntryAnchor | null, private settle: (v: Record<string, unknown> | null) => void) {
    super(app);
    this.values = startValues(fields);
  }

  onOpen(): void {
    this.modalEl.addClass("vt-entry", "lk-form");   // styles.css
    if (this.anchor) {
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
    }
    this.contentEl.createEl("h3", { text: this.title, cls: "vt-entry-heading" });
    if (this.opts.intro) this.contentEl.createDiv({ cls: "vt-entry-hint lk-form-intro", text: this.opts.intro });
    const body = this.contentEl.createDiv({ cls: "lk-form-body" });
    const first: (HTMLInputElement | HTMLTextAreaElement)[] = [];
    for (const f of this.fields) {
      if (f.type === "heading") { body.createDiv({ cls: "lk-snip-heading", text: f.label }); continue; }
      const row = body.createDiv({ cls: "lk-form-row" });
      row.createDiv({ cls: "lk-form-label", text: f.required ? `${f.label} *` : f.label });
      if (f.type === "toggle") this.toggle(row, f);
      else if (f.type === "select") this.select(row, f);
      else { const input = this.text(row, f); first.push(input); }
      const hint = row.createDiv({ cls: "vt-entry-hint lk-form-hint", text: f.hint ?? "" });
      if (!f.hint) hint.addClass("vt-hidden");
      const input = this.rows[f.key]?.input;
      if (input) this.rows[f.key] = { el: row, hint, input };
    }
    const bar = this.contentEl.createDiv({ cls: "lk-form-bar" });
    bar.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    bar.createEl("button", { text: this.opts.submitText ?? "Insert", cls: "mod-cta" }).addEventListener("click", () => this.submit());
    this.contentEl.createDiv({ cls: "vt-entry-hint", text: "Enter inserts · Esc cancels" });
    this.contentEl.addEventListener("keydown", e => {
      if (e.key !== "Enter" || e.isComposing) return;
      if (this.popups.some(p => p.shown)) return;   // a suggestion is showing: Enter picks it
      const inTextarea = (e.target as HTMLElement).tagName === "TEXTAREA";
      const inButton = (e.target as HTMLElement).tagName === "BUTTON";
      if (inButton) return;
      if (!inTextarea || e.ctrlKey || e.metaKey) { e.preventDefault(); this.submit(); }
    });
    this.place();
    window.setTimeout(() => { first[0]?.focus(); (first[0] as HTMLInputElement | undefined)?.select?.(); }, 30);
  }

  private place(): void {
    if (!this.anchor) return;
    const w = Math.min(560, window.innerWidth * 0.92), h = this.modalEl.offsetHeight;
    this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.max(8, Math.min(this.anchor.bottom + 8, window.innerHeight - h - 8))}px` });
  }

  private text(row: HTMLElement, f: FormField): HTMLInputElement | HTMLTextAreaElement {
    const store = (v: string) => { this.values[f.key] = v; };
    let input: HTMLInputElement | HTMLTextAreaElement;
    if (f.type === "textarea") {
      input = row.createEl("textarea", { cls: "lk-form-box", attr: { rows: String(f.rows ?? 4), placeholder: f.placeholder ?? "" } });
    } else {
      input = row.createEl("input", { cls: "lk-form-box", attr: { type: f.type === "number" ? "number" : "text", placeholder: f.placeholder ?? "" } });
    }
    input.value = text(this.values[f.key]);
    input.addEventListener("input", () => store(input.value));
    if (f.suggest?.length && input instanceof HTMLInputElement) this.popups.push(new Suggest(this.app, input, f.suggest, store));
    this.rows[f.key] = { el: row, hint: row, input };
    return input;
  }

  private toggle(row: HTMLElement, f: FormField): void {
    const pills = row.createDiv({ cls: "lk-form-pills" });
    const pill = pills.createEl("button", { cls: "lk-form-pill", attr: { type: "button" } });
    const draw = () => { const on = !!this.values[f.key]; pill.setText(on ? "Yes" : "No"); pill.toggleClass("is-on", on); pill.setAttr("aria-pressed", String(on)); };
    pill.addEventListener("click", () => { this.values[f.key] = !this.values[f.key]; draw(); });
    draw();
  }

  private select(row: HTMLElement, f: FormField): void {
    const opts = f.options ?? [];
    const set = (v: string) => { this.values[f.key] = v; };
    if (opts.length > PILL_MAX) {
      const sel = row.createEl("select", { cls: "dropdown lk-form-box" });
      for (const o of opts) sel.createEl("option", { value: String(o.value), text: String(o.label ?? o.value) });
      sel.value = String(this.values[f.key]);
      sel.addEventListener("change", () => set(sel.value));
      return;
    }
    const pills = row.createDiv({ cls: "lk-form-pills" });
    const all: [HTMLElement, string][] = opts.map(o => [pills.createEl("button", { cls: "lk-form-pill", text: String(o.label ?? o.value), attr: { type: "button" } }), String(o.value)]);
    const draw = () => all.forEach(([el, v]) => el.toggleClass("is-on", v === this.values[f.key]));
    for (const [el, v] of all) el.addEventListener("click", () => { set(v); draw(); });
    draw();
  }

  private submit(): void {
    const missing = missingRequired(this.fields, this.values);
    for (const f of this.fields) {
      const r = this.rows[f.key];
      if (!r || !f.required) continue;
      const bad = missing.includes(f.key);
      r.hint.setText(bad ? "Needs an answer" : (f.hint ?? ""));
      r.hint.toggleClass("vt-hidden", !bad && !f.hint);
      r.hint.toggleClass("is-bad", bad);
      r.input.toggleClass("is-bad", bad);
    }
    if (missing.length) { this.rows[missing[0]]?.input.focus(); return; }
    this.done = true;
    this.settle({ ...this.values });
    this.close();
  }

  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node) && !document.querySelector(".suggestion-container")?.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    this.contentEl.empty();
    if (!this.done) this.settle(null);
  }
}

/** Opens the question window; the answers (same keys and types as labForm.js), or null on Cancel / Esc. */
export const openSnippetForm = (app: App, atCursor: () => boolean = () => true): FormFn => (title, fields, opts = {}) =>
  new Promise(resolve => new FormWindow(app, title, fields, opts, atCursor() ? cursorAnchor(app) : null, resolve).open());
