// Check hotkeys window: reads Obsidian's hotkeys and commands into a HotkeyState and lists checkHotkeys' rows.
// It sets a key only from Set the suggested keys: a list with tick boxes and a confirmation, for commands that have no key and whose suggested key is free.
import { Modal, Notice, type App } from "obsidian";
import { checkHotkeys, hotkeyReportMarkdown, hotkeyRowState, hotkeySummary, settableHotkeys, type HotkeyRow } from "./hotkey-check";
import { cardWindow, winFoot, winIntro, winRow, winSummary } from "./window-look";
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
    el.addClass("lab-kit-win");
    cardWindow(this);
    this.setTitle("Check hotkeys");
    const rows = this.rows(), free = hotkeysWritable(this.app) ? settableHotkeys(rows) : [];
    winIntro(el, "The recommended keys, and what you have now. A key is only set when you use the button below and confirm; a key you have is never changed.");
    winSummary(el, hotkeySummary(rows));
    for (const r of rows) winRow(el, { state: hotkeyRowState(r), title: r.recommended ? `${r.recommended}: ${r.does}` : r.does, detail: `${r.command}. ${r.detail}` });
    const foot = winFoot(el);
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
}

/** The list before any key is set: one tick box per key that can be set, and the rows that are left alone with the reason. Nothing is written before Set keys. */
class SetHotkeysModal extends Modal {
  constructor(app: App, private free: (HotkeyRow & { id: string })[], private skipped: HotkeyRow[], private onConfirm: (ids: string[]) => Promise<void>) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    el.addClass("lab-kit-win");
    cardWindow(this);
    this.setTitle("Set the suggested keys?");
    winIntro(el, "These commands have no key, and their suggested key is free. Untick any you don't want. You can change or remove a key later in the hotkey settings.");
    winSummary(el, `${this.free.length} ${this.free.length === 1 ? "key" : "keys"} can be set.`);
    const off = new Set<string>();
    for (const r of this.free) {
      const { row } = winRow(el, { state: "todo", label: true, title: `${r.recommended}: ${r.does}`, detail: r.command });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = true;
      box.addEventListener("change", () => { if (box.checked) off.delete(r.id); else off.add(r.id); });
    }
    if (this.skipped.length) {
      el.createEl("h4", { text: "Left as they are" });
      for (const r of this.skipped) el.createDiv({ cls: "setting-item-description", text: `${r.recommended}: ${r.does}. ${r.detail}` });
    }
    const foot = winFoot(el);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    foot.createEl("button", { text: "Set keys", cls: "mod-cta" }).addEventListener("click", () => {
      this.close();
      void this.onConfirm(this.free.map(r => r.id).filter(id => !off.has(id)));
    });
  }
  onClose(): void { this.contentEl.empty(); }
}
