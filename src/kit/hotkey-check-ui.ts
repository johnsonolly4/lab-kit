// Check hotkeys window: reads Obsidian's hotkeys and commands into a HotkeyState and lists checkHotkeys' rows. Reads only.
import { Modal, Notice, type App } from "obsidian";
import { checkHotkeys, hotkeyReportMarkdown, type HotkeyRow } from "./hotkey-check";
import { commandNames, hotkeysInUse, hotkeysSupported } from "./obsidian-private";

export class HotkeyCheckModal extends Modal {
  constructor(app: App, private planning: boolean) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    el.addClass("lab-kit-setup-check");
    this.setTitle("Check hotkeys");
    const rows = checkHotkeys({ planning: this.planning, hotkeys: hotkeysSupported(this.app) ? hotkeysInUse(this.app) : null, commands: commandNames(this.app) });
    el.createEl("p", { text: "The recommended keys, and what you have now. Nothing here sets a key: change them in the hotkey settings." });
    for (const r of rows) this.row(el, r);
    el.createEl("button", { text: "Copy as Markdown" }).addEventListener("click", () => {
      void navigator.clipboard.writeText(hotkeyReportMarkdown(rows)).then(() => new Notice("Report copied."), () => new Notice("Couldn't copy the report."));
    });
  }

  onClose(): void { this.contentEl.empty(); }

  private row(el: HTMLElement, r: HotkeyRow): void {
    const state = r.status === "set" ? "is-ok" : r.status === "none" && !r.recommended ? "is-optional" : r.status === "other" ? "is-warn" : r.status === "unreadable" ? "is-warn" : "is-missing";
    const row = el.createDiv({ cls: `lab-kit-setup-row ${state}` });
    row.createSpan({ cls: "lab-kit-setup-mark", text: state === "is-ok" ? "✓" : state === "is-optional" ? "–" : state === "is-warn" ? "!" : "✗" });
    const text = row.createDiv({ cls: "lab-kit-setup-text" });
    text.createDiv({ text: r.recommended ? `${r.recommended}: ${r.does}` : r.does });
    text.createDiv({ cls: "setting-item-description", text: `${r.command}. ${r.detail}` });
  }
}
