// Merge window: settle a kit file where you and the kit changed the same lines, one hunk at a time.
// Nothing is written until Apply; the file never gets conflict markers (the preview marks undecided hunks, the file does not).
import { ButtonComponent, Modal, Setting, type App } from "obsidian";
import { mergeRegions, resolveRegions, type HunkChoice, type Region } from "./merge";

export interface MergeInputs {
  dest: string;
  /** Scripts get the "please test it" warning and "Take kit" suggested. */
  isScript: boolean;
  /** What the kit installed last time; null when there is no copy (then only whole-file choices are offered). */
  base: string | null;
  /** Your file as it is now. */
  ours: string;
  /** The new kit version. */
  theirs: string;
}
export interface MergeActions {
  /** Write the resolved text after a backup; null = keep your file as it is and mark it as based on the new kit version. */
  apply(text: string | null): Promise<void>;
  /** Put the kit's copy back (asks first, then closes this window itself). */
  takeKit(): void;
  /** Runs when the window closes, whatever the reason. */
  done(): void;
}

const SHOWN_IF_EMPTY = "(nothing)";
const UNDECIDED = "⟨ not decided yet ⟩";

type Conflict = Extract<Region, { conflict: unknown }>["conflict"];

export class KitMergeModal extends Modal {
  private regions: Region[];
  private conflicts: Conflict[];
  private choices: (HunkChoice | null)[];
  private previewEl: HTMLElement | null = null;
  private applyBtn: ButtonComponent | null = null;

  constructor(app: App, private input: MergeInputs, private actions: MergeActions) {
    super(app);
    this.regions = input.base === null ? [] : mergeRegions(input.base, input.ours, input.theirs);
    this.conflicts = this.regions.flatMap(r => "conflict" in r ? [r.conflict] : []);
    this.choices = this.conflicts.map(() => null);
  }

  onOpen(): void {
    const { contentEl, input } = this;
    this.titleEl.setText("Resolve conflict");
    contentEl.addClass("lab-kit-modal");
    contentEl.createEl("p", { cls: "setting-item-description" }).createEl("code", { text: input.dest });
    if (input.isScript) contentEl.createEl("p", { text: "This is code. After merging, please test it. Taking the kit's version is the safe choice.", cls: "mod-warning" });

    if (!this.conflicts.length) {
      contentEl.createEl("p", { text: input.base === null
        ? "There is no copy of the original kit file to compare with, so the changes can't be split into parts. Keep your file, or put the kit's version back."
        : "Nothing overlaps any more. Close this window and use Merge in Manage kit files." });
    } else {
      contentEl.createEl("p", { text: `${this.conflicts.length} place${this.conflicts.length === 1 ? "" : "s"} where you and the kit changed the same lines. Decide each one, then Apply.` });
      this.conflicts.forEach((c, i) => this.renderHunk(contentEl.createDiv({ cls: "lab-kit-hunk" }), i, c));
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = true;
      det.createEl("summary", { text: "Preview of the file" });
      this.previewEl = det.createEl("pre", { cls: "lab-kit-preview" });
    }

    new Setting(contentEl).setName("Keep all mine").setDesc("Your file stays exactly as it is, and counts as based on the new kit version.")
      .addButton(b => b.setButtonText("Keep all mine").onClick(() => void this.run(() => this.actions.apply(null))));
    new Setting(contentEl).setName("Take kit version").setDesc("Replaces your file with the kit's. Your copy is backed up first.")
      .addButton(b => b.setButtonText("Take kit version").onClick(() => this.actions.takeKit()));
    const footer = new Setting(contentEl).addButton(b => b.setButtonText("Later").onClick(() => this.close()));
    if (this.conflicts.length) {
      footer.addButton(b => { this.applyBtn = b; b.setButtonText("Apply").setCta().onClick(() => void this.run(() => this.actions.apply(this.resolved()))); });
    }
    this.refresh();
  }

  /** Closes the window once the action went through; on failure the caller shows the message and the window stays. */
  private async run(action: () => Promise<void>): Promise<void> {
    try { await action(); this.close(); } catch { /* the caller already told the user (KitManaged.failed) */ }
  }

  private resolved(): string | null { return resolveRegions(this.regions, this.choices, this.input.ours); }

  private refresh(): void {
    this.previewEl?.setText(resolveRegions(this.regions, this.choices.map(c => c ?? { edit: UNDECIDED }), this.input.ours) ?? "");
    const left = this.choices.filter(c => c === null).length;
    this.applyBtn?.setDisabled(left > 0).setButtonText(left ? `Apply (${left} left to decide)` : "Apply");
  }

  private column(parent: HTMLElement, label: string, text: string[]): void {
    const col = parent.createDiv({ cls: "lab-kit-hunk-col" });
    col.createDiv({ text: label, cls: "lab-kit-hunk-label" });
    const empty = text.length === 0;
    col.createEl("pre", { text: empty ? SHOWN_IF_EMPTY : text.join("\n"), cls: empty ? "is-empty" : undefined });
  }

  private renderHunk(card: HTMLElement, i: number, c: Conflict): void {
    card.empty();
    card.createDiv({ text: `Change ${i + 1} of ${this.conflicts.length}`, cls: "lab-kit-hunk-title" });
    const cols = card.createDiv({ cls: "lab-kit-hunk-cols" });
    this.column(cols, "Yours", c.ours);
    this.column(cols, "Kit", c.theirs);
    this.column(cols, "Original", c.base);

    const choice = this.choices[i];
    const pick = (next: HunkChoice): void => { this.choices[i] = next; this.renderHunk(card, i, c); this.refresh(); };
    const row = card.createDiv({ cls: "lab-kit-hunk-buttons" });
    const button = (text: string, active: boolean, next: () => HunkChoice): void => {
      const b = new ButtonComponent(row).setButtonText(text).onClick(() => pick(next()));
      if (active) b.setCta();
    };
    button("Keep mine", choice === "mine", () => "mine");
    button(this.input.isScript ? "Take kit (suggested)" : "Take kit", choice === "kit", () => "kit");
    button("Keep both", choice === "both", () => "both");
    const editing = typeof choice === "object" && choice !== null;
    button("Edit", editing, () => (editing ? choice : { edit: c.ours.join("\n") }));
    card.toggleClass("is-undecided", choice === null);

    if (editing) {
      const area = card.createEl("textarea", { cls: "lab-kit-hunk-edit", attr: { rows: String(Math.max(3, choice.edit.split("\n").length + 1)), spellcheck: "false" } });
      area.value = choice.edit;
      area.addEventListener("input", () => { this.choices[i] = { edit: area.value }; this.refresh(); });
    }
  }

  onClose(): void {
    this.contentEl.empty();
    this.actions.done();
  }
}
