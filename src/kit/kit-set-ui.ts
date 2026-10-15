// Both kits as one (Settings → Lab Kit → Updates, planning kit on): "Update all safe files", Review update… and Manage files… for both at once. The logic is in
// src/kit/kit-set.ts; the windows are the per-kit ones in src/kit/managed-ui.ts with a section per kit.
import { Notice, type App } from "obsidian";
import { runSafeUpdate, type SafeKit } from "./kit-set";
import { KitFilesModal, KitInstallModal, KitManagedModal, KitReportModal, type ClosingModal, type KitManaged } from "./managed-ui";
import type { ManagedItem } from "./managed";

/** The kits that are on, treated as one. */
export class KitSet {
  constructor(private app: App, private kits: KitManaged[]) {}

  get size(): number { return this.kits.length; }

  /** "Update all safe files": plans every kit, asks once (the merged list of files, folders and settings changes), writes each kit, and shows one report. */
  updateSafe(): Promise<void> {
    return this.run(this.kits.map(k => k.asSafeKit()), n => ({ title: n ? `Update ${n} kit files?` : "Change these settings?", yes: n ? "Update" : "Apply" }), new Set());
  }

  /** The review window's Apply for both kits: the ticked files of each, one confirmation, one report. */
  applyReviewed(picks: { kit: KitManaged; items: ManagedItem[]; select: (it: ManagedItem) => boolean }[], scripts: Set<string>): Promise<void> {
    return this.run(picks.map(p => p.kit.asSafeKit({ items: p.items, select: p.select })), () => ({ title: "Update these files?", yes: "Update" }), scripts);
  }

  /** Review update… for both kits. */
  review(): ClosingModal { const m = new KitManagedModal(this.app, this.kits, (picks, scripts) => this.applyReviewed(picks, scripts)); m.open(); return m; }

  /** Manage files… for both kits. */
  manage(): ClosingModal { const m = new KitFilesModal(this.app, this.kits); m.open(); return m; }

  /** Plans, asks once, writes each kit, names a kit that failed (the others still run) and shows one report. A kit that fails does not stop the other. */
  private async run(kits: SafeKit[], words: (n: number) => { title: string; yes: string }, scripts: Set<string>): Promise<void> {
    try {
      const out = await runSafeUpdate(kits, (merged, combined) => new Promise(resolve => {
        const w = words(combined.create.length + combined.update.length);
        new KitInstallModal(this.app, w.title, w.yes, combined, merged.settings, merged.notes, async chosen => { resolve(chosen); }, () => resolve(null)).open();
      }));
      if (out.cancelled) return;
      for (const f of out.failed) { console.error(f.error); new Notice(`${f.name} stopped: ${(f.error as Error).message}\nAnything it replaced is in the backups folder.`, 15000); }
      new KitReportModal(this.app, out.results, scripts).open();
    } catch (e) { this.kits[0]?.failed(e); }
  }
}
