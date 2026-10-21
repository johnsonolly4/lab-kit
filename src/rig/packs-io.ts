// Rig figure: reads the module pack from the vault and tells the figure engine about it ("Check module pack" is here too).
// Plan: docs/plans/rig-figure.md, Phase 6. The pure part is packs.ts.
import { Modal, Notice, TFile, TFolder, normalizePath, type App, type Plugin } from "obsidian";
import { usePack } from "./figure-make";
import { loadPack, packReport, type Pack, type PackIo } from "./packs";

let folderSetting: () => string = () => "";
/** Where the Module pack folder setting is read (set once by the plugin). */
export const setPackFolder = (get: () => string): void => { folderSetting = get; };
export const packFolder = (): string => { const f = folderSetting().trim(); return f ? normalizePath(f) : ""; };

export function vaultPackIo(app: App): PackIo {
  const file = (path: string): TFile | null => { const f = app.vault.getAbstractFileByPath(normalizePath(path)); return f instanceof TFile ? f : null; };
  return {
    async list(folder) {
      const root = app.vault.getAbstractFileByPath(folder);
      if (!(root instanceof TFolder)) return null;
      const out: string[] = [];
      const walk = (dir: TFolder): void => { for (const c of dir.children) { if (c instanceof TFolder) walk(c); else out.push(c.path.slice(root.path.length + 1)); } };
      walk(root);
      return out;
    },
    async text(path) { const f = file(path); return f ? app.vault.cachedRead(f) : null; },
    async binary(path) { const f = file(path); return f ? app.vault.readBinary(f) : null; },
  };
}

/** Reads the pack from the Module pack folder and hands it to the figure engine (none when the setting is empty). Call before making a figure. */
export async function refreshPack(app: App): Promise<Pack | null> {
  const folder = packFolder();
  let pack: Pack | null = null;
  if (folder) {
    try { pack = await loadPack(vaultPackIo(app), folder); } catch (e) { console.error("Lab Kit module pack", e); }
  }
  usePack(pack);
  return pack;
}

/** Whether a changed file belongs to the pack (the rig blocks then redraw). */
export const inPack = (path: string): boolean => { const f = packFolder(); return !!f && path.startsWith(f + "/"); };

class PackCheckModal extends Modal {
  constructor(app: App, private lines: string[]) { super(app); }
  onOpen(): void {
    this.setTitle("Module pack");
    const list = this.contentEl.createEl("ul", { cls: "lab-kit-pack-check" });
    for (const l of this.lines) list.createEl("li", { text: l, ...(/^(Missing|Unreadable|Unused|Module pack:)/.test(l) ? { cls: "lab-kit-warn" } : {}) });
  }
  onClose(): void { this.contentEl.empty(); }
}

/** "Check module pack": says what is missing, unreadable or unused. */
export async function checkPack(app: App): Promise<void> {
  if (!packFolder()) { new Notice("No module pack folder is set. Choose one in the plugin settings."); return; }
  const pack = await refreshPack(app);
  if (!pack) { new Notice("The module pack could not be read."); return; }
  new PackCheckModal(app, packReport(pack)).open();
}

/** The command (the setting's button calls `checkPack` too). */
export function registerPackCommand(plugin: Plugin): void {
  plugin.addCommand({ id: "check-module-pack", name: "Check module pack", callback: () => void checkPack(plugin.app).catch(e => { console.error("Lab Kit module pack", e); new Notice("The module pack could not be checked."); }) });
}
