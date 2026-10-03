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
  debug?: boolean;
}
export interface ApplyOutcome { state: ManagedState; results: ManagedResult[] }

const folderStamp = (iso: string): string => iso.replace(/[:.]/g, "-");

export async function applyManaged(adapter: ManagedAdapter, bundle: EmbeddedKit, items: ManagedItem[], state: ManagedState | null, opts: ApplyOptions): Promise<ApplyOutcome> {
  const next: ManagedState = { installedKitVersion: state?.installedKitVersion ?? "0", files: { ...(state?.files ?? {}) } };
  const select = opts.select ?? (it => SAFE_ACTIONS.includes(it.action));
  const results: ManagedResult[] = [];
  const log = (...a: unknown[]): void => { if (opts.debug) console.debug("Lab Kit:", ...a); };
  const remember = async (it: ManagedItem): Promise<void> => {
    const prev = next.files[it.file.id];
    next.files[it.file.id] = { path: it.dest, installedVersion: it.file.version, installedHash: it.kitHash,
      detached: prev?.detached ?? false, userDeleted: false, pendingConflict: null };
    const base = kitJoin(opts.baseDir, `${it.file.id}.txt`);
    await kitEnsureDir(adapter, opts.baseDir);
    await adapter.write(base, it.text);
  };
  for (const it of items) {
    const { id } = it.file;
    if (!select(it)) { results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" }); log("skip", it.action, it.dest); continue; }
    if (it.action === "up-to-date") { await remember(it); results.push({ id, dest: it.dest, action: it.action, outcome: "adopted" }); continue; }
    if (it.action === "create" || it.action === "missing") {
      await kitEnsureDir(adapter, kitParent(it.dest));
      await adapter.write(it.dest, it.text);
      await remember(it);
      results.push({ id, dest: it.dest, action: it.action, outcome: "created" });
      log("create", it.dest);
    } else if (it.action === "fast-forward") {
      const backup = kitJoin(opts.backups, folderStamp(opts.stamp), it.dest);
      await kitEnsureDir(adapter, kitParent(backup));
      await adapter.write(backup, await adapter.read(it.dest));
      await adapter.write(it.dest, it.text);
      await remember(it);
      results.push({ id, dest: it.dest, action: it.action, outcome: "updated", backup });
      log("fast-forward", it.dest, "backup", backup);
    } else {
      // user-modified / needs-merge / keep / detached are never written by apply, even if a caller selects them
      results.push({ id, dest: it.dest, action: it.action, outcome: "skipped" });
    }
  }
  next.installedKitVersion = bundle.manifest.kitVersion;
  return { state: next, results };
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
