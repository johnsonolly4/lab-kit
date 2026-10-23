// Solution prep, the set-up window (L1): at the cursor in the entry-window look, the chips Method / Acid for pH / + Solute and the six boxes.
// Used by Alt+S → Solution prep (inserts the block) and by the block's Edit set-up (rewrites only the changed lines). Plan: docs/plans/solution-live-block.md, Phase 5.
import { Menu, Modal, TFile, TFolder, type App } from "obsidian";
import { cursorAnchor, type EntryAnchor } from "../planning/entry-window";
import { Suggest } from "../kit/snippet-form";
import { isReagentNote, readReagent, type ReagentRead } from "./reagent";
import { reagentDetail, reagentRow, setupLines, SETUP_LABEL, type SetupField, type SetupLines, type SetupValues } from "./setup-text";

/** A chemical note as the picker needs it. */
export interface ReagentChoice { name: string; /** `Acetic acid · 99.7 % · pKa 4.76` */ row: string; /** `99.7 % · pKa 4.76`, shown under the box (the closed box shows the name only). */ detail: string; base: boolean; /** Has `Acid / base` set: listed in the dropdown. */ reagent: boolean }

/** Every note of the chemical folder (and below) with what the picker shows for it. Empty without a folder. */
export function reagentChoices(app: App, folder: string, mwProperty?: string): ReagentChoice[] {
  const path = folder.trim().replace(/^\/+|\/+$/g, "");
  const root = path ? app.vault.getFolderByPath(path) : null;
  if (!root) return [];
  const out: ReagentChoice[] = [];
  const walk = (f: TFolder): void => {
    for (const c of f.children) {
      if (c instanceof TFolder) walk(c);
      else if (c instanceof TFile && c.extension === "md") {
        const fm: Record<string, unknown> | undefined = app.metadataCache.getFileCache(c)?.frontmatter;
        const read: ReagentRead = readReagent(fm, mwProperty);
        out.push({ name: c.basename, row: reagentRow(c.basename, read), detail: reagentDetail(read), base: read.kind === "base", reagent: isReagentNote(fm) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export interface SetupInit {
  values: SetupValues;
  choices: ReagentChoice[];
  anchor: EntryAnchor | null;
  /** The button on the right (`Insert` for a new block, `Save` for Edit set-up). */
  submit: string;
  /** The line under the boxes. */
  hint: string;
  /** The Method chip offers `by volume` (a new block only; Edit set-up edits a by-mass block). */
  methods?: boolean;
}
/** What the window answers: the boxes as typed and as block lines. */
export interface SetupAnswer { values: SetupValues; lines: SetupLines; /** `volume`: the old solution-by-volume form is wanted instead (lines are then not used). */ method?: "mass" | "volume" }
export type SetupFn = (app: App, init: SetupInit) => Promise<SetupAnswer | null>;

/** New wording (BACKLOG "Questions for the owner"): the picture's line for a new block, and the one for Edit set-up. */
export const SETUP_HINT = { insert: "Enter inserts the block · Esc closes · you can change all of this later in the block", edit: "Enter saves · Esc closes" };

/** The chips of the picture (L1): the method, the kind, and the by-mass solute chip that waits for Phase 6. */
const CHIP = { method: (m: "mass" | "volume") => `Method: by ${m}`, kind: "Acid for pH", solute: "+ Solute" };

class SetupWindow extends Modal {
  private values: SetupValues;
  private inputs = {} as Record<SetupField, HTMLInputElement | HTMLSelectElement>;
  private labels = {} as Record<SetupField, HTMLElement>;
  private message!: HTMLElement;
  private popups: Suggest[] = [];
  private done = false;

  constructor(app: App, private init: SetupInit, private settle: (a: SetupAnswer | null) => void) {
    super(app);
    this.values = { ...init.values };
  }

  onOpen(): void {
    this.modalEl.addClass("vt-entry", "lk-form", "lk-sol-setup");   // styles.css
    const anchor = this.init.anchor;
    if (anchor) {
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
    }
    this.contentEl.createEl("h3", { text: "Solution prep", cls: "vt-entry-heading" });
    const chips = this.contentEl.createDiv({ cls: "vt-todo-bar vt-entry-chips" });
    const method = chips.createEl("button", { cls: "vt-todo-chip is-set", text: CHIP.method("mass"), attr: { type: "button", tabindex: "-1" } });
    if (this.init.methods) method.addEventListener("click", e => {
      const menu = new Menu();
      for (const m of ["mass", "volume"] as const) menu.addItem(i => i.setTitle(`by ${m}`).setChecked(m === "mass").onClick(() => { if (m === "volume") this.chooseVolume(); }));
      menu.showAtMouseEvent(e);
    });
    chips.createEl("button", { cls: "vt-todo-chip is-set", text: CHIP.kind, attr: { type: "button", tabindex: "-1" } });
    chips.createEl("button", { cls: "vt-todo-chip is-empty", text: CHIP.solute, attr: { type: "button", disabled: "" } });   // by-mass solutes come in Phase 6

    const grid = this.contentEl.createDiv({ cls: "lk-sol-setup-grid" });
    const box = (f: SetupField, label: string): HTMLElement => {
      const row = grid.createDiv({ cls: "lk-form-row" });
      this.labels[f] = row.createDiv({ cls: "lk-form-label", text: label });
      return row;
    };
    for (const f of ["aqueous", "pH"] as const) this.text(box(f, SETUP_LABEL[f]), f);
    this.reagent(box("reagent", SETUP_LABEL.reagent));
    this.text(box("share", SETUP_LABEL.share(this.isBase())), "share");
    this.text(box("use", SETUP_LABEL.use), "use");
    this.text(box("balance", SETUP_LABEL.balance), "balance");

    this.message = this.contentEl.createDiv({ cls: "vt-entry-hint", text: this.init.hint });
    const bar = this.contentEl.createDiv({ cls: "lk-form-bar" });
    bar.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    bar.createEl("button", { text: this.init.submit, cls: "mod-cta" }).addEventListener("click", () => this.submit());
    this.contentEl.addEventListener("keydown", e => {
      if (e.key !== "Enter" || e.isComposing || (e.target as HTMLElement).tagName === "BUTTON") return;
      if (this.popups.some(p => p.shown)) return;   // a suggestion is showing: Enter picks it
      e.preventDefault();
      this.submit();
    });
    this.place();
    window.setTimeout(() => { const first = this.inputs.aqueous as HTMLInputElement; first.focus(); first.select(); }, 30);
  }

  /** `by volume`: the window closes and the old volume form asks its own questions. */
  private chooseVolume(): void {
    this.done = true;
    this.settle({ values: { ...this.values }, lines: {} as SetupLines, method: "volume" });
    this.close();
  }

  private isBase(): boolean { return this.init.choices.find(c => c.name === this.values.reagent)?.base === true; }

  private place(): void {
    const anchor = this.init.anchor;
    if (!anchor) return;
    const w = Math.min(560, window.innerWidth * 0.92), h = this.modalEl.offsetHeight;
    this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - h - 8))}px` });
  }

  private text(row: HTMLElement, f: SetupField): void {
    const input = row.createEl("input", { cls: "lk-form-box", attr: { type: "text" } });
    input.value = this.values[f];
    input.addEventListener("input", () => { this.values[f] = input.value; input.removeClass("is-bad"); });
    this.inputs[f] = input;
  }

  /** A dropdown of the chemical notes that have `Acid / base` set, like the picture; with none, a box that suggests every chemical note (the block then asks for what the note lacks). */
  private reagent(row: HTMLElement): void {
    const listed = this.init.choices.filter(c => c.reagent);
    if (listed.length) {
      const sel = row.createEl("select", { cls: "dropdown lk-form-box" });
      const names = listed.map(c => c.name);
      if (this.values.reagent && !names.includes(this.values.reagent)) sel.createEl("option", { value: this.values.reagent, text: this.values.reagent });   // a reagent the block names that the list lacks
      for (const c of listed) sel.createEl("option", { value: c.name, text: c.name });   // the closed box shows the name only, like the picture
      if (!this.values.reagent) this.values.reagent = listed[0].name;
      sel.value = this.values.reagent;
      const detail = row.createDiv({ cls: "lk-sol-detail" });   // `99.7 % · pKa 4.76` below the box, never cut off
      const show = (): void => { detail.setText(listed.find(c => c.name === sel.value)?.detail ?? ""); };
      show();
      sel.addEventListener("change", () => { this.values.reagent = sel.value; show(); this.labels.share.setText(SETUP_LABEL.share(this.isBase())); });
      this.inputs.reagent = sel;
      return;
    }
    const input = row.createEl("input", { cls: "lk-form-box", attr: { type: "text" } });
    input.value = this.values.reagent;
    const store = (v: string): void => { this.values.reagent = v; input.removeClass("is-bad"); };
    input.addEventListener("input", () => store(input.value));
    this.popups.push(new Suggest(this.app, input, this.init.choices.map(c => ({ name: c.name })), store));
    this.inputs.reagent = input;
  }

  private submit(): void {
    const r = setupLines(this.values);
    if (!("lines" in r)) {
      this.message.setText(r.problem);
      this.message.addClass("is-bad");
      this.inputs[r.field].addClass("is-bad");
      this.inputs[r.field].focus();
      return;
    }
    this.done = true;
    this.settle({ values: { ...this.values }, lines: r.lines });
    this.close();
  }

  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node) && !document.querySelector(".suggestion-container")?.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    this.contentEl.empty();
    if (!this.done) this.settle(null);
  }
}

/** Opens the set-up window; its answer, or null on Cancel / Esc. */
export const openSetup: SetupFn = (app, init) => new Promise(resolve => new SetupWindow(app, init, resolve).open());

/** Under the cursor (desktop) while the setting is on, else the middle of the window. */
export const setupAnchor = (app: App, atCursor: boolean): EntryAnchor | null => atCursor ? cursorAnchor(app) : null;
