// "Update all safe files" for both kits (Settings → Lab Kit → Updates): one confirmation, one report. The logic is in src/kit/kit-set.ts (runSafeUpdate).
import { Notice, type App } from "obsidian";
import { runSafeUpdate } from "./kit-set";
import { KitInstallModal, KitReportModal, type KitManaged } from "./managed-ui";

/** The kits that are on, treated as one. */
export class KitSet {
  constructor(private app: App, private kits: KitManaged[]) {}

  /** Plans every kit, asks once (the merged list of files, folders and settings changes), writes each kit, and shows one report. A kit that fails is named; the others still run. */
  async updateSafe(): Promise<void> {
    try {
      const out = await runSafeUpdate(this.kits.map(k => k.asSafeKit()), (merged, combined) => new Promise(resolve => {
        const n = combined.create.length + combined.update.length;
        new KitInstallModal(this.app, n ? `Update ${n} kit files?` : "Change these settings?", n ? "Update" : "Apply", combined, merged.settings, merged.notes, async chosen => { resolve(chosen); }, () => resolve(null)).open();
      }));
      if (out.cancelled) return;
      for (const f of out.failed) { console.error(f.error); new Notice(`${f.name} stopped: ${(f.error as Error).message}\nAnything it replaced is in the backups folder.`, 15000); }
      new KitReportModal(this.app, out.results).open();
    } catch (e) { this.kits[0]?.failed(e); }
  }
}
