// Kit updater logic: installs new versions of the lab notebook kit from a folder on this computer.
// Desktop only: reads the update folder with Node fs/path/crypto, which come from `nodeModule` (src/node.ts) and are null on mobile.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.
//
//  - finds where things live in the vault (Templater settings, existing kit files, remembered locations)
//  - previews every change: new / replace / unchanged / edited by you / kept (your config) / delete
//  - optionally backs up what it replaces or deletes (off by default)
//  - remembers what it installed, and follows files you move or rename
import type { App, DataAdapter } from "obsidian";
import { nodeModule, type NodeFs, type NodePath } from "../node";
import { templaterSettings } from "./obsidian-private";
import type { ManagedState } from "./managed";

/* ---- Types ---- */
export type Roles = Record<string, string>;
export type ItemStatus = "new" | "replace" | "same" | "edited" | "keep" | "delete";

export interface KitManifest {
  version: string;
  files: { src: string; path: string; role: string; policy?: string }[];
  delete?: { role: string; path: string }[];
  rewrite?: Record<string, string>;
  roles?: Record<string, { default?: string }>;
  notes?: string[];
  templater?: { userScripts?: boolean };
  enableCss?: string[];
  disableCss?: string[];
}
export interface Kit { dir: string; folder: string; manifest: KitManifest }
export interface KitRecord { version: string; roles: Roles; files: Record<string, string>; installedAt: string }
/** What the plugin remembers about the updater (the `kit` key of data.json). */
export interface KitData {
  source: string; checkOnStartup: boolean; makeBackups: boolean; installed: KitRecord | null; seenChangelog: string; initials: string; snippetIcons: Record<string, string>;
  /** Built-in kit (embedded in the plugin): what was installed, per file id. */
  managed: ManagedState | null;
  /** Folders the user set for the built-in kit (templates, scripts, backups). Empty = detected. */
  paths: Roles;
  debug: boolean;
}
export interface PlanItem {
  kind: "file" | "delete";
  src?: string;
  dest: string;
  role: string;
  buf?: Uint8Array;
  text?: string | null;
  newHash?: string;
  curHash?: string | null;
  status: ItemStatus;
  overwrite: boolean;
}
export type KitAdapter = Pick<DataAdapter, "exists" | "readBinary" | "writeBinary" | "write" | "remove" | "mkdir">;
export interface ApplyResult {
  record: KitRecord;
  done: { written: number; deleted: number; skipped: number; backedUp: number };
  backupRoot: string | null;
}

const KIT_TEXT_EXT = /\.(md|js|json|css|py|txt|csv)$/i;
export const KIT_DEFAULTS: KitData = { source: "", checkOnStartup: true, makeBackups: false, installed: null, seenChangelog: "", initials: "", snippetIcons: {}, managed: null, paths: {}, debug: false };

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
export const kitParent = (p: string): string => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
export function kitHash(buf: Uint8Array): string {
  const crypto = nodeModule("crypto");
  if (crypto) return crypto.createHash("sha1").update(buf).digest("hex");
  let h = 0x811c9dc5; const b = new Uint8Array(buf);   // fallback: FNV-1a
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });   // keeps a leading BOM, like Buffer.toString("utf8")
const toArrayBuffer = (buf: Uint8Array): ArrayBuffer => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

/** Where each part of the kit lives in this vault. */
export function kitDetectRoles(app: App, record: KitRecord | null, manifest?: KitManifest): Roles {
  const files = app.vault.getFiles();
  const tpl = templaterSettings(app);
  const remembered: Partial<Roles> = record?.roles ?? {};
  const find = (name: string, test?: (f: (typeof files)[number]) => boolean) => files.find(f => f.name === name && (!test || test(f)));
  const scriptsFound = find("lab-config.json", f => app.vault.getAbstractFileByPath(kitJoin(f.parent?.path, "lab-header")) != null)
                    ?? find("lab-config.json");
  const scripts = remembered.scripts ?? (scriptsFound ? scriptsFound.parent!.path : "Extras/scripts");
  const menu = find("Insert snippet.md");
  const roles: Roles = {
    cssSnippets: kitJoin(app.vault.configDir, "snippets"),
    scripts,
    userScripts: tpl.user_scripts_folder || remembered.userScripts || kitJoin(scripts, "templater"),
    templates: tpl.templates_folder || remembered.templates || (menu ? menu.parent!.path : "Templates"),
    backups: remembered.backups ?? kitJoin(app.vault.configDir, "plugins", "lab-kit", "backups"),   // inside the plugin folder: out of the file tree
  };
  for (const [k, v] of Object.entries(manifest?.roles ?? {})) if (!(k in roles)) roles[k] = remembered[k] ?? v.default ?? k;
  return roles;
}

/** Read every file of a kit version from disk (Node fs) and decide what to do with it. */
export async function kitPlan(adapter: KitAdapter, kit: Kit, roles: Roles, record: KitRecord | null, readSource: (src: string) => Uint8Array): Promise<PlanItem[]> {
  const m = kit.manifest;
  const rewrites = Object.entries(m.rewrite ?? {})
    .map(([literal, role]): [string, string] => [literal, roles[role]])
    .filter(([lit, to]) => to && lit !== to);
  const items: PlanItem[] = [];
  for (const f of m.files) {
    const dest = kitJoin(roles[f.role], f.path);
    let buf = readSource(f.src);
    let text: string | null = null;
    if (KIT_TEXT_EXT.test(f.src)) {
      text = utf8.decode(buf);
      for (const [lit, to] of rewrites) text = text.split(lit).join(to);
      buf = new TextEncoder().encode(text);
    }
    const newHash = kitHash(buf);
    const exists = await adapter.exists(dest);
    let status: ItemStatus, curHash: string | null = null;
    if (!exists) status = "new";
    else {
      curHash = kitHash(new Uint8Array(await adapter.readBinary(dest)));
      const known = record?.files?.[dest];
      if (f.policy === "keep") status = "keep";
      else if (curHash === newHash) status = "same";
      else if (known && known !== curHash) status = "edited";
      else status = "replace";
    }
    items.push({ kind: "file", src: f.src, dest, role: f.role, buf, text, newHash, curHash, status, overwrite: status !== "edited" });
  }
  for (const d of m.delete ?? []) {
    const dest = kitJoin(roles[d.role], d.path);
    if (await adapter.exists(dest)) items.push({ kind: "delete", dest, role: d.role, status: "delete", overwrite: true });
  }
  return items;
}

export async function kitEnsureDir(adapter: Pick<DataAdapter, "exists" | "mkdir">, dir: string): Promise<void> {
  if (!dir) return;
  const parts = dir.split("/"); let cur = "";
  for (const p of parts) { cur = cur ? `${cur}/${p}` : p; if (!(await adapter.exists(cur))) await adapter.mkdir(cur); }
}

/** Back up, write, delete. Returns the new install record and a summary. */
export async function kitApply(adapter: KitAdapter, kit: Kit, roles: Roles, items: PlanItem[], record: KitRecord | null, stamp: string, makeBackups = true): Promise<ApplyResult> {
  const backupRoot = kitJoin(roles.backups, `${stamp} before v${kit.manifest.version}`);
  const files: Record<string, string> = { ...(record?.files ?? {}) };
  const done = { written: 0, deleted: 0, skipped: 0, backedUp: 0 };
  const backup = async (dest: string): Promise<void> => {
    if (!makeBackups) return;
    const to = kitJoin(backupRoot, dest);
    await kitEnsureDir(adapter, kitParent(to));
    await adapter.writeBinary(to, await adapter.readBinary(dest));
    done.backedUp++;
  };
  for (const it of items) {
    if (it.kind === "delete") {
      await backup(it.dest);
      await adapter.remove(it.dest);
      delete files[it.dest];
      done.deleted++;
      continue;
    }
    if (it.status === "keep") { done.skipped++; continue; }
    if (it.status === "same") { files[it.dest] = it.newHash!; continue; }
    if (it.status === "edited" && !it.overwrite) { done.skipped++; continue; }
    if (it.status !== "new") await backup(it.dest);
    await kitEnsureDir(adapter, kitParent(it.dest));
    if (it.text != null) await adapter.write(it.dest, it.text);
    else await adapter.writeBinary(it.dest, toArrayBuffer(it.buf!));
    files[it.dest] = it.newHash!;
    done.written++;
  }
  return { record: { version: kit.manifest.version, roles, files, installedAt: stamp }, done, backupRoot: done.backedUp ? backupRoot : null };
}

function desktopOnly(): { fs: NodeFs; path: NodePath } {
  const fs = nodeModule("fs"), path = nodeModule("path");
  if (!fs || !path) throw new Error("The folder updater works in the desktop app only.");
  return { fs, path };
}

/** List kit versions in the source folder (Node fs, desktop only). */
export function kitScan(source: string): Kit[] {
  const { fs, path } = desktopOnly();
  const out: Kit[] = [];
  for (const d of fs.readdirSync(source, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const mf = path.join(source, d.name, "kit-manifest.json");
    if (!fs.existsSync(mf)) continue;
    try { out.push({ dir: path.join(source, d.name), folder: d.name, manifest: JSON.parse(fs.readFileSync(mf, "utf8")) as KitManifest }); }
    catch (e) { console.error("Lab kit: bad manifest in", d.name, e); }
  }
  return out.sort((a, b) => kitCompare(b.manifest.version, a.manifest.version));
}

/** Reads one file of a kit version from the update folder (Node fs, desktop only). */
export function kitReadSource(kit: Kit, src: string): Uint8Array {
  const { fs, path } = desktopOnly();
  return fs.readFileSync(path.join(kit.dir, ...src.split("/")));
}
