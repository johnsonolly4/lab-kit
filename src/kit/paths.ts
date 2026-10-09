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
  /** A form field that asks for a Chemical class lists only chemicals of that class (true), or lists them first and then all the others (false). */
  chemClassOnly: boolean;
  /** Board countdown to a to-do's due date: off, only to-dos with `countdown: true`, or every to-do with a due date. */
  dueCountdown: "off" | "marked" | "all";
  /** Write `progress: 3/7` (ticked / all check boxes) into lab notes and the Shopping list, for the kanban cards. Off by default. */
  checklistProgress: boolean;
  /** Vault folder of lab notes (New lab entry; the kit's Lab book base goes next to it). Empty = not set. */
  labFolder: string;
  /** Property of a chemical note that holds its molecular weight, tried before the built-in names. Empty = built-in names only. */
  mwProperty: string;
  /** Vault folder of analysis method notes (and, linked from them, machine notes), read by the Alt+S snippets. Empty = only the built-in NMR, GPC and DLS. */
  methodsFolder: string;
  /** Planning kit note folders (Settings → Planning folders). Never empty: an empty box means the default. */
  planningFolders: PlanningFolders;
}

/** The planning kit's note folders, one per role (the folder contract in docs/plans/planning-suite-kit.md). */
export interface PlanningFolders { inbox: string; daily: string; planning: string; projects: string; literature: string; knowledge: string; howtos: string; meetings: string; archive: string }
export const PLANNING_FOLDER_DEFAULTS: PlanningFolders = {
  inbox: "00 Inbox", daily: "01 Daily Notes", planning: "00 Planning", projects: "02 Projects", literature: "04 Literature",
  knowledge: "06 Knowledge", howtos: "07 How-tos", meetings: "08 Meetings", archive: "99 Archive",
};
export type PlanningRole = keyof PlanningFolders;

/** Saved planning folders over the defaults: unknown keys dropped, an empty or missing one is the default. */
export function planningFoldersLoad(saved: unknown): PlanningFolders {
  const raw = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const out = { ...PLANNING_FOLDER_DEFAULTS };
  for (const k of Object.keys(out) as PlanningRole[]) {
    const v = typeof raw[k] === "string" ? kitJoin(raw[k].trim().replace(/\\/g, "/")) : "";
    if (v) out[k] = v;
  }
  return out;
}

/** Where the to-dos live (a fixed subfolder of the Planning folder; the board, engine and New to-do use it). */
export const todoFolder = (f: PlanningFolders): string => kitJoin(f.planning, "To-dos");
/** Where Archive old to-dos and Sort inbox → Archive move notes (made when first needed). */
export const archiveTodoFolder = (f: PlanningFolders): string => kitJoin(f.archive, "To-dos");
export const archiveInboxFolder = (f: PlanningFolders): string => kitJoin(f.archive, "Inbox");

/**
 * Planning folders that should exist but don't (e.g. moved outside Obsidian, so no rename event let the setting follow).
 * The archive is left out (it is made when first needed) and so is Literature without ZotLit (never made).
 */
export function missingPlanningFolders(f: PlanningFolders, exists: (path: string) => boolean, zotlit: boolean): PlanningRole[] {
  const roles: PlanningRole[] = ["inbox", "daily", "planning", "projects", "literature", "knowledge", "howtos", "meetings"];
  return roles.filter(r => (r !== "literature" || zotlit) && !exists(f[r]));
}

/** A planning folder setting after a folder was renamed inside Obsidian: the new path when it is (or is under) `oldPath`, else null. */
export function followFolderRename(folder: string, oldPath: string, newPath: string): string | null {
  if (folder === oldPath) return newPath;
  if (folder.startsWith(oldPath + "/")) return newPath + folder.slice(oldPath.length);
  return null;
}

export const KIT_DEFAULTS: KitData = { installed: null, seenChangelog: "", initials: "", snippetIcons: {}, kits: {}, notifyKitUpdate: true, debug: false, chemicalFolder: "05 Chemicals/Chemicals", chemClassOnly: false, dueCountdown: "off", checklistProgress: false, labFolder: "03 Lab Book/Notes", mwProperty: "", methodsFolder: "", planningFolders: { ...PLANNING_FOLDER_DEFAULTS } };

/** The saved state of one kit, created (nothing installed) when there is none yet: the lab kit starts switched on, any other kit off. */
export function kitSlot(kit: KitData, id: string): KitSlot {
  return kit.kits[id] ??= { enabled: id === LAB_KIT, managed: null, paths: {}, off: {} };
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
  // Saved before Phase 5a: a planning note folder set as a per-kit override (Review window) becomes the setting
  const overrides = old.planningFolders === undefined ? (kit.kits[PLANNING_KIT]?.paths ?? {}) : {};
  kit.planningFolders = planningFoldersLoad({ ...overrides, ...(old.planningFolders as object | undefined) });
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

/** Id of the planning kit (kits/planning/kit-manifest.json). */
export const PLANNING_KIT = "planning";
/** Where the planning kit's templates and script go (the folder contract): templates in Extras/Templates, vtAsk.js in a `vault` subfolder of the user scripts folder. Note folders: `PlanningFolders`. */
export const PLANNING_LAYOUT = { templates: "Extras/Templates", userScripts: "Extras/scripts/templater", userScriptsSub: "vault" };

/**
 * Where each part of the planning kit lives in this vault. `tracked`: folders where the kit already put files (they win for templates,
 * scripts and the homepage). Note folders always come from the Planning folders settings (`folders`), and `labNotes` from the Lab notes
 * folder (planning notes list experiments). Templates follow Templater's template folder (else Extras/Templates), the script goes into
 * `<Templater's user scripts folder>/vault` (a set folder is never changed, issue #34; else Extras/scripts/templater/vault).
 */
export function planningRoles(app: App, tracked: Partial<Roles>, folders: PlanningFolders, labFolder = ""): Roles {
  const sane = (p?: string): string => (p && !kitInBackup(p) ? kitJoin(p.trim().replace(/\\/g, "/")) : "");
  const raw = templaterSettings(app);
  const defined = Object.fromEntries(Object.entries(tracked).filter(([, v]) => v !== undefined)) as Roles;
  const lab = kitJoin(labFolder.trim());
  return {
    home: "",
    cssSnippets: kitJoin(app.vault.configDir, "snippets"),
    templates: sane(raw.templates_folder) || PLANNING_LAYOUT.templates,
    userScripts: kitJoin(sane(raw.user_scripts_folder) || PLANNING_LAYOUT.userScripts, PLANNING_LAYOUT.userScriptsSub),
    backups: kitJoin(app.vault.configDir, "plugins", "lab-kit", "backups"),
    ...defined,
    ...folders,
    ...(lab ? { labNotes: lab } : {}),
  };
}

/** A folder a kit makes empty at install so the layout is complete, with what it is for (shown in the confirmation). */
export interface KitFolder { path: string; desc: string }

/** The planning kit's folder-contract folders (docs/plans/planning-suite-kit.md), through its roles so a moved role is followed. Never 99 Archive (yours). */
export function planningFolders(roles: Roles, zotlit: boolean): KitFolder[] {
  const list: KitFolder[] = [
    { path: roles.inbox, desc: "Quick captures wait here until you sort them." },
    { path: roles.daily, desc: "Daily notes (Templater fills them from the Daily note template)." },
    { path: kitJoin(roles.planning, "To-dos"), desc: "One note per to-do; the to-do board shows them." },
    { path: roles.projects, desc: "One folder per project, with its hub note." },
    ...(zotlit ? [{ path: roles.literature, desc: "Literature notes from ZotLit." }] : []),
    { path: roles.knowledge, desc: "Concept notes, one folder per topic." },
    { path: roles.howtos, desc: "How-to notes, one folder per topic." },
    { path: roles.meetings, desc: "Meeting series and their notes." },
    { path: "Extras/attachments", desc: "Pasted images and files." },
  ];
  return list.filter(f => f.path);
}

/** The lab kit's note folders from the Lab notebook settings (empty = not set, not made). */
export function labFolders(kit: Pick<KitData, "labFolder" | "chemicalFolder">): KitFolder[] {
  return [
    { path: kit.labFolder, desc: "Your experiment notes (New lab entry puts them here)." },
    { path: kit.chemicalFolder, desc: "Your chemical notes (suggested in calc cells and forms)." },
  ].filter(f => f.path);
}

/** Id of the Lab Book Template in kits/lab/kit-manifest.json. */
export const LAB_TEMPLATE_ID = "tpl-lab-book-template-md";
export const CHEMICAL_TEMPLATE_ID = "tpl-chemical-database-template-md";

/** What New lab entry needs before it can run: the template and folder to use, or the reason it can't (shown as a notice). */
export function newLabEntryTarget(o: { templater: boolean; template: string | null; labFolder: string; initials?: string }): { template: string; folder: string } | { error: string } {
  if (!o.templater) return { error: "New lab entry needs the Templater plugin. Install and enable it, then try again." };
  if (o.initials !== undefined && !o.initials.trim()) return { error: "Set your initials in Lab Kit settings first: lab notes are named ABC0001 - Title." };
  const folder = kitJoin(o.labFolder.trim());
  if (!folder) return { error: "Set the Lab notes folder in Lab Kit settings first." };
  if (!o.template) return { error: "The Lab Book Template is not installed. Install it from Manage kit files." };
  return { template: o.template, folder };
}

/** What New chemical needs before it can run: the template and folder to use, or the reason it can't (shown as a notice). */
export function newChemicalTarget(o: { templater: boolean; template: string | null; chemicalFolder: string }): { template: string; folder: string } | { error: string } {
  if (!o.templater) return { error: "New chemical needs the Templater plugin. Install and enable it, then try again." };
  const folder = kitJoin(o.chemicalFolder.trim());
  if (!folder) return { error: "Set the Chemical folder in Lab Kit settings first." };
  if (!o.template) return { error: "The Chemical database template is not installed. Install it from Manage kit files." };
  return { template: o.template, folder };
}
