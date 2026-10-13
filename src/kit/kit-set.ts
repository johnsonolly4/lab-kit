// Both kits in one window and one confirmation (Settings → Lab Kit → Updates, when the planning kit is on): the order of the kits' sections,
// their status lines, and the merged confirmation. Pure (no Obsidian runtime); the types come from managed.ts and managed-ui.ts.
import type { InstallPreview, ManagedAction, ManagedItem } from "./managed";
import type { PreviewNote, SettingChange } from "./managed-ui";

/** Actions that mean "something is waiting" for a kit: an update, a new or missing file, a merge or a conflict. */
const WAITING: ManagedAction[] = ["create", "fast-forward", "merge", "needs-merge", "missing"];

/** How many of a kit's files are waiting for the user. */
export const waitingCount = (items: ManagedItem[]): number => items.filter(i => WAITING.includes(i.action)).length;

export interface KitSection { id: string; name: string; /** Installed before (a kit never installed has every file "new"). */ installed: boolean; items: ManagedItem[] }

/** The kits in the order the combined window shows them: the kit with something waiting first (the most waiting first), then the rest by name. `open`: whether the section starts unfolded (something is waiting). */
export function orderKits<T extends KitSection>(kits: T[]): (T & { waiting: number; open: boolean })[] {
  return kits.map(k => { const waiting = waitingCount(k.items); return { ...k, waiting, open: waiting > 0 }; })
    .sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name));
}

/** The line under a kit's name: "Bundled v1.1.0 · installed v1.1.0, 26 files tracked · 3 waiting". */
export function kitStatusLine(o: { bundled: string; installed: string | null; tracked: number; waiting: number }): string {
  const base = `Bundled v${o.bundled} · ${o.installed ? `installed v${o.installed}, ${o.tracked} files tracked` : "not installed yet"}`;
  return o.waiting ? `${base} · ${o.waiting} waiting` : base;
}

/** What one kit would write and ask. */
export interface KitPart { id: string; name: string; preview: InstallPreview; settings: SettingChange[]; notes: PreviewNote[]; /** The kit asks even when nothing else needs a confirmation (its first install). */ ask: boolean; /** Empty folders it makes (paths). */ folders: string[] }

export interface MergedPreview {
  /** Each kit's own preview, for the headings. */
  parts: { id: string; name: string; preview: InstallPreview }[];
  /** Folders to create, each once. */
  folders: string[];
  /** Settings changes, each once: two kits that offer the very same change (same name and text) share one switch; different text stays separate. */
  settings: SettingChange[];
  notes: PreviewNote[];
  /** False when nothing needs asking: no first install, no folder to create, no setting to change. */
  needsConfirm: boolean;
}

/** The confirmation for both kits at once. */
export function mergeParts(parts: KitPart[]): MergedPreview {
  const folders = [...new Set(parts.flatMap(p => p.preview.folders))];
  const seen = new Set<string>(), settings: SettingChange[] = [];
  for (const s of parts.flatMap(p => p.settings)) { const key = `${s.name}\n${s.desc}`; if (!seen.has(key)) { seen.add(key); settings.push(s); } }
  return {
    parts: parts.map(p => ({ id: p.id, name: p.name, preview: p.preview })),
    folders, settings, notes: parts.flatMap(p => p.notes),
    needsConfirm: parts.some(p => p.ask) || folders.length > 0 || settings.length > 0,
  };
}
