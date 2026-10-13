// The preview for Link to-dos in order: what will be written, what is left out, then one confirm. Nothing is written before it.
import { Modal, Notice, Setting, type App } from "obsidian";

export class SequenceModal extends Modal {
  constructor(app: App, private links: string[], private skipped: string[], private run: () => Promise<void>) { super(app); }

  onOpen(): void {
    this.setTitle("Link to-dos in order");
    const { contentEl } = this;
    if (this.links.length) {
      contentEl.createEl("p", { text: "These links will be written:" });
      const ul = contentEl.createEl("ul");
      for (const l of this.links) ul.createEl("li", { text: l });
    } else contentEl.createEl("p", { text: "Nothing to link: every pair is already linked or left out." });
    if (this.skipped.length) {
      contentEl.createEl("p", { cls: "setting-item-description", text: "Left out:" });
      const ul = contentEl.createEl("ul");
      for (const s of this.skipped) ul.createEl("li", { cls: "setting-item-description", text: s });
    }
    const buttons = new Setting(contentEl);
    buttons.addButton(b => b.setButtonText(this.links.length ? "Cancel" : "Close").onClick(() => this.close()));
    if (this.links.length) buttons.addButton(b => b.setButtonText(`Link ${this.links.length}`).setCta().onClick(() => {
      this.close();
      this.run().catch(() => { new Notice("Could not write those links."); });
    }));
  }

  onClose(): void { this.contentEl.empty(); }
}
