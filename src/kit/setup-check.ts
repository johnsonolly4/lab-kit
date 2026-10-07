// Setup check (Phase 6): what the kits need from other plugins, Templater, CSS snippets, folders and hotkeys, as a list of ok / missing items.
// Pure: the caller reads the vault and Obsidian into a SetupState; each missing item carries a fix the settings UI carries out after a confirmation.
import type { KitHotkey } from "./obsidian-private";

/** Plugins the kits use, by plugin id (the id in `obsidian://show-plugin?id=`). */
export const SETUP_PLUGINS: { id: string; name: string; kit: "lab" | "planning"; optional?: boolean; alias?: string }[] = [
  { id: "templater-obsidian", name: "Templater", kit: "lab" },
  { id: "dataview", name: "Dataview", kit: "lab" },
  { id: "obsidian-meta-bind-plugin", name: "Meta Bind", kit: "planning" },
  { id: "obsidian-zotero-desktop-connector", name: "ZotLit", kit: "planning", optional: true, alias: "zotlit" },
];

/** Hotkeys the kits recommend (never set without asking). Two-key rule: one modifier + one key. */
export const SETUP_HOTKEYS: { name: string; key: KitHotkey; kit: "lab" | "planning" }[] = [
  { name: "Insert snippet", key: { modifiers: ["Alt"], key: "S" }, kit: "lab" },
];

export interface SetupState {
  /** Loaded plugin ids (plus kit names such as `zotlit`). */
  plugins: ReadonlySet<string>;
  planning: boolean;
  templater: { templatesFolder: string; userScriptsFolder: string; menuHotkey: boolean; folderTemplates: { folder: string; template: string }[] };
  /** Path of the installed Insert snippet template; null when the lab kit isn't installed. */
  menu: string | null;
  /** Kit installed (has tracked files), per kit. */
  installed: { lab: boolean; planning: boolean };
  /** The kits' CSS snippets; `enabled` undefined when Obsidian can't tell. */
  css: { name: string; enabled: boolean | undefined }[];
  /** Folders the kits expect. */
  folders: { path: string; exists: boolean }[];
  /** Folder templates the planning kit wants (folder → template path). */
  folderTemplates: { folder: string; template: string }[];
  /** Hotkey commands: the Templater command for Insert snippet, etc. Null when the command doesn't exist yet. */
  hotkeyCommands: Record<string, string | null>;
  /** Hotkeys in use, per command id; null when Obsidian's hotkey manager can't be read. */
  hotkeys: Record<string, KitHotkey[]> | null;
  /** Command names by id, to name a clash. */
  commandNames: Record<string, string>;
}

export type SetupFix =
  | { kind: "plugin"; id: string }
  | { kind: "install"; kit: "lab" | "planning" }
  | { kind: "templater" }
  | { kind: "css"; names: string[] }
  | { kind: "folder"; path: string }
  | { kind: "folder-template"; folder: string; template: string }
  | { kind: "hotkey"; command: string; key: KitHotkey };

export interface SetupItem { id: string; group: string; label: string; ok: boolean; optional?: boolean; detail: string; fix?: SetupFix }

/** "Alt+S", "Mod+Shift+T": how a hotkey is written in the list. */
export const hotkeyText = (k: KitHotkey): string => [...k.modifiers, k.key].join("+");
const sameKey = (a: KitHotkey, b: KitHotkey): boolean =>
  a.key.toLowerCase() === b.key.toLowerCase() && [...a.modifiers].sort().join() === [...b.modifiers].sort().join();

/** Every check for the kits that are on, in display order. */
export function checkSetup(s: SetupState): SetupItem[] {
  const out: SetupItem[] = [];
  const kitOn = (kit: "lab" | "planning"): boolean => kit === "lab" || s.planning;

  for (const p of SETUP_PLUGINS.filter(p => kitOn(p.kit))) {
    const ok = s.plugins.has(p.id) || (!!p.alias && s.plugins.has(p.alias));
    out.push({ id: `plugin:${p.id}`, group: "Plugins", label: p.name, ok, optional: p.optional,
      detail: ok ? "Installed and on." : p.optional ? "Optional: the literature notes need it." : "Not installed or turned off. Lab Kit never installs plugins: open its page and install it.",
      fix: ok ? undefined : { kind: "plugin", id: p.id } });
  }

  for (const kit of ["lab", "planning"] as const) {
    if (!kitOn(kit)) continue;
    const ok = s.installed[kit];
    out.push({ id: `install:${kit}`, group: "Kit files", label: kit === "lab" ? "Lab kit installed" : "Planning kit installed", ok,
      detail: ok ? "Installed." : "Not installed yet.", fix: ok ? undefined : { kind: "install", kit } });
  }

  if (s.plugins.has("templater-obsidian")) {
    const t = s.templater;
    const items: [string, string, boolean][] = [
      ["templates-folder", "Templater template folder", !!t.templatesFolder.trim()],
      ["user-scripts", "Templater user scripts folder", !!t.userScriptsFolder.trim()],
      ["menu-hotkey", "Insert snippet in Templater's Template hotkeys", t.menuHotkey],
    ];
    for (const [id, label, ok] of items) {
      if (id === "menu-hotkey" && !s.menu) continue;
      out.push({ id: `templater:${id}`, group: "Templater", label, ok, detail: ok ? "Set." : "Not set. Set up fills in only what is empty.", fix: ok || !s.menu ? undefined : { kind: "templater" } });
    }
    if (s.planning) for (const ft of s.folderTemplates) {
      const have = t.folderTemplates.find(e => e.folder === ft.folder);
      const ok = !!have;
      out.push({ id: `folder-template:${ft.folder}`, group: "Templater", label: `Folder template for ${ft.folder}`, ok,
        detail: !have ? `Not set. Adds ${ft.template}.` : have.template === ft.template ? "Set." : `Set to ${have.template} (yours, left as it is).`,
        fix: ok ? undefined : { kind: "folder-template", folder: ft.folder, template: ft.template } });
    }
  }

  for (const c of s.css) {
    const ok = c.enabled === true;
    out.push({ id: `css:${c.name}`, group: "Appearance", label: `CSS snippet ${c.name}`, ok,
      detail: c.enabled === undefined ? "Can't tell in this Obsidian version: check Settings → Appearance → CSS snippets." : ok ? "On." : "Off.",
      fix: c.enabled === false ? { kind: "css", names: [c.name] } : undefined });
  }

  for (const f of s.folders) out.push({ id: `folder:${f.path}`, group: "Folders", label: f.path, ok: f.exists, detail: f.exists ? "Exists." : "Missing.", fix: f.exists ? undefined : { kind: "folder", path: f.path } });

  for (const h of SETUP_HOTKEYS.filter(h => kitOn(h.kit))) {
    const command = s.hotkeyCommands[h.name] ?? null;
    const id = `hotkey:${h.name}`, label = `${h.name}: ${hotkeyText(h.key)}`;
    if (!command) { out.push({ id, group: "Hotkeys", label, ok: false, detail: "The command doesn't exist yet: install the kit and run Templater set up first." }); continue; }
    if (!s.hotkeys) { out.push({ id, group: "Hotkeys", label, ok: false, detail: "Can't read hotkeys in this Obsidian version: set it in Settings → Hotkeys." }); continue; }
    const own = s.hotkeys[command] ?? [];
    if (own.length) { out.push({ id, group: "Hotkeys", label, ok: true, detail: own.some(k => sameKey(k, h.key)) ? "Set." : `Set to ${own.map(hotkeyText).join(", ")} (yours, left as it is).` }); continue; }
    const clash = Object.entries(s.hotkeys).find(([cmd, keys]) => cmd !== command && keys.some(k => sameKey(k, h.key)))?.[0];
    out.push({ id, group: "Hotkeys", label, ok: false,
      detail: clash ? `Not set. ${hotkeyText(h.key)} is already used by ${s.commandNames[clash] ?? clash}: pick another key in Settings → Hotkeys.` : "Not set.",
      fix: clash ? undefined : { kind: "hotkey", command, key: h.key } });
  }
  return out;
}
