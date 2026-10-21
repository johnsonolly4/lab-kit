// RAFT block, the set-up window: at the cursor in the entry-window look, the boxes of the old RAFT recipe generator, in the layout of Solution prep's window.
// Used by Alt+S → RAFT recipe generator (inserts the block) and by the block's Edit set-up (rewrites only the changed lines).
// Plan: docs/plans/templater-replacement-and-live-snippets.md, Phase 9. New wording is listed in BACKLOG "Questions for the owner".
import { Modal, type App } from "obsidian";
import { Suggest } from "../../kit/snippet-form";
import type { EntryAnchor } from "../../planning/entry-window";
import { TEXT } from "./view";
import { RAFT_LABEL, raftLines, type RaftField, type RaftLines, type RaftValues } from "./text";

export interface RaftSetupInit {
  values: RaftValues;
  /** The chemical notes the name boxes suggest. */
  names: string[];
  anchor: EntryAnchor | null;
  /** The button on the right (`Insert` for a new block, `Save` for Edit set-up). */
  submit: string;
  /** The line under the boxes. */
  hint: string;
}
/** What the window answers: the boxes as typed and as block lines. */
export interface RaftSetupAnswer { values: RaftValues; lines: RaftLines }
export type RaftSetupFn = (app: App, init: RaftSetupInit) => Promise<RaftSetupAnswer | null>;

/** New wording: the line under the Monomer(s) box. */
export const MONOMER_HINT = "Several: DAAm, DMAm. A mole fraction after a colon sets the mix: DAAm: 0.7, DMAm: 0.3";

/** Window order: the monomers across, then the amounts, then the reagents. */
const ORDER: { field: RaftField; wide?: boolean; names?: boolean }[] = [
  { field: "monomers", wide: true, names: true },
  { field: "mass" }, { field: "dp" }, { field: "ratio" },
  { field: "cta", names: true }, { field: "initiator", names: true }, { field: "solids" },
  { field: "solvent", names: true }, { field: "cosolvent", names: true }, { field: "cosolventPct" },
];

class RaftSetupWindow extends Modal {
  private values: RaftValues;
  private inputs = {} as Record<RaftField, HTMLInputElement>;
  private message!: HTMLElement;
  private popups: Suggest[] = [];
  private done = false;

  constructor(app: App, private init: RaftSetupInit, private settle: (a: RaftSetupAnswer | null) => void) {
    super(app);
    this.values = { ...init.values };
  }

  onOpen(): void {
    this.modalEl.addClass("vt-entry", "lk-form", "lk-sol-setup", "lk-raft-setup");   // styles.css
    const anchor = this.init.anchor;
    if (anchor) {
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
    }
    this.contentEl.createEl("h3", { text: TEXT.window, cls: "vt-entry-heading" });
    const grid = this.contentEl.createDiv({ cls: "lk-sol-setup-grid" });
    for (const { field, wide, names } of ORDER) {
      const row = grid.createDiv({ cls: wide ? "lk-form-row is-wide" : "lk-form-row" });
      row.createDiv({ cls: "lk-form-label", text: RAFT_LABEL[field] });
      const input = row.createEl("input", { cls: "lk-form-box", attr: { type: "text" } });
      input.value = this.values[field];
      input.addEventListener("input", () => { this.values[field] = input.value; input.removeClass("is-bad"); });
      this.inputs[field] = input;
      if (names) this.popups.push(new Suggest(this.app, input, this.init.names.map(name => ({ name })), v => { this.values[field] = v; input.removeClass("is-bad"); }));
      if (field === "monomers") row.createDiv({ cls: "lk-sol-detail", text: MONOMER_HINT });
    }

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
    window.setTimeout(() => { const first = this.inputs.monomers; first.focus(); first.select(); }, 30);
  }

  private place(): void {
    const anchor = this.init.anchor;
    if (!anchor) return;
    const w = Math.min(560, window.innerWidth * 0.92), h = this.modalEl.offsetHeight;
    this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - h - 8))}px` });
  }

  private submit(): void {
    const r = raftLines(this.values);
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
export const openRaftSetup: RaftSetupFn = (app, init) => new Promise(resolve => new RaftSetupWindow(app, init, resolve).open());
