// Kit paths and saved state: where each part of the kit lives in the vault, path helpers, and the `kit` key of data.json.
// Works on mobile: only the Vault API and Templater's settings.
import type { App, DataAdapter } from "obsidian";
import { templaterSettings } from "./obsidian-private";
import type { ManagedState } from "./managed";

export type Roles = Record<string, string>;
/** Id of the lab kit (kits/lab/kit-manifest.json). */
export const LAB_KIT = "lab";
/** What the plugin keeps per kit (the `kit.kits.<id>` key of data.json). */
export interface KitSlot {
  /** The kit is switched on (installed and updated). */
  enabled: boolean;
  /** What was installed, per file id. */
  managed: ManagedState | null;
  /** Folders the user set for this kit (templates, scripts, backups). Empty = detected. */
  paths: Roles;
  /** Optional kit files the user switched off (ids): not installed, not updated. */
  off: Record<string, true>;
}
/** What the old folder updater (removed) recorded. Kept so files it wrote are not mistaken for your edits. */
export interface KitRecord { version: string; roles: Roles; files: Record<string, string>; installedAt: string }
/** The `kit` key of data.json. */
export interface KitData {
  /** Old folder updater's install record, read only for migration. */
  installed: KitRecord | null;
  seenChangelog: string; initials: string; snippetIcons: Record<string, string>;
  /** Built-in kits (embedded in the plugin), by kit id: installed files, folders, files switched off. */
  kits: Record<string, KitSlot>;
  /** Show a notice at startup when the plugin brings a newer kit. */
  notifyKitUpdate: boolean;
  debug: boolean;
  /** Vault folder of chemical notes (autocomplete in calc cells and forms; the kit's Chemical database files go next to it). Empty = no chemical database. */
  chemicalFolder: string;
  /** Vault folder of lab notes (New lab entry; the kit's Lab book base goes next to it). Empty = not set. */
  labFolder: string;
  /** Property of a chemical note that holds its molecular weight, tried before the built-in names. Empty = built-in names only. */
  mwProperty: string;
  /** Vault folder of analysis method notes (and, linked from them, machine notes), read by the Alt+S snippets. Empty = only the built-in NMR, GPC and DLS. */
  methodsFolder: string;
}

export const KIT_DEFAULTS: KitData = { installed: null, seenChangelog: "", initials: "", snippetIcons: {}, kits: {}, notifyKitUpdate: true, debug: false, chemicalFolder: "05 Chemicals/Chemicals", labFolder: "03 Lab Book/Notes", mwProperty: "", methodsFolder: "" };

/** The saved state of one kit, created (switched on, nothing installed) when there is none yet. */
export function kitSlot(kit: KitData, id: string): KitSlot {
  return kit.kits[id] ??= { enabled: true, managed: null, paths: {}, off: {} };
}

/**
 * The `kit` key of data.json as saved by any version, brought to the current shape. Up to v0.5.2 there was one kit, its state at the top
 * (`managed`, `paths`, `off`): it moves into `kits.lab` unchanged. Settings of the removed folder updater are dropped
 * ("don't check at startup" carries over to the kit update notice).
 */
export function kitLoad(saved: unknown): KitData {
  const old = { ...((saved ?? {}) as Record<string, unknown>) };
  // Saved by v0.5.2 or older: no folder default is put on a vault that already uses Lab Kit (Lab book base, New lab entry stay off until set)
  if (saved && typeof saved === "object" && old.labFolder === undefined) old.labFolder = "";
  if (old.checkOnStartup === false && old.notifyKitUpdate === undefined) old.notifyKitUpdate = false;
  const single = { managed: old.managed, paths: old.paths, off: old.off };
  for (const k of ["source", "checkOnStartup", "makeBackups", "managed", "paths", "off"]) delete old[k];
  const kit = Object.assign({}, KIT_DEFAULTS, old) as KitData;
  kit.snippetIcons = { ...kit.snippetIcons };
  kit.kits = Object.fromEntries(Object.entries(kit.kits ?? {}).filter(([, slot]) => slot && typeof slot === "object").map(([id, slot]) => [id, { enabled: slot.enabled !== false, managed: slot.managed ?? null, paths: { ...slot.paths }, off: { ...slot.off } }]));
  if (!kit.kits[LAB_KIT] && (single.managed || single.paths || single.off)) {
    kit.kits[LAB_KIT] = { enabled: true, managed: (single.managed as ManagedState | null) ?? null, paths: { ...(single.paths as Roles) }, off: { ...(single.off as Record<string, true>) } };
  }
  return kit;
}

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
 * added by a later kit version lands beside them; only a vault with no kit files yet gets the default layout (the folder contract in
 * docs/plans/planning-suite-kit.md, see LAB_LAYOUT): a `Lab Kit` subfolder of Templater's templates folder (else `Extras/Templates/Lab Kit`)
 * for the templates, a `lab-kit` subfolder of Templater's user scripts folder (else of `Extras/scripts/templater`) for the Templater scripts,
 * and `Extras/scripts/lab-kit` for the other scripts. A user scripts folder that is set is never changed (issue #34), so a hand copy of
 * labForm.js outside it is not followed. `record` (old folder updater) supplies scripts and backups.
 */
/** Folders that come from the Lab notebook settings: the lab notes and chemical notes folders (rewritten into the .base filters) and their parents (where the .base files go). */
export function kitFolderRoles(kit: Pick<KitData, "labFolder" | "chemicalFolder">): Roles {
  const lab = kitJoin(kit.labFolder.trim()), chem = kitJoin(kit.chemicalFolder.trim());
  return { labNotes: lab, labBase: kitParent(lab), chemicalNotes: chem, chemicalBase: kitParent(chem) };
}

/** Where the lab kit goes in a vault with no kit files yet (the folder contract). */
export const LAB_LAYOUT = { templates: "Extras/Templates", templatesSub: "Lab Kit", userScripts: "Extras/scripts/templater", userScriptsSub: "lab-kit", scripts: "Extras/scripts/lab-kit" };

export function kitDetectRoles(app: App, record: KitRecord | null, tracked: Partial<Roles>): Roles {
  const files = app.vault.getFiles().filter(f => !kitIsBackup(f.path));   // a backup copy of labForm.js must not look like the real one
  // Folders that sit inside a backup are mistakes (an earlier version copied one into Templater's settings): ignored
  const sane = (p?: string): string => (p && !kitInBackup(p) ? p : "");
  const raw = templaterSettings(app);
  const tpl = { user_scripts_folder: sane(raw.user_scripts_folder), templates_folder: sane(raw.templates_folder) };
  const remembered: Partial<Roles> = Object.fromEntries(Object.entries(record?.roles ?? {}).filter(([, v]) => sane(v)));
  const find = (name: string, test?: (f: (typeof files)[number]) => boolean) => files.find(f => f.name === name && (!test || test(f)));
  const scriptsFound = find("excel_to_calc.py");
  const scripts = tracked.scripts ?? remembered.scripts ?? (scriptsFound ? scriptsFound.parent!.path : LAB_LAYOUT.scripts);
  const menu = find("Insert snippet.md");
  const userFolder = kitJoin(tpl.user_scripts_folder.trim().replace(/\\/g, "/"));
  const formScript = find("labForm.js", f => !userFolder || f.path.startsWith(userFolder + "/"));
  return {
    cssSnippets: kitJoin(app.vault.configDir, "snippets"),
    scripts,
    userScripts: tracked.userScripts ?? (formScript ? formScript.parent!.path : kitJoin(userFolder || LAB_LAYOUT.userScripts, LAB_LAYOUT.userScriptsSub)),
    templates: tracked.templates ?? (menu ? menu.parent!.path : kitJoin(tpl.templates_folder || LAB_LAYOUT.templates, LAB_LAYOUT.templatesSub)),
    backups: remembered.backups ?? kitJoin(app.vault.configDir, "plugins", "lab-kit", "backups"),   // inside the plugin folder: out of the file tree
  };
}

/** Id of the Lab Book Template in kits/lab/kit-manifest.json. */
export const LAB_TEMPLATE_ID = "tpl-lab-book-template-md";

/** What New lab entry needs before it can run: the template and folder to use, or the reason it can't (shown as a notice). */
export function newLabEntryTarget(o: { templater: boolean; template: string | null; labFolder: string }): { template: string; folder: string } | { error: string } {
  if (!o.templater) return { error: "New lab entry needs the Templater plugin. Install and enable it, then try again." };
  const folder = kitJoin(o.labFolder.trim());
  if (!folder) return { error: "Set the Lab notes folder in Lab Kit settings first." };
  if (!o.template) return { error: "The Lab Book Template is not installed. Install it from Manage kit files." };
  return { template: o.template, folder };
}
