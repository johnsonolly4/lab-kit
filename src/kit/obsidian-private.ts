// The only place that touches Obsidian's private APIs (not in the public typings, may change between versions):
// other plugins' settings (`app.plugins`) and the CSS snippet manager (`app.customCss`).
import type { App, TFile, TFolder } from "obsidian";
import { actionsDiffer } from "../planning/buttons";

interface TemplaterPlugin {
  settings?: { user_scripts_folder?: string; templates_folder?: string; enabled_templates_hotkeys?: (string | { template?: string })[];
    folder_templates?: { folder?: string; template?: string }[]; trigger_on_file_creation_mode?: string; startup_templates?: string[] };
  command_handler?: { sync_template_hotkeys?: () => void; add_template_hotkey?: (old: string | null, template: string) => void };
  templater?: { files_with_pending_templates?: Set<string>; create_new_note_from_template?: (template: TFile, folder?: TFolder, filename?: string, open?: boolean) => Promise<TFile | undefined>;
    append_template_to_active_file?: (template: TFile) => Promise<void> };
  save_settings?: () => Promise<void>;
  saveSettings?: () => Promise<void>;
}
/** One Obsidian hotkey: modifiers (Mod, Ctrl, Alt, Shift, Meta) and a key. */
export interface KitHotkey { modifiers: string[]; key: string }
interface PrivateApp {
  plugins?: {
    plugins?: Record<string, unknown>;
    disablePlugin(id: string): Promise<void>;
    enablePlugin(id: string): Promise<void>;
  };
  hotkeyManager?: {
    customKeys?: Record<string, KitHotkey[]>;
    defaultKeys?: Record<string, KitHotkey[]>;
    setHotkeys?: (id: string, keys: KitHotkey[]) => void;
    save?: () => Promise<void> | void;
    bake?: () => void;
  };
  /** Obsidian's own (core) plugins, by id; `instance.options` is that plugin's saved settings. */
  internalPlugins?: { plugins?: Record<string, { enabled?: boolean; instance?: { options?: Record<string, unknown> } }> };
  /** Property types (Settings → Properties, saved in types.json). */
  metadataTypeManager?: { getAssignedType?: (name: string) => string | null; setType?: (name: string, type: string) => Promise<void> | void };
  customCss?: {
    requestLoadSnippets?: () => Promise<void>;
    setCssEnabledStatus?: (name: string, enabled: boolean) => void;
    enabledSnippets?: Set<string>;
  };
}
const priv = (app: App): PrivateApp => app as unknown as PrivateApp;
const templater = (app: App): TemplaterPlugin | undefined => priv(app).plugins?.plugins?.["templater-obsidian"] as TemplaterPlugin | undefined;

/** True when Obsidian has read every note's properties (`metadataCache.resolved`, not in the public typings). False when unknown. */
export const metadataResolved = (app: App): boolean => (app.metadataCache as unknown as { resolved?: boolean }).resolved === true;

/** Names the kit manifests use for other plugins (`needs: "plugin:<name>"`) that differ from the plugin id (none today: ZotLit's id is `zotlit`, checked in its manifest). */
const PLUGIN_ALIASES: Record<string, string[]> = {};
/** Other plugins that are loaded (installed and on), as plugin ids plus the kit names in PLUGIN_ALIASES. */
export function loadedPlugins(app: App): Set<string> {
  const ids = new Set(Object.keys(priv(app).plugins?.plugins ?? {}));
  for (const [name, aliases] of Object.entries(PLUGIN_ALIASES)) if (aliases.some(a => ids.has(a))) ids.add(name);
  return ids;
}

/** Templater's settings, or {} when Templater isn't installed. */
export const templaterSettings = (app: App): NonNullable<TemplaterPlugin["settings"]> => templater(app)?.settings ?? {};
export const hasTemplater = (app: App): boolean => !!templater(app);
export const templaterTemplatesFolder = (app: App): string | undefined => templater(app)?.settings?.templates_folder;
export const templaterUserScriptsFolder = (app: App): string | undefined => templater(app)?.settings?.user_scripts_folder;

/** Creates a note from `template` in `folder` with Templater and opens it (unless `open` is false). False when this Templater has no such function (private API). */
export async function templaterCreateNote(app: App, template: TFile, folder: TFolder, open = true, filename?: string): Promise<boolean> {
  const create = templater(app)?.templater?.create_new_note_from_template;
  if (typeof create !== "function") return false;
  await create.call(templater(app)?.templater, template, folder, filename, open);
  return true;
}

/** Runs `template` with Templater and inserts the result at the cursor of the open note (Templater's own "Insert template"). False when this Templater has no such function (private API). */
export async function templaterInsert(app: App, template: TFile): Promise<boolean> {
  const insert = templater(app)?.templater?.append_template_to_active_file;
  if (typeof insert !== "function") return false;
  await insert.call(templater(app)?.templater, template);
  return true;
}

/** Points Templater's "user scripts" folder at `folder` and saves its settings. */
export async function setTemplaterUserScripts(app: App, folder: string): Promise<void> {
  const tpl = templater(app);
  if (!tpl) return;
  tpl.settings = tpl.settings ?? {};
  tpl.settings.user_scripts_folder = folder;
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
}

/** Points Templater's "template folder" at `folder` and saves its settings. */
export async function setTemplaterTemplatesFolder(app: App, folder: string): Promise<void> {
  const tpl = templater(app);
  if (!tpl) return;
  tpl.settings = tpl.settings ?? {};
  tpl.settings.templates_folder = folder;
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
}

/** True when `template` (a vault path) is already in Templater's "Template hotkeys" (or Templater is missing: nothing to add). Reads only. */
export function hasTemplaterHotkey(app: App, template: string): boolean {
  const list = templater(app)?.settings?.enabled_templates_hotkeys;
  if (!templater(app)?.settings) return true;
  return !!list?.some(e => (typeof e === "string" ? e : e?.template) === template);
}

/** Adds `template` (a vault path) to Templater's "Template hotkeys" so it shows up in Obsidian's Hotkeys list. True when it was added, false when it was already there or Templater is missing. */
export async function addTemplaterHotkey(app: App, template: string): Promise<boolean> {
  const tpl = templater(app);
  if (!tpl?.settings) return false;
  const list = tpl.settings.enabled_templates_hotkeys ??= [];
  if (list.some(e => (typeof e === "string" ? e : e?.template) === template)) return false;
  list.push(template);
  try {
    // Newer Templater re-reads the list; older ones add one command at a time
    if (tpl.command_handler?.sync_template_hotkeys) tpl.command_handler.sync_template_hotkeys();
    else tpl.command_handler?.add_template_hotkey?.(null, template);
    await (tpl.save_settings?.() ?? tpl.saveSettings?.());
  } catch (e) { console.error(e); }
  return true;
}

/** True when this Obsidian exposes the snippet manager we can switch snippets with (it is private API and may go away). */
export const cssSnippetsSupported = (app: App): boolean =>
  typeof priv(app).customCss?.setCssEnabledStatus === "function" && priv(app).customCss?.enabledSnippets instanceof Set;

/** Whether a snippet is switched on. `undefined` when we can't tell. Name with or without ".css". */
export const isCssSnippetEnabled = (app: App, name: string): boolean | undefined =>
  cssSnippetsSupported(app) ? priv(app).customCss?.enabledSnippets?.has(name.replace(/\.css$/, "")) : undefined;

/** Turns CSS snippets on and off. Names are snippet file names, with or without ".css". */
export async function setCssSnippets(app: App, enable: string[], disable: string[]): Promise<void> {
  const css = priv(app).customCss;
  if (!css) return;
  await css.requestLoadSnippets?.();
  for (const s of enable) css.setCssEnabledStatus?.(s.replace(/\.css$/, ""), true);
  for (const s of disable) css.setCssEnabledStatus?.(s.replace(/\.css$/, ""), false);
}


/** Templater's folder templates (folder → template), or [] without Templater. Reads only. */
export const templaterFolderTemplates = (app: App): { folder: string; template: string }[] =>
  (templater(app)?.settings?.folder_templates ?? []).map(e => ({ folder: e?.folder ?? "", template: e?.template ?? "" }));

/** Adds a folder template. Adds only: a folder that has an entry keeps it. True when added. ("Trigger Templater on new file creation", which folder templates need, is stored per device by Templater: the user turns it on.) */
export async function addTemplaterFolderTemplate(app: App, folder: string, template: string): Promise<boolean> {
  const tpl = templater(app);
  if (!tpl?.settings) return false;
  const list = tpl.settings.folder_templates ??= [];
  if (list.some(e => e?.folder === folder)) return false;
  // Templater keeps an empty first row for its settings page; fill that instead of adding a second one
  const blank = list.find(e => !e?.folder && !e?.template);
  if (blank) { blank.folder = folder; blank.template = template; } else list.push({ folder, template });
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
  return true;
}

/** True when this Obsidian exposes the hotkey manager we can read hotkeys from (private API). */
export const hotkeysSupported = (app: App): boolean => typeof priv(app).hotkeyManager?.customKeys === "object";

/** True when this Obsidian lets a hotkey be set from code (`hotkeyManager.setHotkeys`, private). */
export const hotkeysWritable = (app: App): boolean => hotkeysSupported(app) && typeof priv(app).hotkeyManager?.setHotkeys === "function";

/**
 * Gives commands a hotkey, the way Settings → Hotkeys does (`hotkeyManager.setHotkeys`, then `save` and `bake`; private API). Only called from
 * Set the suggested keys, after the user confirmed the list; the caller passes only commands that have no key. Returns how many were set.
 */
export async function setHotkeys(app: App, keys: { id: string; key: KitHotkey }[]): Promise<number> {
  const hm = priv(app).hotkeyManager;
  if (!hm?.setHotkeys) return 0;
  let n = 0;
  for (const k of keys) {
    try { hm.setHotkeys(k.id, [{ modifiers: [...k.key.modifiers], key: k.key.key }]); n++; } catch (e) { console.error(e); }
  }
  try { await hm.save?.(); hm.bake?.(); } catch (e) { console.error(e); }
  return n;
}

/** The hotkeys in use, per command id: your own hotkeys where set, else Obsidian's defaults. {} when unknown. */
export function hotkeysInUse(app: App): Record<string, KitHotkey[]> {
  const hm = priv(app).hotkeyManager;
  return { ...(hm?.defaultKeys ?? {}), ...(hm?.customKeys ?? {}) };
}

/** Every registered command, id → name (`app.commands`, private). {} when unknown. */
export function commandNames(app: App): Record<string, string> {
  const cmds = (app as unknown as { commands?: { commands?: Record<string, { name?: string }> } }).commands?.commands ?? {};
  return Object.fromEntries(Object.entries(cmds).map(([id, c]) => [id, c?.name ?? id]));
}

/** Runs a command by id (`app.commands.executeCommandById`, private): for Go to links that name a command. False when it can't. */
export function runCommand(app: App, id: string): boolean {
  const cmds = (app as unknown as { commands?: { executeCommandById?: (id: string) => boolean } }).commands;
  return !!cmds?.executeCommandById?.(id);
}

/**
 * Runs `write` while Templater ignores new files at `paths`. With "Trigger Templater on new file creation" on, Templater runs the code in every
 * new note outside its template folder, so a kit template written there would be run (forms popping up, the file changed). Templater skips
 * paths in its `files_with_pending_templates` set (private) and looks 300 ms after a file appears, so the paths stay in the set a little longer.
 * Without that set (older Templater) it just writes.
 */
export async function withoutTemplaterTrigger<T>(app: App, paths: string[], write: () => Promise<T>): Promise<T> {
  const pending = templater(app)?.templater?.files_with_pending_templates;
  if (!(pending instanceof Set)) return write();
  const added = paths.filter(p => !pending.has(p));
  for (const p of added) pending.add(p);
  try { return await write(); }
  finally { window.setTimeout(() => { for (const p of added) pending.delete(p); }, 3000); }
}

/** Templater's "Template matching mode" (`none`, `folder`, `regex`), or undefined without Templater. */
export const templaterMatchingMode = (app: App): string | undefined => templater(app)?.settings?.trigger_on_file_creation_mode;
/** Templater's startup templates (vault paths), or []. */
export const templaterStartupTemplates = (app: App): string[] => (templater(app)?.settings?.startup_templates ?? []).filter(t => typeof t === "string");

/** Sets Templater's matching mode to Folder templates, only when it is None (a mode the user chose is kept). True when changed. */
export async function setTemplaterFolderMode(app: App): Promise<boolean> {
  const tpl = templater(app);
  if (!tpl?.settings || (tpl.settings.trigger_on_file_creation_mode ?? "none") !== "none") return false;
  tpl.settings.trigger_on_file_creation_mode = "folder";
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
  return true;
}

/** Removes one entry from Templater's startup templates (the others stay). True when removed. */
export async function removeTemplaterStartup(app: App, template: string): Promise<boolean> {
  const tpl = templater(app);
  const list = tpl?.settings?.startup_templates;
  if (!tpl?.settings || !list?.includes(template)) return false;
  tpl.settings.startup_templates = list.filter(t => t !== template);
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
  return true;
}

/** Templater's startup templates, folder templates and template hotkeys as paths, or undefined without Templater. */
export function templaterPaths(app: App): { startup: string[]; folders: { folder: string; template: string }[]; hotkeys: string[] } | undefined {
  const st = templater(app)?.settings;
  if (!st) return undefined;
  return {
    startup: (st.startup_templates ?? []).filter((t): t is string => typeof t === "string"),
    folders: (st.folder_templates ?? []).map(e => ({ folder: e?.folder ?? "", template: e?.template ?? "" })),
    hotkeys: (st.enabled_templates_hotkeys ?? []).map(h => typeof h === "string" ? h : h?.template ?? "").filter(Boolean),
  };
}

/** The saved value of one Templater / Meta Bind setting as JSON text (for a backup before it is changed). "" when the plugin isn't there. */
export function settingSnapshot(app: App, target: "templater-startup" | "templater-folder" | "templater-hotkey" | "metabind-button"): string {
  const st = templater(app)?.settings;
  const value = target === "templater-startup" ? st?.startup_templates : target === "templater-folder" ? st?.folder_templates
    : target === "templater-hotkey" ? st?.enabled_templates_hotkeys : pluginOf(app, META_BIND)?.settings?.buttonTemplates;
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

/**
 * Changes one Templater path that still equals `from` (startup / hotkey: the entry; folder: the template of the entry for folder `key`) and saves.
 * Null when done, else why not. Hotkeys: Templater registers a command per template, so its table is rebuilt after the change (private API, not checked against a real install).
 */
export async function setTemplaterPath(app: App, target: "templater-startup" | "templater-folder" | "templater-hotkey", key: string, from: string, to: string): Promise<string | null> {
  const tpl = templater(app);
  if (!tpl?.settings) return "Templater is not available";
  const st = tpl.settings;
  if (target === "templater-startup") {
    if (!st.startup_templates?.includes(from)) return "the setting changed since the scan";
    st.startup_templates = st.startup_templates.map(t => t === from ? to : t);
  } else if (target === "templater-folder") {
    const e = st.folder_templates?.find(x => x?.folder === key && x?.template === from);
    if (!e) return "the setting changed since the scan";
    e.template = to;
  } else {
    const list = st.enabled_templates_hotkeys, hit = (h: string | { template?: string }): boolean => (typeof h === "string" ? h : h?.template) === from;
    if (!list?.some(hit)) return "the setting changed since the scan";
    st.enabled_templates_hotkeys = list.map(h => !hit(h) ? h : typeof h === "string" ? to : { ...h, template: to });
  }
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
  if (target === "templater-hotkey") { try { tpl.command_handler?.sync_template_hotkeys?.(); } catch (e) { console.error(e); } }
  return null;
}

interface SettingsPlugin { settings?: Record<string, unknown>; saveSettings?: () => Promise<void>; saveData?: (data: unknown) => Promise<void> }
/** Saves another plugin's settings: its own saveSettings, else Obsidian's saveData with its settings object (Dataview has no saveSettings, not checked). */
async function saveOther(p: SettingsPlugin): Promise<void> {
  try { await (p.saveSettings ? p.saveSettings() : p.saveData?.(p.settings)); } catch (e) { console.error(e); }
}
const pluginOf = (app: App, id: string): SettingsPlugin | undefined => priv(app).plugins?.plugins?.[id] as SettingsPlugin | undefined;

const META_BIND = "obsidian-meta-bind-plugin";
/** Ids of Meta Bind's button templates, or null without Meta Bind. */
export const metaBindButtonIds = (app: App): string[] | null => {
  const list = pluginOf(app, META_BIND)?.settings?.buttonTemplates;
  return Array.isArray(list) ? list.map(b => (b as { id?: string })?.id ?? "").filter(id => id) : null;
};
/** Meta Bind's button templates (id and actions), or null without Meta Bind. */
export const metaBindButtons = (app: App): { id: string; actions: { type?: string; command?: string; templateFile?: string }[] }[] | null => {
  const list = pluginOf(app, META_BIND)?.settings?.buttonTemplates;
  return Array.isArray(list) ? list.map(b => ({ id: (b as { id?: string })?.id ?? "", actions: ((b as { actions?: unknown[] })?.actions ?? []) as { type?: string }[] })).filter(b => b.id) : null;
};
/** Replaces the actions of button template `id` while they still equal `from` (compared as JSON), keeping the button's other fields, and saves. Null when done, else why not. */
export async function setMetaBindActions(app: App, id: string, from: unknown, to: unknown): Promise<string | null> {
  const mb = pluginOf(app, META_BIND);
  const list = mb?.settings?.buttonTemplates;
  if (!mb?.settings || !Array.isArray(list)) return "Meta Bind is not available";
  const b = list.find(x => (x as { id?: string })?.id === id) as { actions?: unknown } | undefined;
  if (!b || JSON.stringify(b.actions) !== JSON.stringify(from)) return "the setting changed since the scan";
  b.actions = structuredClone(to);
  await saveOther(mb);
  return null;
}
/** Adds button templates whose id Meta Bind doesn't have yet (the user's own stay as they are) and saves. Number added. */
export async function addMetaBindButtons(app: App, buttons: { id: string }[]): Promise<number> {
  const mb = pluginOf(app, META_BIND);
  const list = mb?.settings?.buttonTemplates;
  if (!mb?.settings || !Array.isArray(list)) return 0;
  const have = new Set(list.map(b => (b as { id?: string })?.id));
  const add = buttons.filter(b => !have.has(b.id)).map(b => structuredClone(b));
  if (!add.length) return 0;
  mb.settings.buttonTemplates = [...(list as unknown[]), ...add];
  await saveOther(mb);
  return add.length;
}

/** Puts the kit's actions on the installed buttons of the same id whose actions differ (label, icon and style stay as they are) and saves. Number changed. */
export async function resetMetaBindActions(app: App, buttons: { id: string; actions?: unknown }[]): Promise<number> {
  const mb = pluginOf(app, META_BIND);
  const list = mb?.settings?.buttonTemplates;
  if (!mb?.settings || !Array.isArray(list)) return 0;
  let n = 0;
  for (const kit of buttons) {
    const b = list.find(x => (x as { id?: string })?.id === kit.id) as { actions?: unknown } | undefined;
    if (!b || kit.actions === undefined || !actionsDiffer(kit.actions, b.actions)) continue;
    b.actions = structuredClone(kit.actions);
    n++;
  }
  if (n) await saveOther(mb);
  return n;
}

const ZOTLIT = "zotlit";
const zotlitFile = (app: App): string => `${app.vault.configDir}/plugins/${ZOTLIT}/data.json`;
/** ZotLit's saved settings (its data.json, read as a file): the parsed object, null when it has none yet, "unreadable" when it isn't JSON. */
export async function readZotlitData(app: App): Promise<Record<string, unknown> | null | "unreadable"> {
  const path = zotlitFile(app);
  try {
    if (!(await app.vault.adapter.exists(path))) return null;
    const parsed: unknown = JSON.parse(await app.vault.adapter.read(path));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : "unreadable";
  } catch { return "unreadable"; }
}
/** Writes ZotLit's settings file and turns ZotLit off and on again so it reads them (it only reads the file when it starts). Always turns it back on. */
export async function writeZotlitData(app: App, data: Record<string, unknown>): Promise<void> {
  const plugins = priv(app).plugins;
  const loaded = !!plugins?.plugins?.[ZOTLIT];
  if (loaded) await plugins?.disablePlugin(ZOTLIT);
  try { await app.vault.adapter.write(zotlitFile(app), JSON.stringify(data, null, 2)); }
  finally { if (loaded) await plugins?.enablePlugin(ZOTLIT); }
}

/** Opens Obsidian's settings on a plugin's tab (`app.setting`, private). False when it can't. */
export function openPluginSettings(app: App, id: string): boolean {
  const setting = (app as unknown as { setting?: { open?: () => void; openTabById?: (id: string) => void } }).setting;
  if (!setting?.open || !setting.openTabById) return false;
  setting.open();
  setting.openTabById(id);
  return true;
}

/**
 * Which of Obsidian's core plugins are on (`app.internalPlugins`, private). Only the ids Obsidian lists are in the answer, so an id this version
 * doesn't know reads as "can't tell", never as off. null when the list itself can't be read.
 */
export function corePluginsOn(app: App, ids: string[]): Record<string, boolean> | null {
  const all = priv(app).internalPlugins?.plugins;
  if (!all || typeof all !== "object") return null;
  const out: Record<string, boolean> = {};
  for (const id of ids) if (all[id] && typeof all[id].enabled === "boolean") out[id] = all[id].enabled;
  return out;
}
/** The core Daily notes plugin's New file location and Date format (`instance.options`, private; empty = Obsidian's defaults). null when they can't be read. */
export function dailyNotesOptions(app: App): { folder: string; format: string } | null {
  const o = priv(app).internalPlugins?.plugins?.["daily-notes"]?.instance?.options;
  if (!o || typeof o !== "object") return null;
  const text = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/^\/+|\/+$/g, "") : "");
  return { folder: text(o.folder), format: text(o.format) };
}
/** Dataview's "Enable inline queries" (`settings.enableInlineDataview`, another plugin's settings). null when Dataview isn't loaded or has no such setting. */
export function dataviewInlineQueries(app: App): boolean | null {
  const v = (priv(app).plugins?.plugins?.dataview as { settings?: { enableInlineDataview?: unknown } } | undefined)?.settings?.enableInlineDataview;
  return typeof v === "boolean" ? v : null;
}
/**
 * The type Obsidian has assigned to each property: null for a property with none. Read from the vault's `types.json` (what Settings → Properties
 * saves: `{ "types": { "due": "date" } }`), because the manager's read call differs between Obsidian versions (`getAssignedType` was not there
 * in 1.14, seen by the user 2026-10-13). A vault with no such file has no types assigned. null when the file is there but can't be read.
 */
export async function propertyTypes(app: App, names: string[]): Promise<Record<string, string | null> | null> {
  const path = `${app.vault.configDir}/types.json`;
  try {
    if (!(await app.vault.adapter.exists(path))) return Object.fromEntries(names.map(n => [n, null]));
    const types = (JSON.parse(await app.vault.adapter.read(path)) as { types?: Record<string, unknown> } | null)?.types;
    if (!types || typeof types !== "object") return null;
    const lower = new Map(Object.entries(types).map(([k, v]) => [k.toLowerCase(), v]));
    return Object.fromEntries(names.map(n => { const t = lower.get(n.toLowerCase()); return [n, typeof t === "string" ? t : null]; }));
  } catch (e) { console.error(e); return null; }
}
/** The type the manager reports for a property (`metadataTypeManager.getAssignedType`, private). undefined when this Obsidian has no such call. */
export function assignedType(app: App, name: string): string | null | undefined {
  const m = priv(app).metadataTypeManager;
  if (typeof m?.getAssignedType !== "function") return undefined;
  try { return m.getAssignedType(name); } catch (e) { console.error(e); return undefined; }
}
/** Gives a property a type unless the manager already reports it (kit templates call this through `window.vtEnsureType`). True when the type was set, false when it was already right, missing or failed (the property then stays as it is). */
export async function ensurePropertyType(app: App, name: string, type: string): Promise<boolean> {
  if (assignedType(app, name) === type) return false;
  return setPropertyType(app, name, type);
}
/** Sets a property's type (as Settings → Properties does). False when this Obsidian has no such call or it fails. */
export async function setPropertyType(app: App, name: string, type: string): Promise<boolean> {
  const m = priv(app).metadataTypeManager;
  if (!m?.setType) return false;
  try { await m.setType(name, type); return true; } catch (e) { console.error(e); return false; }
}

interface VaultConfig { getConfig?: (key: string) => unknown; setConfig?: (key: string, value: unknown) => void }
/** Settings → Editor → Properties in document (`propertiesInDocument`: visible / hidden / source, `app.vault.getConfig`, private). undefined when unknown. */
export function propertiesInDocument(app: App): string | undefined {
  const v = (app.vault as unknown as VaultConfig).getConfig?.("propertiesInDocument");
  return typeof v === "string" ? v : undefined;
}
/** Settings → Files & links → Automatically update internal links (`alwaysUpdateLinks`, `app.vault.getConfig`, private). Obsidian leaves the key out until it is switched on, so a missing key means off. undefined when Obsidian has no getConfig. */
export function alwaysUpdateLinks(app: App): boolean | undefined {
  const vault = app.vault as unknown as VaultConfig;
  if (typeof vault.getConfig !== "function") return undefined;
  return vault.getConfig("alwaysUpdateLinks") === true;
}
/** Switches Automatically update internal links on. False when Obsidian has no setConfig. */
export function setAlwaysUpdateLinks(app: App): boolean {
  const vault = app.vault as unknown as VaultConfig;
  if (!vault.setConfig) return false;
  vault.setConfig("alwaysUpdateLinks", true);
  return true;
}
/** Sets Properties in document to Hidden. False when Obsidian has no setConfig. */
export function hidePropertiesInDocument(app: App): boolean {
  const vault = app.vault as unknown as VaultConfig;
  if (!vault.setConfig) return false;
  vault.setConfig("propertiesInDocument", "hidden");
  return true;
}

const NOTEBOOK_NAVIGATOR = "notebook-navigator";
interface NavigatorPlugin { settings?: { homepage?: unknown }; saveSettingsAndUpdate?: () => Promise<void>; saveSettings?: () => Promise<void>; saveData?: (d: unknown) => Promise<void> }
/** Notebook Navigator's homepage (`settings.homepage`: { source: none / file / daily-note…, file }; older versions: a path string). null without the plugin. */
export function navigatorHomepage(app: App): { source: string; file: string | null } | null {
  const nn = priv(app).plugins?.plugins?.[NOTEBOOK_NAVIGATOR] as NavigatorPlugin | undefined;
  if (!nn?.settings) return null;
  const h = nn.settings.homepage;
  if (typeof h === "string") return h ? { source: "file", file: h } : { source: "none", file: null };
  const o = (h ?? {}) as { source?: unknown; file?: unknown };
  return { source: typeof o.source === "string" ? o.source : "none", file: typeof o.file === "string" ? o.file : null };
}
/** Sets Notebook Navigator's homepage to `path`, only when it has none (a homepage you chose is kept), and saves. True when set. */
export async function setNavigatorHomepage(app: App, path: string): Promise<boolean> {
  const nn = priv(app).plugins?.plugins?.[NOTEBOOK_NAVIGATOR] as NavigatorPlugin | undefined;
  const cur = navigatorHomepage(app);
  if (!nn?.settings || !cur || cur.source !== "none") return false;
  const old = nn.settings.homepage;
  nn.settings.homepage = typeof old === "object" && old !== null ? { ...old, source: "file", file: path } : { source: "file", file: path, createMissingPeriodicNote: true };
  try { await (nn.saveSettingsAndUpdate ? nn.saveSettingsAndUpdate() : nn.saveSettings ? nn.saveSettings() : nn.saveData?.(nn.settings)); } catch (e) { console.error(e); }
  return true;
}
