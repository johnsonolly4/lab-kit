// Check hotkeys window: reads Obsidian's hotkeys and commands into a HotkeyState and lists checkHotkeys' rows.
// It sets a key only from Set the suggested keys: a list with tick boxes and a confirmation, for commands that have no key and whose suggested key is free.
import { Modal, Notice, type App } from "obsidian";
import { checkHotkeys, hotkeyReportMarkdown, settableHotkeys, type HotkeyRow } from "./hotkey-check";
import { commandNames, hotkeysInUse, hotkeysSupported, hotkeysWritable, setHotkeys } from "./obsidian-private";

export class HotkeyCheckModal extends Modal {
  constructor(app: App, private planning: boolean) { super(app); }

  onOpen(): void { this.render(); }
  onClose(): void { this.contentEl.empty(); }

  private rows(): HotkeyRow[] {
    return checkHotkeys({ planning: this.planning, hotkeys: hotkeysSupported(this.app) ? hotkeysInUse(this.app) : null, commands: commandNames(this.app) });
  }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("lab-kit-setup-check");
    this.setTitle("Check hotkeys");
    const rows = this.rows(), free = hotkeysWritable(this.app) ? settableHotkeys(rows) : [];
    el.createEl("p", { text: "The recommended keys, and what you have now. A key is only set when you use the button below and confirm; a key you have is never changed." });
    for (const r of rows) this.row(el, r);
    const foot = el.createDiv({ cls: "lab-kit-tidy-foot" });
    if (free.length) foot.createEl("button", { text: "Set the suggested keys…", cls: "mod-cta" }).addEventListener("click", () => {
      new SetHotkeysModal(this.app, free, rows.filter(r => !!r.recommended && (r.status === "other" || r.status === "clash" || r.status === "missing")), async picked => {
        // look again: only commands that still have no key and whose suggested key is still free
        const still = settableHotkeys(this.rows()).filter(r => picked.includes(r.id));
        const n = await setHotkeys(this.app, still.map(r => ({ id: r.id, key: r.key })));
        new Notice(`${n} ${n === 1 ? "hotkey" : "hotkeys"} set.`);
        this.render();
      }).open();
    });
    foot.createEl("button", { text: "Copy as Markdown" }).addEventListener("click", () => {
      void navigator.clipboard.writeText(hotkeyReportMarkdown(rows)).then(() => new Notice("Report copied."), () => new Notice("Couldn't copy the report."));
    });
  }

  private row(el: HTMLElement, r: HotkeyRow): void {
    const state = r.status === "set" ? "is-ok" : r.status === "none" && !r.recommended ? "is-optional" : r.status === "other" ? "is-warn" : r.status === "unreadable" ? "is-warn" : "is-missing";
    const row = el.createDiv({ cls: `lab-kit-setup-row ${state}` });
    row.createSpan({ cls: "lab-kit-setup-mark", text: state === "is-ok" ? "✓" : state === "is-optional" ? "–" : state === "is-warn" ? "!" : "✗" });
    const text = row.createDiv({ cls: "lab-kit-setup-text" });
    text.createDiv({ text: r.recommended ? `${r.recommended}: ${r.does}` : r.does });
    text.createDiv({ cls: "setting-item-description", text: `${r.command}. ${r.detail}` });
  }
}

/** The list before any key is set: one tick box per key that can be set, and the rows that are left alone with the reason. Nothing is written before Set keys. */
class SetHotkeysModal extends Modal {
  constructor(app: App, private free: (HotkeyRow & { id: string })[], private skipped: HotkeyRow[], private onConfirm: (ids: string[]) => Promise<void>) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    el.addClass("lab-kit-setup-check");
    this.setTitle("Set the suggested keys?");
    el.createEl("p", { text: "These commands have no key, and their suggested key is free. Untick any you don't want. You can change or remove a key later in the hotkey settings." });
    const off = new Set<string>();
    for (const r of this.free) {
      const row = el.createEl("label", { cls: "lab-kit-setup-row" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = true;
      box.addEventListener("change", () => { if (box.checked) off.delete(r.id); else off.add(r.id); });
      const text = row.createDiv({ cls: "lab-kit-setup-text" });
      text.createDiv({ text: `${r.recommended}: ${r.does}` });
      text.createDiv({ cls: "setting-item-description", text: r.command });
    }
    if (this.skipped.length) {
      el.createEl("h4", { text: "Left as they are" });
      for (const r of this.skipped) el.createDiv({ cls: "setting-item-description", text: `${r.recommended}: ${r.does}. ${r.detail}` });
    }
    const foot = el.createDiv({ cls: "lab-kit-tidy-foot" });
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    foot.createEl("button", { text: "Set keys", cls: "mod-cta" }).addEventListener("click", () => {
      this.close();
      void this.onConfirm(this.free.map(r => r.id).filter(id => !off.has(id)));
    });
  }
  onClose(): void { this.contentEl.empty(); }
}
