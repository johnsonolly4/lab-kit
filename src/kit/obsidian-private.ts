// The only place that touches Obsidian's private APIs (not in the public typings, may change between versions):
// other plugins' settings (`app.plugins`) and the CSS snippet manager (`app.customCss`).
import type { App } from "obsidian";

interface TemplaterPlugin {
  settings?: { user_scripts_folder?: string; templates_folder?: string; enabled_templates_hotkeys?: (string | { template?: string })[] };
  command_handler?: { sync_template_hotkeys?: () => void; add_template_hotkey?: (old: string | null, template: string) => void };
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

/** Templater's settings, or {} when Templater isn't installed. */
export const templaterSettings = (app: App): NonNullable<TemplaterPlugin["settings"]> => templater(app)?.settings ?? {};
export const hasTemplater = (app: App): boolean => !!templater(app);
export const templaterUserScriptsFolder = (app: App): string | undefined => templater(app)?.settings?.user_scripts_folder;

/** Points Templater's "user scripts" folder at `folder` and saves its settings. */
export async function setTemplaterUserScripts(app: App, folder: string): Promise<void> {
  const tpl = templater(app);
  if (!tpl) return;
  tpl.settings = tpl.settings ?? {};
  tpl.settings.user_scripts_folder = folder;
  try { await (tpl.save_settings?.() ?? tpl.saveSettings?.()); } catch (e) { console.error(e); }
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

