// Built-in kit: the kit files embedded in main.js, tracked by stable id, installed without ever overwriting your edits.
// Pure logic (no Node, works on mobile): the vault adapter and the roles are passed in; hashing is crypto.subtle.
//
//  - plan: one action per kit file (create / fast-forward / up-to-date / user-modified / needs-merge / missing / ...)
//  - apply: backs up every file it overwrites, writes, and remembers what it wrote (state + a base copy for later merges)
//  - "merge" (you and the kit both changed the file, edits don't overlap) is written only when the caller selects it
//  - "needs-merge" (the same lines changed on both sides) is only reported and left untouched until you settle it in the merge window (resolveManaged)
import type { DataAdapter } from "obsidian";
import { merge3 } from "./merge";
import type { Migration } from "./tidy";
import { kitEnsureDir, kitIsBackup, kitJoin, kitParent, type Roles } from "./paths";

/* ---- Types ---- */
export type ManagedKind = "template" | "snippet" | "script" | "note";
export interface EmbeddedFile {
  id: string; kind: ManagedKind; role: string; src: string; dest: string;
  version: string; sha256: string; renamedFrom: string[]; policy?: string;
  /** One line shown in Manage kit files. */
  desc?: string;
  /** Can be switched off (not installed, not in the Alt+S menu). Core files are never optional. */
  optional?: boolean;
  /** Kit setting (a key of the kit data, e.g. chemicalFolder) that must be set for this file to be installed: while it is empty the file counts as switched off. */
  needs?: string;
  /** An optional file that is off until its Use toggle is switched on (the kit slot's `on`). */
  defaultOff?: boolean;
}
/** One kit as built into main.js (see scripts/embed-kit.mjs): kits/<id>/kit-manifest.json and its files. */
export interface EmbeddedKit {
  manifest: { schema: number; id: string; kitVersion: string; files: EmbeddedFile[]; removed: string[]; rewrite?: Record<string, string>;
    /** First install: CSS snippets to switch on / off, and whether the kit needs Templater's user scripts folder. */
    enableCss?: string[]; disableCss?: string[]; templater?: { userScripts?: boolean };
    /** Note correction rules for Tidy up notes (src/kit/tidy.ts). */
    migrations?: Migration[] };
  contents: Record<string, string>;
}
/** Every kit built into main.js (manifest schema 2), sorted by id. */
export interface EmbeddedKits { schema: number; kits: EmbeddedKit[] }
export interface ManagedFileState {
  path: string; installedVersion: string; installedHash: string;
  detached: boolean; userDeleted: boolean; pendingConflict: unknown;
  /** The file holds a merge of your edits and the kit (cleared by any later write). */
  merged?: boolean;
  /** The kit text (its hash) the user chose to keep their own copy over: the update stays offered, but is no longer new. */
  keptKit?: string;
}
/** What the plugin remembers about built-in kit files (the `managed` key of the kit data). */
export interface ManagedState { installedKitVersion: string; files: Record<string, ManagedFileState> }
export type ManagedAdapter = Pick<DataAdapter, "exists" | "read" | "write" | "mkdir">;
export type ManagedAction = "create" | "fast-forward" | "up-to-date" | "user-modified" | "merge" | "needs-merge" | "missing" | "keep" | "detached" | "off";
export interface ManagedItem {
  file: EmbeddedFile;
  dest: string;
  /** What would be written: kit content with the folder rewrites applied. */
  text: string;
  kitHash: string;
  curHash: string | null;
  action: ManagedAction;
  /** No base copy to compare with (file wasn't installed by this system). */
  untracked: boolean;
  /** action "merge": your edits and the kit's combined (what would be written). */
  merged?: string;
  /** action "needs-merge": how many places both sides changed differently (absent when no merge was tried). */
  conflicts?: number;
  /** The kit renamed this file: where your copy is now. Applying the update writes it at `dest` and removes this one (backed up first). */
  movedFrom?: string;
}
/** Files the old folder updater wrote: path -> SHA-1 of what it wrote, and how to compute that hash. */
export interface LegacyRecord { files: Record<string, string>; hash: (text: string) => Promise<string> }
export interface ManagedResult { id: string; dest: string; action: ManagedAction; outcome: "created" | "updated" | "merged" | "adopted" | "skipped" | "moved"; backup?: string }

/** Actions on which a file the kit renamed is moved to its new name (the others leave it where it is). */
const MOVABLE: ManagedAction[] = ["up-to-date", "fast-forward", "merge"];
/** Actions the plugin may carry out on its own ("Update all safe files"). */
export const SAFE_ACTIONS: ManagedAction[] = ["create", "fast-forward", "up-to-date"];
export const emptyManagedState = (): ManagedState => ({ installedKitVersion: "0", files: {} });

/* ---- Hashing ---- */
/** Line endings to "\n", leading BOM removed: so Windows and Mac copies of the same file hash alike. */
export const kitNormalise = (text: string): string => text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
export async function kitSha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(kitNormalise(text)));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Files that count as switched off: the ones you switched off, plus optional files whose `needs` is not met:
 * a kit setting (e.g. `chemicalFolder`) that is empty or a switch (e.g. `inSilico`) that is off, or `plugin:<id>` for a plugin that is not
 * installed (`plugins`). A `defaultOff` file is off until its id is in `on`.
 */
export function offIds(bundle: EmbeddedKit, off: Record<string, true>, settings: object, plugins: ReadonlySet<string> = new Set(), on: Record<string, true> = {}): Set<string> {
  const out = new Set(Object.keys(off));
  const value = (key: string): unknown => (settings as Record<string, unknown>)[key];
  const met = (needs: string): boolean => needs.startsWith("plugin:") ? plugins.has(needs.slice("plugin:".length))
    : value(needs) === true || (typeof value(needs) === "string" && (value(needs) as string).trim() !== "");
  for (const f of bundle.manifest.files) if (f.optional && ((f.needs && !met(f.needs)) || (f.defaultOff && !on[f.id]))) out.add(f.id);
  return out;
}

/** SHA-1 hex of the exact text (no normalising): the hash the old folder updater recorded for files it wrote. */
export async function kitSha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

/** Kit content for this vault: the folder rewrites (e.g. Extras/scripts -> your scripts folder) applied, like the old folder updater did. */
export function kitText(bundle: EmbeddedKit, file: EmbeddedFile, roles: Roles): string {
  const text = bundle.contents[file.id] ?? "";
  const map = new Map<string, string>();
  for (const [literal, role] of Object.entries(bundle.manifest.rewrite ?? {})) {
    const to = roles[role];
    if (to && to !== literal) map.set(literal, to);
  }
  if (!map.size) return text;
  // One pass, longest literal first: a folder written in by one rewrite is never rewritten again by another (e.g. planning = "02 Projects/Plan")
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp([...map.keys()].sort((a, b) => b.length - a.length).map(esc).join("|"), "g");
  return text.replace(re, m => map.get(m) ?? m);
}

/** Folders where this system has already put files: each role's folder, read back from the tracked files' paths (a file you moved is skipped). */
export function trackedRoles(bundle: EmbeddedKit, state: ManagedState | null): Roles {
  const out: Roles = {};
  for (const file of bundle.manifest.files) {
    const path = state?.files[file.id]?.path;
    if (!path || kitIsBackup(path) || out[file.role] !== undefined) continue;
    if (path === file.dest) out[file.role] = "";
    else if (path.endsWith("/" + file.dest)) out[file.role] = path.slice(0, path.length - file.dest.length - 1);
  }
  return out;
}

/* ---- Plan ---- */
/** `baseDir` (where the base copies live) lets "changed by both" files be merged; without it they stay "needs-merge". */
export async function planManaged(adapter: ManagedAdapter, bundle: EmbeddedKit, state: ManagedState | null, roles: Roles, legacy: LegacyRecord | null = null, baseDir: string | null = null, off: ReadonlySet<string> = new Set()): Promise<ManagedItem[]> {
  const items: ManagedItem[] = [];
  for (const file of bundle.manifest.files) {
    // A path recorded inside a backup folder is a mistake (an old version picked the backup copy): treat the file as not installed yet, at its real place
    const rec = state?.files[file.id];
    const st = rec && kitIsBackup(rec.path) ? undefined : rec;
    let dest = st?.path || kitJoin(roles[file.role], file.dest);
    if (!st && !(await adapter.exists(dest))) {
      // Not installed by this system and the kit has moved the file: a copy at an old place is still this file
      for (const old of file.renamedFrom) {
        const oldDest = kitJoin(roles[file.role], old);
        if (await adapter.exists(oldDest)) { dest = oldDest; break; }
      }
    }
        // The kit renamed this file and your tracked copy still has the old name: the update moves it (only where the update can be applied by itself)
    let movedFrom: string | undefined;
    const target = kitJoin(roles[file.role], file.dest);
    if (st && file.policy !== "keep" && st.path !== target && file.renamedFrom.some(old => kitJoin(roles[file.role], old) === st.path)
      && await adapter.exists(st.path) && !(await adapter.exists(target))) { movedFrom = st.path; dest = target; }
    const readAt = movedFrom ?? dest;
    const text = kitText(bundle, file, roles);
    const kitHash = await kitSha256(text);
    const item = (action: ManagedAction, curHash: string | null, extra: Partial<ManagedItem> = {}): ManagedItem => {
      const moves = movedFrom !== undefined && MOVABLE.includes(action);
      return { file, dest: moves ? dest : readAt, text, kitHash, curHash, action, untracked: !st, ...(moves ? { movedFrom } : {}), ...extra };
    };
    if (st?.detached) { items.push(item("detached", null)); continue; }
    // Switched off by the user: nothing is installed or updated (only files marked optional can be off)
    if (file.optional && off.has(file.id)) { items.push(item("off", (await adapter.exists(readAt)) ? await kitSha256(await adapter.read(readAt)) : null)); continue; }
    if (!(await adapter.exists(readAt))) { items.push(item(st ? "missing" : "create", null)); continue; }

    const cur = await adapter.read(readAt);
    const curHash = await kitSha256(cur);
    if (curHash === kitHash) { items.push(item("up-to-date", curHash)); continue; }
    if (file.policy === "keep") { items.push(item("keep", curHash)); continue; }
    // Unmodified = still what this system wrote, or still what the old folder updater recorded for it
    const legacyMatch = legacy?.files[dest] !== undefined && legacy.files[dest] === await legacy.hash(cur);
    if (st?.installedHash === curHash || legacyMatch) items.push(item("fast-forward", curHash));
    else if (st && st.installedHash !== kitHash) {
      const baseFile = baseDir ? kitJoin(baseDir, `${file.id}.txt`) : null;
      if (baseFile && await adapter.exists(baseFile)) {
        const m = merge3(await adapter.read(baseFile), cur, text);
        items.push(m.clean ? item("merge", curHash, { merged: m.text }) : item("needs-merge", curHash, { conflicts: m.conflicts }));
      } else items.push(item("needs-merge", curHash));
    } else items.push(item("user-modified", curHash));
  }
  return items;
}

/* ---- Folder change ---- */
export interface FolderReapply {
  /** Files still exactly as the kit wrote them: safe to write again with the new folders (action "fast-forward"). */
  rewrite: ManagedItem[];
  /** Files you edited whose kit text would change with the new folders: left alone. */
  kept: ManagedItem[];
  /** Files written by another kit version whose text would change with the new folders: left alone (the kit never brings in newer text here), but named. */
  skipped: ManagedItem[];
}
/**
 * After a folder setting changed: which installed files need the new folder names written in. `items` is a fresh plan (kit text rendered with the new folders).
 * Only files of the installed kit version count, so this never brings in newer kit text; an edited file is reported, not touched.
 */
export async function planFolderReapply(adapter: Pick<DataAdapter, "exists" | "read">, items: ManagedItem[], state: ManagedState | null, baseDir: string | null): Promise<FolderReapply> {
  const out: FolderReapply = { rewrite: [], kept: [], skipped: [] };
  for (const it of items) {
    const st = state?.files[it.file.id];
    if (!st || st.detached) continue;
    if (it.curHash === null || it.curHash === it.kitHash || it.action === "off" || it.action === "detached" || it.action === "missing") continue;
    if (st.installedVersion !== it.file.version) { out.skipped.push(it); continue; }
    if (it.curHash === st.installedHash) { out.rewrite.push({ ...it, action: "fast-forward" }); continue; }
    const baseFile = baseDir ? kitJoin(baseDir, `${it.file.id}.txt`) : null;
    if (baseFile && await adapter.exists(baseFile) && kitNormalise(await adapter.read(baseFile)) !== kitNormalise(it.text)) out.kept.push(it);
  }
  return out;
}

const IN_FOLDER = /file\.inFolder\("([^"]*)"\)/g;
/** The folders a .base filters on, in file order. */
export const inFolders = (text: string): string[] => [...text.matchAll(IN_FOLDER)].map(m => m[1]);
/**
 * A .base you edited, or one Obsidian re-saved with its keys in another order, still filters on the old folder after a folder change.
 * Returns `current` with only the `file.inFolder("…")` folders replaced by those of `kitNew` (matched by position); everything else stays byte for byte.
 * null when there is nothing to change or the filters do not line up (different count): then it is only reported.
 */
export function patchFolders(current: string, kitNew: string): string | null {
  const want = inFolders(kitNew);
  let i = 0, changed = false, count = 0;
  const out = current.replace(IN_FOLDER, (whole, folder: string) => {
    const to = want[i++];
    count++;
    if (to === undefined || to === folder) return whole;
    changed = true;
    return `file.inFolder("${to}")`;
  });
  return changed && count === want.length ? out : null;
}

/** Writes `patched` text over each item's file after a backup. Leaves the recorded hash and base copy alone: the file stays "yours" for later updates. */
export async function patchManagedFolders(adapter: ManagedAdapter, patches: { item: ManagedItem; text: string }[], opts: ApplyOptions): Promise<string[]> {
  const backups: string[] = [];
  for (const { item, text } of patches) {
    backups.push(await backupFile(adapter, item, opts));
    await adapter.write(item.dest, text);
  }
  return backups;
}

/* ---- Preview (the confirmation dialog) ---- */
/** What carrying out `items` (those `select` picks) would touch: files written new, files left alone because they already exist, folders created. */
/** What a file of each role is, when its manifest entry has no `desc`. */
const ROLE_ABOUT: Record<string, string> = {
  templates: "Template.", userScripts: "Script the templates and forms use (Templater loads it).", scripts: "Script.", cssSnippets: "CSS snippet (look of the notes).",
  home: "Homepage.", planning: "Planning note.", projects: "Projects note.", literature: "Literature note.", knowledge: "Knowledge note.", howtos: "How-to note.", meetings: "Meetings note.",
  labBase: "Board of your experiments.", chemicalBase: "Table of your chemicals.",
};
export interface InstallPreview {
  create: string[]; update: string[]; leftAlone: string[]; folders: string[];
  /** What each listed file or folder is for (path → one line). */
  about: Record<string, string>;
}
/** `extraFolders`: folders the kit makes empty so its layout is complete; listed (with what they are for) when they don't exist yet. */
export async function previewInstall(adapter: Pick<DataAdapter, "exists">, items: ManagedItem[], select: (it: ManagedItem) => boolean = it => SAFE_ACTIONS.includes(it.action),
  extraFolders: { path: string; desc: string }[] = []): Promise<InstallPreview> {
  const out: InstallPreview = { create: [], update: [], leftAlone: [], folders: [], about: {} };
  const folders = new Set<string>();
  for (const it of items) {
    out.about[it.dest] = it.file.desc ? `${it.file.desc}.`.replace(/\.\.$/, ".") : ROLE_ABOUT[it.file.role] ?? "Kit file.";
    if (it.movedFrom) out.about[it.dest] += ` Renamed from ${it.movedFrom} (old copy backed up).`;
  }
  for (const f of extraFolders) {
    if (folders.has(f.path) || await adapter.exists(f.path)) continue;
    folders.add(f.path);
    out.about[f.path] = f.desc;
    // missing folders above it are made too: list them
    for (let dir = kitParent(f.path); dir && !folders.has(dir); dir = kitParent(dir)) {
      if (await adapter.exists(dir)) break;
      folders.add(dir);
      out.about[dir] ??= "Holds the folders below it.";
    }
  }
  for (const it of items) {
    const writes = select(it) && it.action !== "up-to-date";
    if (writes && (it.action === "create" || it.action === "missing")) out.create.push(it.dest);
    else if (writes) out.update.push(it.dest);
    else if (it.untracked && it.curHash !== null) { out.leftAlone.push(it.dest); continue; }   // there before the kit: never written
    if (!writes) continue;
    // every folder above the file that isn't there yet
    for (let dir = kitParent(it.dest); dir && !folders.has(dir); dir = kitParent(dir)) {
      if (await adapter.exists(dir)) break;
      folders.add(dir);
      out.about[dir] ??= "Holds kit files.";
    }
  }
  out.folders = [...folders].sort();
  return out;
}

/* ---- Apply ---- */
export interface ApplyOptions {
  /** Where the base copies go: <configDir>/plugins/<plugin id>/kit-base */
  baseDir: string;
  /** The Backups folder. Every overwritten file is copied to <backups>/<timestamp>/<its path> first. */
  backups: string;
  /** ISO timestamp (":" replaced, so it is a valid folder name on every OS). */
  stamp: string;
  /** Which items to carry out. Default: the safe ones. */
  select?: (item: ManagedItem) => boolean;
  /** Leave `installedKitVersion` as it was (a single-file action doesn't mean the whole kit is installed). */
  keepVersion?: boolean;
  /** Deletes a file (the plugin moves it to the trash). Needed to rename a file the kit renamed; without it such a file is skipped. */
  remove?: (path: string) => Promise<void>;
  debug?: boolean;
}
export interface ApplyOutcome { state: ManagedState; results: ManagedResult[] }

const folderStamp = (iso: string): string => iso.replace(/[:.]/g, "-");

/** Records what was written (state + base copy for later merges). Mutates `next`. */
async function rememberFile(adapter: ManagedAdapter, next: ManagedState, it: ManagedItem, opts: ApplyOptions, merged = false): Promise<void> {
  const prev = next.files[it.file.id];
  next.files[it.file.id] = { path: it.dest, installedVersion: it.file.version, installedHash: it.kitHash,
    detached: prev?.detached ?? false, userDeleted: false, pendingConflict: null, ...(merged ? { merged } : {}) };
  await kitEnsureDir(adapter, opts.baseDir);
  await adapter.write(kitJoin(opts.baseDir, `${it.file.id}.txt`), it.text);
}

/** Where a write with these options backs up the file at `dest`: <backups>/<timestamp>/<its path>. */
export const kitBackupPath = (opts: Pick<ApplyOptions, "backups" | "stamp">, dest: string): string => kitJoin(opts.backups, folderStamp(opts.stamp), dest);

/** Copies the current file (at its old name, when the kit renamed it) to <backups>/<timestamp>/<its path> and returns that path. */
async function backupFile(adapter: ManagedAdapter, it: ManagedItem, opts: ApplyOptions): Promise<string> {
  const from = it.movedFrom ?? it.dest;
  const backup = kitBackupPath(opts, from);
  await kitEnsureDir(adapter, kitParent(backup));
  await adapter.write(backup, await adapter.read(from));
  return backup;
}

export async function applyManaged(adapter: ManagedAdapter, bundle: EmbeddedKit, items: ManagedItem[], state: ManagedState | null, opts: ApplyOptions): Promise<ApplyOutcome> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const select = opts.select ?? (it => SAFE_ACTIONS.includes(it.action));
  const results: ManagedResult[] = [];
  const log = (...a: unknown[]): void => { if (opts.debug) console.debug("Lab Kit:", ...a); };
  for (const it of items) {
    const { id } = it.file;
    // A kept file with no record (made before the kit tracked it): its file is left alone, the kit's current text becomes its baseline, so only later kit changes show as an update
    if (it.action === "keep" && it.untracked) { await rememberFile(adapter, next, it, opts); results.push({ id, dest: it.dest, action: it.action, outcome: "adopted" }); log("adopt", it.dest); continue; }
    if (!select(it)) { results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" }); log("skip", it.action, it.dest); continue; }
    if (it.movedFrom !== undefined) {
      if (!opts.remove) { results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" }); continue; }
      const backup = await backupFile(adapter, it, opts);
      await kitEnsureDir(adapter, kitParent(it.dest));
      await adapter.write(it.dest, it.action === "merge" && it.merged !== undefined ? it.merged : it.text);
      await opts.remove(it.movedFrom);
      await rememberFile(adapter, next, it, opts, it.action === "merge");
      results.push({ id, dest: it.dest, action: it.action, outcome: "moved", backup });
      log("move", it.movedFrom, "to", it.dest, "backup", backup);
      continue;
    }
    if (it.action === "up-to-date") { await rememberFile(adapter, next, it, opts); results.push({ id, dest: it.dest, action: it.action, outcome: "adopted" }); continue; }
    if (it.action === "create" || it.action === "missing") {
      await kitEnsureDir(adapter, kitParent(it.dest));
      await adapter.write(it.dest, it.text);
      await rememberFile(adapter, next, it, opts);
      results.push({ id, dest: it.dest, action: it.action, outcome: "created" });
      log("create", it.dest);
    } else if (it.action === "fast-forward") {
      const backup = await backupFile(adapter, it, opts);
      await adapter.write(it.dest, it.text);
      await rememberFile(adapter, next, it, opts);
      results.push({ id, dest: it.dest, action: it.action, outcome: "updated", backup });
      log("fast-forward", it.dest, "backup", backup);
    } else if (it.action === "merge" && it.merged !== undefined) {
      const backup = await backupFile(adapter, it, opts);
      await adapter.write(it.dest, it.merged);
      await rememberFile(adapter, next, it, opts, true);   // base = the kit's text, so the next merge starts from this kit version
      results.push({ id, dest: it.dest, action: it.action, outcome: "merged", backup });
      log("merge", it.dest, "backup", backup);
    } else {
      // user-modified / needs-merge / keep / detached are never written by apply, even if a caller selects them
      results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" });
    }
  }
  if (!opts.keepVersion) next.installedKitVersion = bundle.manifest.kitVersion;
  return { state: next, results };
}

/** Actions "Restore kit original" may overwrite (the old copy is backed up first). Never a detached or kept file. */
export const RESTORABLE_ACTIONS: ManagedAction[] = ["user-modified", "merge", "needs-merge", "fast-forward", "missing"];

/** A file you are meant to edit (policy keep) whose kit text changed since it was installed: the kit never updates it, but you can choose to replace it. */
export const kitHasNewer = (item: ManagedItem, st?: ManagedFileState): boolean => item.action === "keep" && !!st && st.installedHash !== item.kitHash;
/** A newer kit version the user has already looked at and chose to keep their own copy over (it is still offered, quietly). */
export const kitKept = (item: ManagedItem, st?: ManagedFileState): boolean => kitHasNewer(item, st) && st?.keptKit === item.kitHash;

/** The files whose kit text changed since your copy was made and which you keep as your own (kept already or not yet decided). */
export const newerKitItems = (items: ManagedItem[], stateOf: (id: string) => ManagedFileState | undefined): ManagedItem[] => items.filter(i => kitHasNewer(i, stateOf(i.file.id)));

/** Puts the kit's version of ONE file back, backing up your copy first. Refuses detached / up-to-date files, and kept files unless the kit has a newer version of them. */
export async function restoreManaged(adapter: ManagedAdapter, item: ManagedItem, state: ManagedState | null, opts: ApplyOptions): Promise<{ state: ManagedState; result: ManagedResult }> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const { id } = item.file;
  if (!RESTORABLE_ACTIONS.includes(item.action) && !kitHasNewer(item, state?.files[id])) return { state: next, result: { id, dest: item.dest, action: item.action, outcome: "skipped" } };
  let backup: string | undefined;
  if (item.action !== "missing") backup = await backupFile(adapter, item, opts);
  else await kitEnsureDir(adapter, kitParent(item.dest));
  await adapter.write(item.dest, item.text);
  await rememberFile(adapter, next, item, opts);
  return { state: next, result: { id, dest: item.dest, action: item.action, outcome: backup ? "updated" : "created", backup } };
}

/**
 * Settles ONE conflict (`needs-merge`), or compares / keeps a kept file the kit has a newer version of, with the text the merge window resolved to.
 * `text` null, or equal to your current file, keeps your file as it is ("Keep all mine"): for a conflict it is recorded as based on the new kit version, for a kept file the newer kit version stays on offer.
 * Anything else is written after a backup. Either way the base copy becomes the kit's text, so the next merge starts from this kit version.
 */
export async function resolveManaged(adapter: ManagedAdapter, item: ManagedItem, text: string | null, state: ManagedState | null, opts: ApplyOptions): Promise<{ state: ManagedState; result: ManagedResult }> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const { id } = item.file;
  if (item.action !== "needs-merge" && !kitHasNewer(item, state?.files[id])) return { state: next, result: { id, dest: item.dest, action: item.action, outcome: "skipped" } };
  // Keep on a kept file, from the row or "Keep all mine" in the Compare window (the text is then your own file's): nothing is written, the update stays offered
  if (item.action === "keep" && (text === null || kitNormalise(text) === kitNormalise(await adapter.read(item.dest)))) {
    next.files[id] = { ...(state?.files[id] as ManagedFileState), keptKit: item.kitHash };
    return { state: next, result: { id, dest: item.dest, action: item.action, outcome: "adopted" } };
  }
  let backup: string | undefined;
  let written = false;
  if (text !== null && kitNormalise(text) !== kitNormalise(await adapter.read(item.dest))) {
    backup = await backupFile(adapter, item, opts);
    await adapter.write(item.dest, text);
    written = true;
  }
  await rememberFile(adapter, next, item, opts, written);
  return { state: next, result: { id, dest: item.dest, action: item.action, outcome: written ? "merged" : "adopted", backup } };
}

/**
 * Switches ONE optional file off: your copy (if it is installed) is backed up, then removed, and the kit forgets it.
 * `remove` does the deleting (the plugin moves it to the trash; tests use the adapter). Returns where the backup went.
 */
export async function disableManaged(adapter: ManagedAdapter & Partial<Pick<DataAdapter, "remove">>, item: ManagedItem, state: ManagedState | null, opts: ApplyOptions, remove: (path: string) => Promise<void>): Promise<{ state: ManagedState; backup?: string }> {
  let backup: string | undefined;
  if (await adapter.exists(item.dest)) {
    backup = await backupFile(adapter, item, opts);
    await remove(item.dest);
  }
  return { state: await forgetManaged(adapter, state, item.file.id, opts.baseDir), backup };
}

/** A kit file the kit has dropped (`removed` in the manifest) that you still have installed. Left where it is, never deleted. */
export interface RetiredItem { id: string; path: string; exists: boolean }

/** Files this system installed that the kit no longer ships. */
export async function planRetired(adapter: ManagedAdapter, bundle: EmbeddedKit, state: ManagedState | null): Promise<RetiredItem[]> {
  const out: RetiredItem[] = [];
  for (const id of bundle.manifest.removed) {
    const st = state?.files[id];
    if (st) out.push({ id, path: st.path, exists: await adapter.exists(st.path) });
  }
  return out;
}

/** Stops tracking a retired file (state entry and base copy). Your file in the vault is not touched. */
export async function forgetManaged(adapter: ManagedAdapter & Partial<Pick<DataAdapter, "remove">>, state: ManagedState | null, id: string, baseDir: string): Promise<ManagedState> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  delete next.files[id];
  const base = kitJoin(baseDir, `${id}.txt`);
  if (adapter.remove && await adapter.exists(base)) await adapter.remove(base);
  return next;
}

/** Stops (or resumes) managing one file. Returns false when the file isn't tracked yet (nothing to detach). */
export function setDetached(state: ManagedState | null, id: string, detached: boolean): boolean {
  const st = state?.files[id];
  if (!st) return false;
  st.detached = detached;
  return true;
}

/** Plain-words status for a plan item (the labels in the Manage kit files window). */
export function statusOf(item: ManagedItem, st?: ManagedFileState): { label: string; tone: "ok" | "info" | "warn" | "muted" } {
  switch (item.action) {
    case "up-to-date": return { label: "Up to date", tone: "ok" };
    case "fast-forward": return { label: "Update available", tone: "info" };
    case "create": return { label: "New", tone: "info" };
    case "user-modified": return st?.merged ? { label: "Merged", tone: "info" } : { label: "Changed by you", tone: "warn" };
    case "merge": return { label: "Merges cleanly", tone: "info" };
    case "needs-merge": return { label: "Conflict", tone: "warn" };
    case "missing": return { label: "Missing", tone: "warn" };
    case "keep": return kitKept(item, st) ? { label: "Newer kit version available (you kept yours)", tone: "muted" } : kitHasNewer(item, st) ? { label: "Newer kit version available", tone: "info" } : st ? { label: "Up to date with the kit", tone: "ok" } : { label: "Kept (your settings)", tone: "muted" };
    case "detached": return { label: "Detached", tone: "muted" };
    case "off": return { label: "Off", tone: "muted" };
  }
}

/** What Apply does with a file, as a symbol + word + colour tone (red = problem, orange = changed, green = added; colour is never the only signal). */
export type ActionTone = "add" | "change" | "conflict" | "leave" | "same";
export function actionLook(action: ManagedAction): { symbol: string; word: string; tone: ActionTone } {
  switch (action) {
    case "create": return { symbol: "+", word: "Add", tone: "add" };
    case "missing": return { symbol: "+", word: "Recreate (if ticked)", tone: "add" };
    case "fast-forward": return { symbol: "↑", word: "Update", tone: "change" };
    case "merge": return { symbol: "⇄", word: "Merge (if ticked)", tone: "change" };
    case "needs-merge": return { symbol: "!", word: "Conflict: left as is", tone: "conflict" };
    case "user-modified": return { symbol: "•", word: "Leave (yours)", tone: "leave" };
    case "keep": return { symbol: "•", word: "Leave (your settings)", tone: "leave" };
    case "detached": return { symbol: "–", word: "Leave (detached)", tone: "leave" };
    case "off": return { symbol: "–", word: "Skip (off)", tone: "leave" };
    case "up-to-date": return { symbol: "=", word: "Same", tone: "same" };
  }
}

/** How soon a file needs the user's attention: 0 = most urgent. A merged file (changed by you, then merged) needs nothing, like "Up to date". */
export function attentionRank(item: ManagedItem, st?: ManagedFileState): number {
  switch (item.action) {
    case "needs-merge": return 0;
    case "merge": return 1;
    case "missing": return 2;
    case "fast-forward": return 3;
    case "create": return 4;
    case "user-modified": return st?.merged ? 6 : 5;
    case "up-to-date": return 6;
    case "keep": return kitKept(item, st) ? 6.5 : kitHasNewer(item, st) ? 3.5 : 7;   // a new update: right after "Update available"; one you kept: after the up-to-date files
    case "detached": return 8;
    case "off": return 9;
  }
}

/** Files that need action first (conflicts, merges, missing, updates, new files, changed by you), then the rest; each kind in path order. */
export function sortByAttention(items: ManagedItem[], stateOf: (id: string) => ManagedFileState | undefined = () => undefined): ManagedItem[] {
  return [...items].sort((a, b) =>
    attentionRank(a, stateOf(a.file.id)) - attentionRank(b, stateOf(b.file.id)) || a.dest.localeCompare(b.dest, undefined, { numeric: true }));
}

/** Follows files the user moves or renames inside Obsidian. Returns true if anything changed. */
export function followRename(state: ManagedState | null, oldPath: string, newPath: string): boolean {
  if (!state) return false;
  let changed = false;
  for (const st of Object.values(state.files)) {
    if (st.path === oldPath || st.path.startsWith(oldPath + "/")) { st.path = newPath + st.path.slice(oldPath.length); changed = true; }
  }
  return changed;
}

/** True when Templater's user scripts folder must change for it to find the kit's scripts: it is empty, or is neither the kit's script folder nor a folder above it (Templater reads subfolders). */
export function templaterScriptsNeedChange(current: string | undefined, kitScripts: string): boolean {
  const norm = (p: string): string => p.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const cur = norm(current ?? ""), kit = norm(kitScripts);
  return !cur || !(kit === cur || kit.startsWith(cur + "/"));
}

/** The folder to give Templater as its template folder when it has none: the kit's own "Lab Kit" folder is a subfolder of it, so other templates stay listed. null when there is no sensible folder (the vault root). */
export function templaterTemplatesTarget(kitTemplates: string): string | null {
  const parts = kitTemplates.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length > 1 && parts[parts.length - 1] === "Lab Kit") parts.pop();
  return parts.length ? parts.join("/") : null;
}

/** The folder to give Templater as its user scripts folder when it has none: the folder above the kit's `lab-kit` folder, so the user's own scripts beside it load too. */
export function templaterScriptsTarget(kitUserScripts: string): string {
  const kit = kitJoin(kitUserScripts.trim().replace(/\\/g, "/"));
  // the folder above a kit's own subfolder (lab-kit/, vault/), so Templater finds both kits' scripts; one at the vault root stays itself (no parent to give)
  return /\/(lab-kit|vault)$/.test(kit) ? kitParent(kit) : kit;
}

/**
 * What "Set up Templater" does about the user scripts folder. A folder that is set is never changed (issue #34):
 * `set` when Templater has none, `ok` when it already finds the kit's scripts, else `relocate` (install copies into `<folder>/lab-kit`).
 */
export type TemplaterScriptsAction = { kind: "ok" } | { kind: "set"; folder: string } | { kind: "relocate"; to: string };
export function templaterScriptsAction(current: string | undefined, kitUserScripts: string): TemplaterScriptsAction {
  const cur = kitJoin((current ?? "").trim().replace(/\\/g, "/"));
  if (!cur) return { kind: "set", folder: templaterScriptsTarget(kitUserScripts) };
  if (!templaterScriptsNeedChange(cur, kitUserScripts)) return { kind: "ok" };
  return { kind: "relocate", to: kitJoin(cur, "lab-kit") };
}

/** Forgets the installed files of one role, so the next plan creates them afresh in the role's (new) folder. The old copies stay in the vault; their paths are returned. */
export function relocateRole(bundle: EmbeddedKit, state: ManagedState | null, role: string): { state: ManagedState | null; old: string[] } {
  if (!state) return { state, old: [] };
  const files = { ...state.files }, old: string[] = [];
  for (const f of bundle.manifest.files) {
    if (f.role !== role || !files[f.id]) continue;
    if (!kitIsBackup(files[f.id].path)) old.push(files[f.id].path);
    delete files[f.id];
  }
  return { state: { ...state, files }, old };
}

/** What the first-install dialog offers: CSS snippets to switch on, and Templater's user scripts folder (only when Templater has none). */
export interface FirstInstallOptions { css: { enable: string[]; disable: string[] } | null; templaterFolder: string | null }
export function firstInstallOptions(bundle: EmbeddedKit, templater: { installed: boolean; folder?: string }, userScripts: string): FirstInstallOptions {
  const m = bundle.manifest;
  return {
    css: m.enableCss?.length ? { enable: m.enableCss, disable: m.disableCss ?? [] } : null,
    templaterFolder: m.templater?.userScripts && templater.installed && !templater.folder?.trim() ? templaterScriptsTarget(userScripts) : null,
  };
}
