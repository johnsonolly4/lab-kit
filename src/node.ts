// The one doorway to Node/Electron modules. Everything else asks `nodeModule("fs")` and gets `null`
// where they don't exist (mobile, or mobile emulation: see `hasNode`), so no other file calls require().
import { Platform } from "obsidian";

// Hand-typed on purpose: only what we call. `typeof import("fs")` needs @types/node, which the store scan may not have.
export interface NodeFs {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): unknown;
  writeFileSync(path: string, data: string | Uint8Array): void;
  unlinkSync(path: string): void;
}
export interface NodeOs { tmpdir(): string }
export interface NodePath { join(...parts: string[]): string; isAbsolute(path: string): boolean }

export interface NodeModules {
  fs: NodeFs;
  path: NodePath;
  os: NodeOs;
  electron: { shell: { openPath(path: string): Promise<string> }; remote?: { BrowserWindow: new (options: object) => PrintWindow } };
}

/** The little of an Electron BrowserWindow that printing uses. */
export interface PrintWindow {
  loadFile(path: string): Promise<void>;
  webContents: { printToPDF(options: object): Promise<Uint8Array> };
  destroy(): void;
}

// Obsidian plugins are CommonJS bundles: esbuild keeps `require` and leaves these modules to the app.
declare const require: (id: string) => unknown;

const loaded: Partial<NodeModules> = {};

/** A Node/Electron module, loaded on first use, or `null` when this app has none (mobile) or the module can't be loaded. */
export function nodeModule<K extends keyof NodeModules>(name: K): NodeModules[K] | null {
  if (!Platform.isDesktopApp || Platform.isMobile) return null;   // same test as hasNode() in platform.ts
  const hit = loaded[name];
  if (hit) return hit;
  try {
    const mod = load(name);
    loaded[name] = mod;
    return mod;
  } catch { return null; }
}

function load<K extends keyof NodeModules>(name: K): NodeModules[K] {
  if (Platform.isDesktop) {
    switch (name) {
      case "fs": return require("fs") as NodeModules[K];
      case "path": return require("path") as NodeModules[K];
      case "os": return require("os") as NodeModules[K];
      case "electron": return require("electron") as NodeModules[K];
    }
  }
  throw new Error(`${name} is not available here`);
}

/**
 * HTML to PDF bytes through a hidden window and `webContents.printToPDF`. Desktop only: null on a phone, in mobile emulation,
 * or when this Obsidian does not offer `electron.remote`. `electron.remote` is an Obsidian internal (the app supplies it, as
 * `@electron/remote` for `scripts/obsidian-check.mjs`); this is the only place that uses it. The page sets its own size and margins
 * (`@page`), the footer text repeats on every page.
 */
export async function printHtmlToPdf(html: string, footerHtml: string): Promise<ArrayBuffer | null> {
  const fs = nodeModule("fs"), path = nodeModule("path"), os = nodeModule("os"), remote = nodeModule("electron")?.remote;
  if (!fs || !path || !os || !remote) return null;
  const file = path.join(os.tmpdir(), `lab-kit-close-${Date.now()}.html`);
  let win: PrintWindow | null = null;
  try {
    fs.writeFileSync(file, html);   // a file, not a data: URL: the app's stylesheets make the page too big for one
    win = new remote.BrowserWindow({ show: false, webPreferences: { javascript: false } });
    await win.loadFile(file);
    const bytes = await win.webContents.printToPDF({
      pageSize: "A4", printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footerHtml,
    });
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch (e) {
    console.error("Lab Kit: could not make the PDF", e);
    return null;
  } finally {
    win?.destroy();
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
}

/** Saves bytes as `folder/name` outside the vault (desktop). The folder is made if missing. Throws when the folder is not an absolute path, there is no Node here, or the disk refuses. */
export function saveFileTo(folder: string, name: string, bytes: ArrayBuffer): void {
  const fs = nodeModule("fs"), path = nodeModule("path");
  if (!fs || !path) throw new Error("No file access on this device");
  if (!path.isAbsolute(folder)) throw new Error(`${folder} is not an absolute path`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, name), new Uint8Array(bytes));
}

/** True when `folder/name` exists (desktop; false without Node). */
export function fileExistsIn(folder: string, name: string): boolean {
  const fs = nodeModule("fs"), path = nodeModule("path");
  return !!fs && !!path && fs.existsSync(path.join(folder, name));
}
