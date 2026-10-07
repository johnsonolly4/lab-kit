// Setup check (Phase 6): what the kits need from other plugins, Templater, CSS snippets, folders and hotkeys, as a list of ok / missing items.
// Pure: the caller reads the vault and Obsidian into a SetupState; each missing item carries a fix the settings UI carries out after a confirmation.
import type { KitHotkey } from "./obsidian-private";

/** Plugins the kits use, by plugin id (each id checked against the plugin's manifest.json, 2026-10-07), with what each is for. */
export const SETUP_PLUGINS: { id: string; name: string; kit: "lab" | "planning"; optional?: boolean; alias?: string; why: string }[] = [
  { id: "templater-obsidian", name: "Templater", kit: "lab", why: "Runs the kit's templates and the Alt+S snippet forms." },
  { id: "dataview", name: "Dataview", kit: "lab", why: "Lists and tables in the hub notes." },
  { id: "table-editor-obsidian", name: "Advanced Tables", kit: "lab", optional: true, why: "Tab between table cells and keep tables aligned while you type." },
  { id: "obsidian-meta-bind-plugin", name: "Meta Bind", kit: "planning", why: "The buttons on the homepage and in planning notes." },
  { id: "obsidian-view-mode-by-frontmatter", name: "Force note view mode", kit: "planning", why: "Opens the homepage read-only, so a click can't edit it." },
  { id: "omnisearch", name: "Omnisearch", kit: "planning", why: "Searches the whole vault by content, PDFs included." },
  { id: "notebook-navigator", name: "Notebook Navigator", kit: "planning", why: "The folder and note list, and sets the homepage." },
  { id: "zotlit", name: "ZotLit", kit: "planning", optional: true, why: "Literature notes and annotations from Zotero." },
  { id: "obsidian-outliner", name: "Outliner", kit: "planning", optional: true, why: "Move and fold list items with the keyboard." },
  { id: "editing-toolbar", name: "Editing Toolbar", kit: "planning", optional: true, why: "A formatting toolbar above notes (handy on a phone)." },
  { id: "css-editor", name: "CSS Editor", kit: "planning", optional: true, why: "Edit the vault's CSS snippets inside Obsidian." },
  { id: "advanced-canvas", name: "Advanced Canvas", kit: "planning", optional: true, why: "More shapes and connections in Canvas (for diagrams and plans)." },
];

/** Hotkeys the kits recommend (never set without asking). Two-key rule: one modifier + one key. */
export const SETUP_HOTKEYS: { name: string; key: KitHotkey; kit: "lab" | "planning" }[] = [
  { name: "Insert snippet", key: { modifiers: ["Alt"], key: "S" }, kit: "lab" },
];

/** The old roll-over startup template (replaced by the plugin's to-do engine). */
export const OLD_ROLLOVER = "Actions/To-do roll-over.md";

export interface SetupState {
  /** Lab Kit's own settings the kits read. */
  lab: { initials: string; dataRoot: boolean; methodsFolder: string; labFolder: string; chemicalFolder: string };
  /** Dataview's "Enable JavaScript queries"; null without Dataview. */
  dataviewJs: boolean | null;
  /** Meta Bind button templates the planning kit uses; null without Meta Bind. */
  metaBind: { missing: number; total: number } | null;
  /** Path of the "Set up ZotLit" checklist note when it is installed. */
  zotlitGuide: string | null;
  /** Obsidian's Properties in document (visible / hidden / source); undefined when it can't be read. */
  propertiesView?: string;
  /** Loaded plugin ids (plus kit names such as `zotlit`). */
  plugins: ReadonlySet<string>;
  planning: boolean;
  templater: { templatesFolder: string; userScriptsFolder: string; menuHotkey: boolean; folderTemplates: { folder: string; template: string }[]; matchingMode?: string; startupTemplates?: string[] };
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
  | { kind: "hotkey"; command: string; key: KitHotkey }
  | { kind: "settings" }
  | { kind: "methods-folder"; path: string }
  | { kind: "hide-properties" }
  | { kind: "matching-mode" }
  | { kind: "startup-remove"; template: string }
  | { kind: "dataview-js" }
  | { kind: "meta-bind" }
  | { kind: "open-note"; path: string };

/** `warn`: can't be checked (shown with "!"), not counted as something to fix. */
export interface SetupItem { id: string; group: string; label: string; ok: boolean; optional?: boolean; warn?: boolean; detail: string; fix?: SetupFix }

/** Where the Methods folder Fix puts it (the folder contract's default; the setting's own default stays empty). */
export const METHODS_DEFAULT = "Extras/methods";

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
      detail: ok ? `Installed and on. ${p.why}` : p.optional ? `Optional. ${p.why}` : `Needed. ${p.why} Not installed or turned off: Lab Kit never installs plugins, so open its page and install it.`,
      fix: ok ? undefined : { kind: "plugin", id: p.id } });
  }

  const l = s.lab, settings: SetupFix = { kind: "settings" };
  const labRows: [string, string, boolean, string, boolean?][] = [
    ["initials", "Initials", !!l.initials.trim(), "Used in sample codes (ABC0014-A).", false],
    ["data-root", "Data folder root", l.dataRoot, "Windows or macOS / Linux root, for the header's Data folder button.", false],
    ["lab-folder", "Lab notes folder", !!l.labFolder.trim(), "Where New lab entry puts experiment notes.", false],
    ["chemical-folder", "Chemical folder", !!l.chemicalFolder.trim(), "Your chemical notes, suggested in calc cells and forms.", false],
    ["methods-folder", "Methods folder", !!l.methodsFolder.trim(), "Optional: your own analysis methods next to NMR, GPC and DLS.", true],
  ];
  for (const [id, label, ok, what, optional] of labRows) {
    const fix: SetupFix | undefined = ok ? undefined : id === "methods-folder" ? { kind: "methods-folder", path: METHODS_DEFAULT } : settings;
    out.push({ id: `lab:${id}`, group: "Lab Kit settings", label, ok, optional, detail: ok ? "Set." : id === "methods-folder" ? `Not set. ${what} Fix creates ${METHODS_DEFAULT} and uses it.` : `Not set. ${what}`, fix });
  }

  const pv = s.propertiesView;
  out.push({ id: "obsidian:properties", group: "Obsidian", label: "Properties hidden in notes", ok: pv === "hidden", warn: pv === undefined,
    detail: pv === "hidden" ? "Hidden (open them from the note's menu when you need them)." : pv === undefined
      ? "Can't read it in this Obsidian version: set Settings → Editor → Properties in document to Hidden."
      : `Set to ${pv}. The kit's notes keep their details in properties, which fill the top of every note.`,
    fix: pv && pv !== "hidden" ? { kind: "hide-properties" } : undefined });

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
      out.push({ id: `templater:${id}`, group: "Templater", label, ok, detail: ok ? "Set." : s.menu ? "Not set. Set up fills in only what is empty." : "Not set. Install the lab kit first, then Fix runs Set up.",
        fix: ok || !s.menu ? undefined : { kind: "templater" } });
    }
    if (s.planning) for (const ft of s.folderTemplates) {
      const have = t.folderTemplates.find(e => e.folder === ft.folder);
      const ok = !!have;
      out.push({ id: `folder-template:${ft.folder}`, group: "Templater", label: `Folder template for ${ft.folder}`, ok,
        detail: have ? (have.template === ft.template ? "Set." : `Set to ${have.template} (yours, left as it is).`) : s.installed.planning ? `Not set. Adds ${ft.template}.` : "Not set. Install the planning kit first (its template isn't there yet).",
        fix: ok || !s.installed.planning ? undefined : { kind: "folder-template", folder: ft.folder, template: ft.template } });
    }
  }

  if (s.planning && s.plugins.has("templater-obsidian")) {
    const mode = s.templater.matchingMode ?? "none";
    out.push({ id: "templater:matching-mode", group: "Templater", label: "Template matching mode: Folder templates", ok: mode === "folder",
      detail: mode === "folder" ? "Set." : mode === "none" ? "Set to None, so folder templates never run." : `Set to ${mode} (yours, left as it is); folder templates don't run in this mode.`,
      fix: mode === "none" ? { kind: "matching-mode" } : undefined });
    out.push({ id: "templater:trigger", group: "Templater", label: "Trigger Templater on new file creation", ok: true, optional: true,
      detail: "Needed for folder templates. Templater keeps it per device, so Lab Kit can't read it: check it's on in Templater's settings on each device." });
    const old = (s.templater.startupTemplates ?? []).filter(t => t === OLD_ROLLOVER || t.endsWith("/" + OLD_ROLLOVER));
    const others = (s.templater.startupTemplates ?? []).filter(t => t && !old.includes(t));
    out.push({ id: "templater:startup", group: "Templater", label: "Startup templates", ok: !old.length,
      detail: old.length ? `Lists the old roll-over (${old[0]}). Lab Kit's to-do engine does this now; the old one makes it stand down.`
        : others.length ? `Yours, left as they are: ${others.join(", ")}.` : "None (the to-do roll-over is built into Lab Kit).",
      fix: old.length ? { kind: "startup-remove", template: old[0] } : undefined });
  }

  if (s.planning && s.dataviewJs !== null) out.push({ id: "dataview:js", group: "Dataview", label: "Dataview JavaScript queries", ok: s.dataviewJs,
    detail: s.dataviewJs ? "On." : "Off. Projects overview needs it (inline JavaScript and task tracking aren't needed).", fix: s.dataviewJs ? undefined : { kind: "dataview-js" } });

  if (s.planning && s.metaBind) {
    const { missing, total } = s.metaBind;
    out.push({ id: "metabind:buttons", group: "Meta Bind", label: "Meta Bind buttons", ok: !missing,
      detail: missing ? `${missing} of ${total} buttons the planning notes use are missing. Fix adds them; buttons you have are never changed.` : `All ${total} there.`,
      fix: missing ? { kind: "meta-bind" } : undefined });
  }

  if (s.planning && s.plugins.has("zotlit")) out.push({ id: "zotlit:settings", group: "ZotLit", label: "ZotLit settings", ok: false, warn: true,
    detail: s.zotlitGuide ? `Lab Kit can't read ZotLit's settings. Check them against the checklist note ${s.zotlitGuide} (Open shows it).`
      : "Lab Kit can't read ZotLit's settings. Install the planning kit (Review update…) to get its checklist note, Set up ZotLit.",
    fix: s.zotlitGuide ? { kind: "open-note", path: s.zotlitGuide } : undefined });

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
