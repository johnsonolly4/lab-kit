// The one doorway to Node/Electron modules. Everything else asks `nodeModule("fs")` and gets `null`
// where they don't exist (mobile, or mobile emulation: see `hasNode`), so no other file calls require().
import { Platform } from "obsidian";

// Hand-typed on purpose: only what we call. `typeof import("fs")` needs @types/node, which the store scan may not have.
export interface NodeFs {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): unknown;
}
export interface NodePath { join(...parts: string[]): string }

export interface NodeModules {
  fs: NodeFs;
  path: NodePath;
  electron: { shell: { openPath(path: string): Promise<string> } };
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
      case "electron": return require("electron") as NodeModules[K];
    }
  }
  throw new Error(`${name} is not available here`);
}
