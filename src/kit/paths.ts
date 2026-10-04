// Kit paths and saved state: where each part of the kit lives in the vault, path helpers, and the `kit` key of data.json.
// Works on mobile: only the Vault API and Templater's settings.
import type { App, DataAdapter } from "obsidian";
import { templaterSettings } from "./obsidian-private";
import type { ManagedState } from "./managed";

export type Roles = Record<string, string>;
/** What the old folder updater (removed) recorded. Kept so files it wrote are not mistaken for your edits. */
export interface KitRecord { version: string; roles: Roles; files: Record<string, string>; installedAt: string }
/** The `kit` key of data.json. */
export interface KitData {
  /** Old folder updater's install record, read only for migration. */
  installed: KitRecord | null;
  seenChangelog: string; initials: string; snippetIcons: Record<string, string>;
  /** Built-in kit (embedded in the plugin): what was installed, per file id. */
  managed: ManagedState | null;
  /** Folders the user set for the built-in kit (templates, scripts, backups). Empty = detected. */
  paths: Roles;
  /** Optional kit files the user switched off (ids): not installed, not updated. */
  off: Record<string, true>;
  /** Show a notice at startup when the plugin brings a newer kit. */
  notifyKitUpdate: boolean;
  debug: boolean;
  /** Vault folder of chemical notes (autocomplete in calc cells and forms). Empty = no chemical database. */
  chemicalFolder: string;
  /** Property of a chemical note that holds its molecular weight, tried before the built-in names. Empty = built-in names only. */
  mwProperty: string;
}

export const KIT_DEFAULTS: KitData = { installed: null, seenChangelog: "", initials: "", snippetIcons: {}, managed: null, paths: {}, off: {}, notifyKitUpdate: true, debug: false, chemicalFolder: "", mwProperty: "" };

const kitVersionText = (v: unknown): string => typeof v === "string" || typeof v === "number" ? String(v) : "0";
export function kitCompare(a: unknown, b: unknown): number {
  const pa = kitVersionText(a).split(".").map(n => parseInt(n, 10) || 0);
  const pb = kitVersionText(b).split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
export const kitJoin = (...parts: (string | null | undefined)[]): string => parts.filter(p => p != null && p !== "").join("/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
/** True for a file inside a backup folder (the kit's backups are `<backup folder>/<time stamp>/…`): never a place the kit's files live. */
export const kitIsBackup = (path: string): boolean => /(^|\/)\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\//.test(path);
/** True for a folder that is a backup folder or inside one. */
export const kitInBackup = (folder: string): boolean => kitIsBackup(folder + "/");
export const kitParent = (p: string): string => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";

export async function kitEnsureDir(adapter: Pick<DataAdapter, "exists" | "mkdir">, dir: string): Promise<void> {
  if (!dir) return;
  const parts = dir.split("/"); let cur = "";
  for (const p of parts) { cur = cur ? `${cur}/${p}` : p; if (!(await adapter.exists(cur))) await adapter.mkdir(cur); }
}

/**
 * Where each part of the kit lives in this vault.
 * `tracked`: the folders where the kit already put files. Templates and user scripts follow the files that are already there, so a file
 * added by a later kit version lands beside them; only a vault with no kit files yet gets the default layout: Templater's own templates
 * folder (else Templates) for the templates and Templater's user scripts folder (else scripts) for all scripts, both at the vault root, no
 * subfolders. `record` (old folder updater) supplies scripts and backups.
 */
export function kitDetectRoles(app: App, record: KitRecord | null, tracked: Partial<Roles>): Roles {
  const files = app.vault.getFiles().filter(f => !kitIsBackup(f.path));   // a backup copy of labForm.js must not look like the real one
  // Folders that sit inside a backup are mistakes (an earlier version copied one into Templater's settings): ignored
  const sane = (p?: string): string => (p && !kitInBackup(p) ? p : "");
  const raw = templaterSettings(app);
  const tpl = { user_scripts_folder: sane(raw.user_scripts_folder), templates_folder: sane(raw.templates_folder) };
  const remembered: Partial<Roles> = Object.fromEntries(Object.entries(record?.roles ?? {}).filter(([, v]) => sane(v)));
  const find = (name: string, test?: (f: (typeof files)[number]) => boolean) => files.find(f => f.name === name && (!test || test(f)));
  const scriptsFound = find("excel_to_calc.py");
  const scripts = remembered.scripts ?? (scriptsFound ? scriptsFound.parent!.path : "scripts");
  const menu = find("Insert snippet.md");
  const formScript = find("labForm.js");
  return {
    cssSnippets: kitJoin(app.vault.configDir, "snippets"),
    scripts,
    userScripts: tracked.userScripts ?? (formScript ? formScript.parent!.path : tpl.user_scripts_folder || scripts),
    templates: tracked.templates ?? (menu ? menu.parent!.path : tpl.templates_folder || "Templates"),
    backups: remembered.backups ?? kitJoin(app.vault.configDir, "plugins", "lab-kit", "backups"),   // inside the plugin folder: out of the file tree
  };
}
