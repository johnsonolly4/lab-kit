// The Save snapshot… window of the rig block: an optional "What changed?" box, then the snapshot is saved (snapshot-io.ts) and a row is added to the rig note's history table.
// Plain version in the entry-window look (the Figure… window's frame); the look is the owner's to decide (BACKLOG "Questions for the owner"). Plan: docs/plans/rig-block-no-mermaid.md, Phase 4.
import { Modal, Notice, Platform, Setting, TFile, type App } from "obsidian";
import { cardWindow } from "../kit/window-look";
import { saveSnapshot } from "./snapshot-io";

/** Opens the window under `anchor` (the button that was clicked) on desktop, in the middle on a phone. `done` runs after a snapshot was saved, to redraw the block. */
export function openSnapshotWindow(app: App, notePath: string, version: string, anchor: HTMLElement | null, done: () => void): void {
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!(file instanceof TFile)) return;
  const r = Platform.isDesktop ? anchor?.getBoundingClientRect() : undefined;
  new SnapshotModal(app, file, version, r?.width ? { left: r.left, bottom: r.bottom } : null, done).open();
}

class SnapshotModal extends Modal {
  private change = "";
  private saving = false;

  constructor(app: App, private file: TFile, private version: string, private anchor: { left: number; bottom: number } | null, private done: () => void) { super(app); }

  onOpen(): void {
    cardWindow(this);
    this.modalEl.addClass("vt-entry");
    if (this.anchor) {
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
      const w = Math.min(560, window.innerWidth * 0.92);
      this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.min(this.anchor.bottom + 8, Math.max(8, window.innerHeight - 300))}px` });
    }
    this.setTitle("Save snapshot");
    const { contentEl } = this;
    contentEl.createDiv({ cls: "vt-entry-hint", text: "Saves a picture of the rig as it is now, with its parts tables inside, and adds a row to the Rig history table in this note." });
    new Setting(contentEl).setName("What changed?").setDesc("Optional.").addText(t => {
      t.onChange(v => { this.change = v; });
      t.inputEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); void this.save(); } });
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    const buttons = new Setting(contentEl);
    buttons.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
    buttons.addButton(b => b.setButtonText("Save snapshot").setCta().onClick(() => { void this.save(); }));
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      const r = await saveSnapshot(this.app, this.file, this.version, this.change);
      if (!r) new Notice("This rig has no parts to draw yet.");
      else if (!r.created) new Notice("The rig has not changed since the last snapshot: nothing new was saved.");
      else new Notice(`Saved ${r.file.name}.${r.rowNote ? " " + r.rowNote : ""}`, r.rowNote ? 10000 : 5000);
      this.done();
      this.close();
    } catch (e) {
      this.saving = false;
      new Notice(`Could not save the snapshot: ${e instanceof Error ? e.message : "see the developer console."}`);
      console.error("Lab Kit rig snapshot", e);
    }
  }

  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    this.contentEl.empty();
  }
}
