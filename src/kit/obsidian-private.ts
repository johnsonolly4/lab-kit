// The only place that touches Obsidian's private APIs (not in the public typings, may change between versions):
// other plugins' settings (`app.plugins`) and the CSS snippet manager (`app.customCss`).
import type { App, TFile, TFolder } from "obsidian";

interface TemplaterPlugin {
  settings?: { user_scripts_folder?: string; templates_folder?: string; enabled_templates_hotkeys?: (string | { template?: string })[];
    trigger_on_file_creation?: boolean; enable_folder_templates?: boolean; folder_templates?: { folder?: string; template?: string }[] };
  command_handler?: { sync_template_hotkeys?: () => void; add_template_hotkey?: (old: string | null, template: string) => void };
  templater?: { create_new_note_from_template?: (template: TFile, folder?: TFolder, filename?: string, open?: boolean) => Promise<TFile | undefined> };
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
    setHotkeys?: (command: string, keys: KitHotkey[]) => void;
    save?: () => Promise<void> | void;
  };
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

/** Names the kit manifests use for other plugins (`needs: "plugin:<name>"`), by the plugin ids they may have. ZotLit's id is not checked against a real install. */
const PLUGIN_ALIASES: Record<string, string[]> = { zotlit: ["zotlit", "obsidian-zotero-desktop-connector"] };
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
export async function templaterCreateNote(app: App, template: TFile, folder: TFolder, open = true): Promise<boolean> {
  const create = templater(app)?.templater?.create_new_note_from_template;
  if (typeof create !== "function") return false;
  await create.call(templater(app)?.templater, template, folder, undefined, open);
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

/** Adds a folder template and turns on "Trigger Templater on new file creation" (needed for folder templates). Adds only: a folder that has an entry keeps it. True when added. */
export async function addTemplaterFolderTemplate(app: App, folder: string, template: string): Promise<boolean> {
  const tpl = templater(app);
  if (!tpl?.settings) return false;
  const list = tpl.settings.folder_templates ??= [];
  if (list.some(e => e?.folder === folder)) return false;
  // Templater keeps an empty first row for its settings page; fill that instead of adding a second one
  const blank = list.find(e => !e?.folder && !e?.template);
  if (blank) { blank.folder = folder; blank.template = template; } else list.push({ folder, template });
  tpl.settings.trigger_on_file_creation = true;
  if (tpl.settings.enable_folder_templates === false) tpl.settings.enable_folder_templates = true;
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
  return true;
}

/** True when this Obsidian exposes the hotkey manager we can read and set hotkeys with (private API). */
export const hotkeysSupported = (app: App): boolean => typeof priv(app).hotkeyManager?.setHotkeys === "function";

/** The hotkeys in use, per command id: your own hotkeys where set, else Obsidian's defaults. {} when unknown. */
export function hotkeysInUse(app: App): Record<string, KitHotkey[]> {
  const hm = priv(app).hotkeyManager;
  return { ...(hm?.defaultKeys ?? {}), ...(hm?.customKeys ?? {}) };
}

/** Adds `key` to a command's own hotkeys (keeps the ones it has) and saves. False when the hotkey manager isn't there. */
export async function addHotkey(app: App, command: string, key: KitHotkey): Promise<boolean> {
  const hm = priv(app).hotkeyManager;
  if (!hm?.setHotkeys) return false;
  const own = hm.customKeys?.[command] ?? hm.defaultKeys?.[command] ?? [];
  hm.setHotkeys(command, [...own, key]);
  try { await hm.save?.(); } catch (e) { console.error(e); }
  return true;
}

/** Every registered command, id → name (`app.commands`, private). {} when unknown. */
export function commandNames(app: App): Record<string, string> {
  const cmds = (app as unknown as { commands?: { commands?: Record<string, { name?: string }> } }).commands?.commands ?? {};
  return Object.fromEntries(Object.entries(cmds).map(([id, c]) => [id, c?.name ?? id]));
}
