// Built-in kit: the kit files embedded in main.js, tracked by stable id, installed without ever overwriting your edits.
// Pure logic (no Node, works on mobile): the vault adapter and the roles are passed in; hashing is crypto.subtle.
//
//  - plan: one action per kit file (create / fast-forward / up-to-date / user-modified / needs-merge / missing / ...)
//  - apply: backs up every file it overwrites, writes, and remembers what it wrote (state + a base copy for later merges)
//  - "merge" (you and the kit both changed the file, edits don't overlap) is written only when the caller selects it
//  - "needs-merge" (the same lines changed on both sides) is only reported and left untouched until you settle it in the merge window (resolveManaged)
import type { DataAdapter } from "obsidian";
import { merge3 } from "./merge";
import { kitEnsureDir, kitIsBackup, kitJoin, kitParent, type Roles } from "./paths";

/* ---- Types ---- */
export type ManagedKind = "template" | "snippet" | "script";
export interface EmbeddedFile {
  id: string; kind: ManagedKind; role: string; src: string; dest: string;
  version: string; sha256: string; renamedFrom: string[]; policy?: string;
  /** One line shown in Manage kit files. */
  desc?: string;
  /** Can be switched off (not installed, not in the Alt+S menu). Core files are never optional. */
  optional?: boolean;
}
/** The kit as built into main.js (see scripts/embed-kit.mjs). */
export interface EmbeddedKit {
  manifest: { schema: number; kitVersion: string; files: EmbeddedFile[]; removed: string[]; rewrite?: Record<string, string>;
    /** First install: CSS snippets to switch on / off, and whether the kit needs Templater's user scripts folder. */
    enableCss?: string[]; disableCss?: string[]; templater?: { userScripts?: boolean } };
  contents: Record<string, string>;
}
export interface ManagedFileState {
  path: string; installedVersion: string; installedHash: string;
  detached: boolean; userDeleted: boolean; pendingConflict: unknown;
  /** The file holds a merge of your edits and the kit (cleared by any later write). */
  merged?: boolean;
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
}
/** Files the old folder updater wrote: path -> SHA-1 of what it wrote, and how to compute that hash. */
export interface LegacyRecord { files: Record<string, string>; hash: (text: string) => Promise<string> }
export interface ManagedResult { id: string; dest: string; action: ManagedAction; outcome: "created" | "updated" | "merged" | "adopted" | "skipped"; backup?: string }

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

/** SHA-1 hex of the exact text (no normalising): the hash the old folder updater recorded for files it wrote. */
export async function kitSha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

/** Kit content for this vault: the folder rewrites (e.g. Extras/scripts -> your scripts folder) applied, like the old folder updater did. */
export function kitText(bundle: EmbeddedKit, file: EmbeddedFile, roles: Roles): string {
  let text = bundle.contents[file.id] ?? "";
  for (const [literal, role] of Object.entries(bundle.manifest.rewrite ?? {})) {
    const to = roles[role];
    if (to && to !== literal) text = text.split(literal).join(to);
  }
  return text;
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
    const text = kitText(bundle, file, roles);
    const kitHash = await kitSha256(text);
    const item = (action: ManagedAction, curHash: string | null, extra: Partial<ManagedItem> = {}): ManagedItem => ({ file, dest, text, kitHash, curHash, action, untracked: !st, ...extra });
    if (st?.detached) { items.push(item("detached", null)); continue; }
    // Switched off by the user: nothing is installed or updated (only files marked optional can be off)
    if (file.optional && off.has(file.id)) { items.push(item("off", (await adapter.exists(dest)) ? await kitSha256(await adapter.read(dest)) : null)); continue; }
    if (!(await adapter.exists(dest))) { items.push(item(st ? "missing" : "create", null)); continue; }

    const cur = await adapter.read(dest);
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

/** Copies the current file to <backups>/<timestamp>/<its path> and returns that path. */
async function backupFile(adapter: ManagedAdapter, it: ManagedItem, opts: ApplyOptions): Promise<string> {
  const backup = kitJoin(opts.backups, folderStamp(opts.stamp), it.dest);
  await kitEnsureDir(adapter, kitParent(backup));
  await adapter.write(backup, await adapter.read(it.dest));
  return backup;
}

export async function applyManaged(adapter: ManagedAdapter, bundle: EmbeddedKit, items: ManagedItem[], state: ManagedState | null, opts: ApplyOptions): Promise<ApplyOutcome> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const select = opts.select ?? (it => SAFE_ACTIONS.includes(it.action));
  const results: ManagedResult[] = [];
  const log = (...a: unknown[]): void => { if (opts.debug) console.debug("Lab Kit:", ...a); };
  for (const it of items) {
    const { id } = it.file;
    if (!select(it)) { results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" }); log("skip", it.action, it.dest); continue; }
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

/** Puts the kit's version of ONE file back, backing up your copy first. Refuses detached / kept / up-to-date files. */
export async function restoreManaged(adapter: ManagedAdapter, item: ManagedItem, state: ManagedState | null, opts: ApplyOptions): Promise<{ state: ManagedState; result: ManagedResult }> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const { id } = item.file;
  if (!RESTORABLE_ACTIONS.includes(item.action)) return { state: next, result: { id, dest: item.dest, action: item.action, outcome: "skipped" } };
  let backup: string | undefined;
  if (item.action !== "missing") backup = await backupFile(adapter, item, opts);
  else await kitEnsureDir(adapter, kitParent(item.dest));
  await adapter.write(item.dest, item.text);
  await rememberFile(adapter, next, item, opts);
  return { state: next, result: { id, dest: item.dest, action: item.action, outcome: backup ? "updated" : "created", backup } };
}

/**
 * Settles ONE conflict (`needs-merge`) with the text the merge window resolved to.
 * `text` null, or equal to your current file, keeps your file as it is and just records it as based on the new kit version ("Keep all mine").
 * Anything else is written after a backup. Either way the base copy becomes the kit's text, so the next merge starts from this kit version.
 */
export async function resolveManaged(adapter: ManagedAdapter, item: ManagedItem, text: string | null, state: ManagedState | null, opts: ApplyOptions): Promise<{ state: ManagedState; result: ManagedResult }> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const { id } = item.file;
  if (item.action !== "needs-merge") return { state: next, result: { id, dest: item.dest, action: item.action, outcome: "skipped" } };
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
    case "keep": return { label: "Kept (your settings)", tone: "muted" };
    case "detached": return { label: "Detached", tone: "muted" };
    case "off": return { label: "Off", tone: "muted" };
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
    case "keep": return 7;
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

/** What the first-install dialog offers: CSS snippets to switch on, and Templater's user scripts folder (only when Templater has none). */
export interface FirstInstallOptions { css: { enable: string[]; disable: string[] } | null; templaterFolder: string | null }
export function firstInstallOptions(bundle: EmbeddedKit, templater: { installed: boolean; folder?: string }, userScripts: string): FirstInstallOptions {
  const m = bundle.manifest;
  return {
    css: m.enableCss?.length ? { enable: m.enableCss, disable: m.disableCss ?? [] } : null,
    templaterFolder: m.templater?.userScripts && templater.installed && !templater.folder?.trim() ? userScripts : null,
  };
}
