// Settings → Lab Kit → Clear old backups…: pick how old, see how many, move those backup folders to the trash.
import { Modal, Notice, Setting, type App } from "obsidian";
import { backupsSummary, listBackupRuns, olderThan, type BackupRun } from "./backups";
import { winFoot, winIntro, winSummary } from "./window-look";

const CHOICES: [string, string][] = [["30", "Older than 30 days"], ["7", "Older than 7 days"], ["0", "All of them"]];

export class ClearBackupsModal extends Modal {
  private runs: BackupRun[] = [];
  private days = 30;
  constructor(app: App, private folder: string) { super(app); }

  async onOpen(): Promise<void> {
    this.titleEl.setText("Clear old backups");
    this.runs = await listBackupRuns(this.app.vault.adapter, this.folder);
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.runs.length) { winIntro(contentEl, `No backups in ${this.folder || "the backup folder"}.`); winSummary(contentEl, backupsSummary(0, 0)); return; }
    const pick = olderThan(this.runs, this.days, Date.now());
    winIntro(contentEl, `${this.runs.length} backups in ${this.folder}. Each is a copy of files an update replaced.`);
    winSummary(contentEl, backupsSummary(this.runs.length, pick.length));
    new Setting(contentEl).setName("Delete backups")
      .addDropdown(d => { for (const [v, t] of CHOICES) d.addOption(v, t); d.setValue(String(this.days)).onChange(v => { this.days = Number(v); this.render(); }); });
    const foot = winFoot(contentEl);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const trash = foot.createEl("button", { text: "Move to trash", cls: "mod-warning" });
    trash.disabled = !pick.length;
    trash.addEventListener("click", () => { this.close(); void this.clear(pick); });
  }

  private async clear(pick: BackupRun[]): Promise<void> {
    const adapter = this.app.vault.adapter;
    let done = 0;
    for (const r of pick) {
      try {
        if (!(await adapter.trashSystem(r.path))) await adapter.trashLocal(r.path);
        done++;
      } catch (e) { console.error("Lab Kit backups", e); }
    }
    new Notice(done === pick.length ? `Moved ${done} backups to the trash.` : `Moved ${done} of ${pick.length} backups to the trash; see the console for the rest.`, 8000);
  }
}
