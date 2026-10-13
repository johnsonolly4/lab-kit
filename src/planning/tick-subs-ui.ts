// The question when a to-do with open subtasks is ticked on the plan map (planning kit): tick the subtasks too, or only this one.
import { Modal, Setting, type App } from "obsidian";

export type TickChoice = "all" | "one" | "cancel";

class TickSubsModal extends Modal {
  private chosen = false;
  constructor(app: App, private name: string, private names: string[], private answer: (c: TickChoice) => void) { super(app); }

  onOpen(): void {
    this.setTitle(`Tick ${this.names.length === 1 ? "its open subtask" : `its ${this.names.length} open subtasks`} too?`);
    this.contentEl.createEl("p", { text: `"${this.name}" has ${this.names.length === 1 ? "a subtask" : "subtasks"} that ${this.names.length === 1 ? "is" : "are"} not done yet:` });
    const ul = this.contentEl.createEl("ul");
    for (const n of this.names) ul.createEl("li", { text: n });
    const pick = (c: TickChoice): void => { this.chosen = true; this.close(); this.answer(c); };
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText("Only this one").onClick(() => pick("one")))
      .addButton(b => b.setButtonText(this.names.length === 1 ? "Tick both" : "Tick all").setCta().onClick(() => pick("all")));
  }

  onClose(): void { this.contentEl.empty(); if (!this.chosen) this.answer("cancel"); }
}

/** Asks what to do about the `open` subtasks (their names) of the to-do `name` being ticked. */
export const askTickSubs = (app: App, name: string, open: string[]): Promise<TickChoice> => new Promise(resolve => { new TickSubsModal(app, name, open, resolve).open(); });
