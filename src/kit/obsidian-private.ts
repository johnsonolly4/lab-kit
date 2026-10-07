// The only place that touches Obsidian's private APIs (not in the public typings, may change between versions):
// other plugins' settings (`app.plugins`) and the CSS snippet manager (`app.customCss`).
import type { App, TFile, TFolder } from "obsidian";

interface TemplaterPlugin {
  settings?: { user_scripts_folder?: string; templates_folder?: string; enabled_templates_hotkeys?: (string | { template?: string })[] };
  command_handler?: { sync_template_hotkeys?: () => void; add_template_hotkey?: (old: string | null, template: string) => void };
  templater?: { create_new_note_from_template?: (template: TFile, folder?: TFolder, filename?: string, open?: boolean) => Promise<TFile | undefined> };
  save_settings?: () => Promise<void>;
  saveSettings?: () => Promise<void>;
}
interface PrivateApp {
  plugins?: {
    plugins?: Record<string, unknown>;
    disablePlugin(id: string): Promise<void>;
    enablePlugin(id: string): Promise<void>;
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

