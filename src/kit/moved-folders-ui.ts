// Find moved folders window: for each folder setting whose folder is missing, pick where it went (suggested), another folder, or make it
// again. Apply changes only Lab Kit's settings and what it tracks (kit files under the new path); nothing is moved on disk.
import { Modal, Notice, Setting, TFile, normalizePath, type App } from "obsidian";
import { ensureFolder } from "./ensure-folder";
import { followRename } from "./managed";
import { findMoved, missingFolderSettings, type MissingFolder } from "./moved-folders";
import { kitJoin, missingPlanningFolders, PLANNING_KIT, type KitData, type PlanningRole } from "./paths";
import { loadedPlugins } from "./obsidian-private";
import { wideBox } from "./settings-box";

export interface MovedHost { kit: KitData; save(): Promise<void> }

/** Folder settings whose folder is missing now (planning folders only while the planning kit is on). */
export function missingNow(app: App, kit: KitData): MissingFolder[] {
  const exists = (p: string): boolean => !!app.vault.getFolderByPath(p);
  const planningOn = !!kit.kits[PLANNING_KIT]?.enabled;
  return missingFolderSettings({
    planning: { ...kit.planningFolders },
    planningMissing: planningOn ? missingPlanningFolders(kit.planningFolders, exists, loadedPlugins(app).has("zotlit")) : [],
    labFolder: kitJoin(kit.labFolder.trim()), chemicalFolder: kitJoin(kit.chemicalFolder.trim()), exists,
  });
}

/** Choice for one missing folder: a found or typed folder, make it again, or leave the setting as it is. */
type Choice = { to: string } | { create: true } | { leave: true };

export class MovedFoldersModal extends Modal {
  private choices = new Map<string, Choice>();

  constructor(app: App, private host: MovedHost) { super(app); }

  onOpen(): void { this.render(); }
  onClose(): void { this.contentEl.empty(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    this.setTitle("Find moved folders");
    const missing = missingNow(this.app, this.host.kit);
    if (!missing.length) { el.createEl("p", { text: "Every folder named in the settings exists. Nothing to fix." }); return; }
    el.createEl("p", { text: "These folders named in the settings no longer exist, most likely because they were moved outside Obsidian. Pick where each one went. Apply only changes the settings: no note or folder is moved." });

    const folders = this.app.vault.getAllFolders(false).map(f => f.path);
    const files = this.app.vault.getFiles().map(f => f.path);
    const notes = this.app.vault.getMarkdownFiles().map(f => ({ path: f.path, kind: this.kindOf(f) })).filter(n => n.kind);
    const tracked = Object.values(this.host.kit.kits).flatMap(s => Object.values(s.managed?.files ?? {}).map(f => f.path));
    const pf: KitData["planningFolders"] = this.host.kit.planningFolders;
    const taken: string[] = [...Object.values(pf) as string[], this.host.kit.labFolder, this.host.kit.chemicalFolder];

    for (const m of missing) {
      const found = findMoved(m, folders, notes, files, tracked.filter(p => p.startsWith(m.path + "/")), taken).slice(0, 5);
      this.choices.set(m.key, found.length ? { to: found[0].path } : { leave: true });
      new Setting(el).setName(`${m.label}: ${m.path}`)
        .setDesc(found.length ? `Found: ${found[0].path} (${found[0].reason}).` : "Not found. Pick the folder, or make it again.")
        .addDropdown(d => {
        for (const c of found) d.addOption(`to:${c.path}`, `${c.path} (${c.reason})`);
        d.addOption("create", `Make ${m.path} again (empty)`);
        d.addOption("leave", "Leave as it is");
        d.setValue(found.length ? `to:${found[0].path}` : "leave");
        d.onChange(v => this.choices.set(m.key, v === "create" ? { create: true } : v === "leave" ? { leave: true } : { to: v.slice(3) }));
      });
      const other = new Setting(el).setName("Or another folder").setDesc("Type or pick a folder; it is used instead of the choice above.");
      other.addText(t => {
        wideBox(other, t, this.app);
        t.setPlaceholder("Folder").onChange(v => { if (v.trim()) this.choices.set(m.key, { to: normalizePath(v.trim()) }); });
      });
    }
    new Setting(el)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText("Apply").setCta().onClick(() => void this.apply(missing)));
  }

  private kindOf(f: TFile): string {
    const k: unknown = this.app.metadataCache.getFileCache(f)?.frontmatter?.kind;
    return typeof k === "string" ? k : "";
  }

  private async apply(missing: MissingFolder[]): Promise<void> {
    const kit = this.host.kit;
    const done: string[] = [];
    for (const m of missing) {
      const c = this.choices.get(m.key);
      if (!c || "leave" in c) continue;
      if ("create" in c) { await ensureFolder(this.app.vault, m.path); done.push(`Made ${m.path}`); continue; }
      if (!this.app.vault.getFolderByPath(c.to)) { new Notice(`${c.to} is not a folder: ${m.label} left as it is.`); continue; }
      const [scope, key] = m.key.split(":");
      if (scope === "planning") kit.planningFolders[key as PlanningRole] = c.to;
      else if (key === "labFolder") kit.labFolder = c.to;
      else if (key === "chemicalFolder") kit.chemicalFolder = c.to;
      for (const slot of Object.values(kit.kits)) followRename(slot.managed, m.path, c.to);   // kit files found there are tracked again
      done.push(`${m.label} → ${c.to}`);
    }
    await this.host.save();
    this.close();
    new Notice(done.length ? done.join("\n") : "Nothing changed.");
  }
}
