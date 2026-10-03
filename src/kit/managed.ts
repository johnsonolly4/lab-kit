// Built-in kit: the kit files embedded in main.js, tracked by stable id, installed without ever overwriting your edits.
// Pure logic (no Node, works on mobile): the vault adapter and the roles are passed in; hashing is crypto.subtle.
//
//  - plan: one action per kit file (create / fast-forward / up-to-date / user-modified / needs-merge / missing / ...)
//  - apply: backs up every file it overwrites, writes, and remembers what it wrote (state + a base copy for later merges)
//  - "needs-merge" (you and the kit both changed the file) is only reported and left untouched: merging comes later
import type { DataAdapter } from "obsidian";
import { kitEnsureDir, kitJoin, kitParent, type Roles } from "./updater";

/* ---- Types ---- */
export type ManagedKind = "template" | "snippet" | "script";
export interface EmbeddedFile {
  id: string; kind: ManagedKind; role: string; src: string; dest: string;
  version: string; sha256: string; renamedFrom: string[]; policy?: string;
}
/** The kit as built into main.js (see scripts/embed-kit.mjs). */
export interface EmbeddedKit {
  manifest: { schema: number; kitVersion: string; files: EmbeddedFile[]; removed: string[]; rewrite?: Record<string, string> };
  contents: Record<string, string>;
}
export interface ManagedFileState {
  path: string; installedVersion: string; installedHash: string;
  detached: boolean; userDeleted: boolean; pendingConflict: unknown;
}
/** What the plugin remembers about built-in kit files (the `managed` key of the kit data). */
export interface ManagedState { installedKitVersion: string; files: Record<string, ManagedFileState> }
export type ManagedAdapter = Pick<DataAdapter, "exists" | "read" | "write" | "mkdir">;
export type ManagedAction = "create" | "fast-forward" | "up-to-date" | "user-modified" | "needs-merge" | "missing" | "keep" | "detached";
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
}
/** Files the old folder updater wrote: path -> SHA-1 of what it wrote, and how to compute that hash. */
export interface LegacyRecord { files: Record<string, string>; hash: (text: string) => string }
export interface ManagedResult { id: string; dest: string; action: ManagedAction; outcome: "created" | "updated" | "adopted" | "skipped"; backup?: string }

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

/** Kit content for this vault: the folder rewrites (e.g. Extras/scripts -> your scripts folder) applied, like the folder updater does. */
export function kitText(bundle: EmbeddedKit, file: EmbeddedFile, roles: Roles): string {
  let text = bundle.contents[file.id] ?? "";
  for (const [literal, role] of Object.entries(bundle.manifest.rewrite ?? {})) {
    const to = roles[role];
    if (to && to !== literal) text = text.split(literal).join(to);
  }
  return text;
}

/* ---- Plan ---- */
export async function planManaged(adapter: ManagedAdapter, bundle: EmbeddedKit, state: ManagedState | null, roles: Roles, legacy: LegacyRecord | null = null): Promise<ManagedItem[]> {
  const items: ManagedItem[] = [];
  for (const file of bundle.manifest.files) {
    const st = state?.files[file.id];
    const dest = st?.path || kitJoin(roles[file.role], file.dest);
    const text = kitText(bundle, file, roles);
    const kitHash = await kitSha256(text);
    const item = (action: ManagedAction, curHash: string | null, untracked = !st): ManagedItem => ({ file, dest, text, kitHash, curHash, action, untracked });
    if (st?.detached) { items.push(item("detached", null)); continue; }
    if (!(await adapter.exists(dest))) { items.push(item(st ? "missing" : "create", null)); continue; }

    const cur = await adapter.read(dest);
    const curHash = await kitSha256(cur);
    if (curHash === kitHash) { items.push(item("up-to-date", curHash)); continue; }
    if (file.policy === "keep") { items.push(item("keep", curHash)); continue; }
    // Unmodified = still what this system wrote, or still what the old folder updater recorded for it
    const legacyMatch = legacy?.files[dest] !== undefined && legacy.files[dest] === legacy.hash(cur);
    if (st?.installedHash === curHash || legacyMatch) items.push(item("fast-forward", curHash));
    else if (st && st.installedHash !== kitHash) items.push(item("needs-merge", curHash));
    else items.push(item("user-modified", curHash));
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
async function rememberFile(adapter: ManagedAdapter, next: ManagedState, it: ManagedItem, opts: ApplyOptions): Promise<void> {
  const prev = next.files[it.file.id];
  next.files[it.file.id] = { path: it.dest, installedVersion: it.file.version, installedHash: it.kitHash,
    detached: prev?.detached ?? false, userDeleted: false, pendingConflict: null };
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
    } else {
      // user-modified / needs-merge / keep / detached are never written by apply, even if a caller selects them
      results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" });
    }
  }
  if (!opts.keepVersion) next.installedKitVersion = bundle.manifest.kitVersion;
  return { state: next, results };
}

/** Actions "Restore kit original" may overwrite (the old copy is backed up first). Never a detached or kept file. */
export const RESTORABLE_ACTIONS: ManagedAction[] = ["user-modified", "needs-merge", "fast-forward", "missing"];

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

/** Stops (or resumes) managing one file. Returns false when the file isn't tracked yet (nothing to detach). */
export function setDetached(state: ManagedState | null, id: string, detached: boolean): boolean {
  const st = state?.files[id];
  if (!st) return false;
  st.detached = detached;
  return true;
}

/** Plain-words status for a plan item (the labels in the Manage kit files window). */
export function statusOf(item: ManagedItem): { label: string; tone: "ok" | "info" | "warn" | "muted" } {
  switch (item.action) {
    case "up-to-date": return { label: "Up to date", tone: "ok" };
    case "fast-forward": return { label: "Update available", tone: "info" };
    case "create": return { label: "New", tone: "info" };
    case "user-modified": return { label: "Changed by you", tone: "warn" };
    case "needs-merge": return { label: "Changed by you and the kit", tone: "warn" };
    case "missing": return { label: "Missing", tone: "warn" };
    case "keep": return { label: "Kept (your settings)", tone: "muted" };
    case "detached": return { label: "Detached", tone: "muted" };
  }
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
