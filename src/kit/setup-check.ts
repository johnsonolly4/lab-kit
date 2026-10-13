// Setup check (Phase 6): what the kits need from other plugins, Templater, CSS snippets, folders and hotkeys, as a list of ok / missing items.
// Pure: the caller reads the vault and Obsidian into a SetupState; each missing item carries a fix the settings UI carries out after a confirmation.
import type { KitHotkey } from "./obsidian-private";
import type { ZotlitScan } from "./zotlit";
import { RIGS_DEFAULT, todoFolder, type PlanningFolders } from "./paths";
import { actionsDiffer } from "../planning/buttons";

/** Planning folder templates (folder → template file name in the kit's templates folder), from the planning kit's Templater settings. */
export const planningFolderTemplates = (f: PlanningFolders): { folder: string; file: string }[] => [
  { folder: f.daily, file: "Daily note.md" },
  { folder: todoFolder(f), file: "To-do.md" },
];

/**
 * The lab kit's folder templates: a note made by hand in the Lab notes folder starts the Lab Book Template, one in the Chemical folder the
 * Chemical database template. A folder whose setting is empty has none.
 */
export const labFolderTemplates = (labFolder: string, chemicalFolder = ""): { folder: string; file: string }[] => [
  ...(labFolder.trim() ? [{ folder: labFolder.trim(), file: "Lab Book Template.md" }] : []),
  ...(chemicalFolder.trim() ? [{ folder: chemicalFolder.trim(), file: "Chemical database template.md" }] : []),
];

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

/** The old roll-over startup template (replaced by the plugin's to-do engine). */
export const OLD_ROLLOVER = "Actions/To-do roll-over.md";

export interface SetupState {
  /** Lab Kit's own settings the kits read. */
  lab: { initials: string; dataRoot: boolean; methodsFolder: string; rigsFolder: string; rigsFolderMissing?: boolean; labFolder: string; chemicalFolder: string };
  /** Meta Bind button templates the planning kit uses; null without Meta Bind. */
  metaBind: { missing: number; total: number; /** Ids of the missing buttons, for the row's text. */ names?: string[] } | null;
  /** Meta Bind buttons that exist but do something else than the kit's button of that id (see `differingButtons`). */
  metaBindDiffers?: { id: string; now: string; kit: string }[];
  /** ZotLit's frontmatter fields and folders against the kit's (see `zotlitScan`); null when ZotLit has no settings file or it can't be read. */
  zotlitData?: ZotlitScan | null;
  /** Path of the "Set up ZotLit" checklist note when it is installed. */
  zotlitGuide: string | null;
  /** Obsidian's Properties in document (visible / hidden / source); undefined when it can't be read. */
  propertiesView?: string;
  /** Notebook Navigator's homepage (null without the plugin) and the planning kit's homepage note. */
  navigator?: { homepage: { source: string; file: string | null } | null; home: string };
  /** Loaded plugin ids (plus kit names such as `zotlit`). */
  plugins: ReadonlySet<string>;
  planning: boolean;
  templater: { templatesFolder: string; userScriptsFolder: string; menuHotkey: boolean; folderTemplates: { folder: string; template: string }[]; matchingMode?: string; startupTemplates?: string[] };
  /** The kits' Templater user scripts (tp.user.<name>): `exists` is false when the file isn't where the kit put it. */
  scripts?: { name: string; kit: "lab" | "planning"; exists: boolean }[];
  /** The homepage note's `obsidianUIMode` (Force note view mode reads it); null when the note isn't there. */
  homepageMode?: string | null;
  /** Path of the installed Insert snippet template; null when the lab kit isn't installed. */
  menu: string | null;
  /** Kit installed (has tracked files), per kit. */
  installed: { lab: boolean; planning: boolean };
  /** The kits' CSS snippets; `enabled` undefined when Obsidian can't tell. */
  css: { name: string; enabled: boolean | undefined }[];
  /** Folders the kits expect. */
  /** `setting`: the folder is named in a folder setting (a missing one was most likely moved outside Obsidian: Find moved folders). */
  folders: { path: string; exists: boolean; setting?: boolean }[];
  /** Folder templates the kits want (folder → template path); `kit` defaults to planning. */
  folderTemplates: { folder: string; template: string; kit?: "lab" | "planning" }[];
  /** Meeting series hubs (`kind: meeting-series`) in the meetings folder; `error` names the field that is wrong; `deck` = a deck path is set for this computer. */
  meetings?: { name: string; path: string; error?: string; deck: boolean }[];
  /** Kit files you keep as your own that the kit has a newer text for (paths); undefined until counted. */
  newerKit?: string[];
}

export type SetupFix =
  | { kind: "plugin"; id: string }
  | { kind: "install"; kit: "lab" | "planning" }
  | { kind: "templater" }
  | { kind: "css"; names: string[] }
  | { kind: "folder"; path: string }
  | { kind: "find-moved" }
  | { kind: "folder-template"; folder: string; template: string }
  | { kind: "settings" }
  | { kind: "methods-folder"; path: string }
  | { kind: "rigs-folder"; path: string }
  | { kind: "hide-properties" }
  | { kind: "navigator-home"; path: string }
  | { kind: "matching-mode" }
  | { kind: "startup-remove"; template: string }
  | { kind: "meta-bind" }
  | { kind: "meta-bind-reset"; ids: string[] }
  | { kind: "open-note"; path: string }
  | { kind: "manage" }
  | { kind: "zotlit-fields" };

/** `warn`: can't be checked (shown with "!"), not counted as something to fix. */
export interface SetupItem { id: string; group: string; label: string; ok: boolean; optional?: boolean; warn?: boolean; detail: string; fix?: SetupFix }

/** Where the Methods folder Fix puts it (the folder contract's default; the setting's own default stays empty). */
export const METHODS_DEFAULT = "Extras/methods";

/** "Alt+S", "Mod+Shift+T": how a hotkey is written in the list. */
export const hotkeyText = (k: KitHotkey): string => [...k.modifiers, k.key].join("+");
export const sameKey = (a: KitHotkey, b: KitHotkey): boolean =>
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
    ["rigs-folder", "Rigs folder", !!l.rigsFolder.trim() && !l.rigsFolderMissing, "Optional: one note per flow rig, made by New rig from the Rig template.", true],
  ];
  const made: Record<string, SetupFix & { path: string }> = { "methods-folder": { kind: "methods-folder", path: METHODS_DEFAULT }, "rigs-folder": { kind: "rigs-folder", path: l.rigsFolder.trim() || RIGS_DEFAULT } };
  for (const [id, label, ok, what, optional] of labRows) {
    const fix: SetupFix | undefined = ok ? undefined : made[id] ?? settings;
    out.push({ id: `lab:${id}`, group: "Lab Kit settings", label, ok, optional, detail: ok ? "Set." : made[id] ? `Not set. ${what} Fix creates ${made[id].path} and uses it.` : `Not set. ${what}`, fix });
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

  if (s.newerKit) {
    const n = s.newerKit;
    out.push({ id: "kit:newer", group: "Kit files", label: "Kept files with a newer kit version", ok: !n.length, optional: true,
      detail: n.length ? `${n.length} ${n.length === 1 ? "file has" : "files have"} a newer kit version than your copy: ${n.join(", ")}. Manage files has Compare… and Use kit version… on each; nothing changes by itself.` : "None: every file you kept is current with the kit.",
      fix: n.length ? { kind: "manage" } : undefined });
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
      out.push({ id: `templater:${id}`, group: "Templater", label, ok, detail: ok ? "Set." : s.menu ? "Not set. Fix fills in only what is empty." : "Not set. Install the lab kit first, then Fix runs Set up.",
        fix: ok || !s.menu ? undefined : { kind: "templater" } });
    }
    for (const sc of s.scripts ?? []) {
      if (!kitOn(sc.kit)) continue;
      const installed = s.installed[sc.kit];
      out.push({ id: `script:${sc.name}`, group: "Templater", label: `Script ${sc.name}`, ok: sc.exists,
        detail: sc.exists ? "There." : installed ? "Missing. Review update… in Settings → Lab Kit puts it back." : `Missing. Install the ${sc.kit} kit first.`,
        fix: sc.exists || installed ? undefined : { kind: "install", kit: sc.kit } });
    }
    for (const ft of s.folderTemplates) {
      const kit = ft.kit ?? "planning";
      if (kit === "planning" && !s.planning) continue;
      const installed = s.installed[kit];
      const have = t.folderTemplates.find(e => e.folder === ft.folder);
      const ok = !!have;
      out.push({ id: `folder-template:${ft.folder}`, group: "Templater", label: `Folder template for ${ft.folder}`, ok,
        detail: have ? (have.template === ft.template ? "Set." : `Set to ${have.template} (yours, left as it is).`) : installed ? `Not set. Adds ${ft.template}.` : `Not set. Install the ${kit} kit first (its template isn't there yet).`,
        fix: ok || !installed ? undefined : { kind: "folder-template", folder: ft.folder, template: ft.template } });
    }
  }

  if ((s.planning || s.folderTemplates.some(f => f.kit === "lab")) && s.plugins.has("templater-obsidian")) {
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

  const nav = s.navigator;
  if (s.planning && nav?.homepage) {
    const h = nav.homepage, ok = h.source === "file" && h.file === nav.home;
    out.push({ id: "navigator:homepage", group: "Notebook Navigator", label: `Homepage: ${nav.home}`, ok,
      detail: ok ? "Set." : h.source === "none" ? "No homepage set. Fix makes the kit's homepage open at startup."
        : `Set to ${h.source === "file" ? h.file ?? "a file" : h.source} (yours, left as it is).`,
      fix: h.source === "none" ? { kind: "navigator-home", path: nav.home } : undefined });
  }

  if (s.planning && s.plugins.has("obsidian-view-mode-by-frontmatter") && s.homepageMode !== undefined && s.navigator) {
    const ok = s.homepageMode === "preview";
    out.push({ id: "viewmode:homepage", group: "Notebook Navigator", label: "Homepage opens read-only", ok,
      detail: s.homepageMode === null ? "The homepage note isn't there yet." : ok ? "Set (obsidianUIMode: preview)."
        : `obsidianUIMode is ${s.homepageMode || "empty"}, so a click can edit the homepage. Open it and set obsidianUIMode to preview.`,
      fix: s.homepageMode === null ? undefined : ok ? undefined : { kind: "open-note", path: s.navigator.home } });
  }

  if (s.planning && s.metaBind) {
    const { missing, total, names } = s.metaBind;
    out.push({ id: "metabind:buttons", group: "Meta Bind", label: "Meta Bind buttons", ok: !missing,
      detail: missing ? `${missing} of ${total} buttons the planning notes use are missing${names?.length ? ` (${names.join(", ")})` : ""}. Fix adds them (buttons you have are never changed); then restart Obsidian, because Meta Bind loads its buttons at start-up.` : `All ${total} there. A note that still shows "Button ID not Found": restart Obsidian, Meta Bind loads its buttons at start-up.`,
      fix: missing ? { kind: "meta-bind" } : undefined });
  }

  if (s.planning && s.metaBind && s.metaBindDiffers) {
    const d = s.metaBindDiffers;
    out.push({ id: "metabind:differs", group: "Meta Bind", label: "Meta Bind buttons that differ from the kit", ok: !d.length,
      detail: d.length ? `${d.map(b => `${b.id} ${b.now} (kit: ${b.kit})`).join("; ")}. Fix puts the kit's action on them (the button's label and look stay); then restart Obsidian.` : "Every button does what the kit's does.",
      fix: d.length ? { kind: "meta-bind-reset", ids: d.map(b => b.id) } : undefined });
  }

  if (s.planning && s.plugins.has("zotlit") && s.zotlitData?.readable) {
    const z = s.zotlitData;
    const bits = [...z.missing.map(f => `${f.key} is missing`), ...z.differing.map(f => `${f.key} differs (yours: ${f.now}; kit: ${f.kit})`)];
    out.push({ id: "zotlit:fields", group: "ZotLit", label: "ZotLit frontmatter fields", ok: !z.missing.length, warn: !!z.missing.length || undefined,
      detail: bits.length ? `${bits.join("; ")}. Fix adds the missing ones and never changes yours, then turns ZotLit off and on so it reads them.` : "All the kit's fields are there.",
      fix: z.missing.length ? { kind: "zotlit-fields" } : undefined });
    const f = [z.literature === "other" ? "Literature note folder is your own (left alone)" : z.literature === "empty" ? "Literature note folder is not set" : "",
      z.templates === "other" ? "Template folder is your own (left alone)" : z.templates === "empty" ? "Template folder is not set" : ""].filter(Boolean);
    out.push({ id: "zotlit:folders", group: "ZotLit", label: "ZotLit folders", ok: !f.length, warn: !!f.length || undefined,
      detail: f.length ? `${f.join("; ")}.${z.literature === "empty" || z.templates === "empty" ? " Fix (above) sets the empty ones." : ""}` : "ZotLit uses the kit's literature and template folders.",
      fix: !z.missing.length && (z.literature === "empty" || z.templates === "empty") ? { kind: "zotlit-fields" } : undefined });
  } else if (s.planning && s.plugins.has("zotlit")) out.push({ id: "zotlit:settings", group: "ZotLit", label: "ZotLit settings", ok: false, warn: true,
    detail: s.zotlitGuide ? `Lab Kit can't read ZotLit's settings. Check them against the checklist note ${s.zotlitGuide} (Open shows it).`
      : "Lab Kit can't read ZotLit's settings. Install the planning kit (Review update…) to get its checklist note, Set up ZotLit.",
    fix: s.zotlitGuide ? { kind: "open-note", path: s.zotlitGuide } : undefined });

  // Meeting series hubs: a wrong interval / day / start would make New meeting skip the series, so name the field
  if (s.planning) {
    const series = s.meetings ?? [];
    if (!series.length) out.push({ id: "meetings:none", group: "Meetings", label: "Meeting series", ok: true, optional: true,
      detail: "No meeting series yet. The New meeting series command makes one." });
    for (const m of series) {
      const ok = !m.error;
      out.push({ id: `meetings:${m.path}`, group: "Meetings", label: m.name, ok,
        detail: m.error ? `${m.error[0].toUpperCase()}${m.error.slice(1)}. Open the note and correct it.` : "Series is set up.",
        fix: ok ? undefined : { kind: "open-note", path: m.path } });
      if (ok && !m.deck) out.push({ id: `meetings-deck:${m.path}`, group: "Meetings", label: `${m.name}: deck for this computer`, ok: false, warn: true, optional: true,
        detail: "No deck location set for this computer yet (deck_windows / deck_mac: a folder of decks, or the path to one deck file). Only Open meeting deck needs it.", fix: { kind: "open-note", path: m.path } });
    }
  }

  for (const c of s.css) {
    const ok = c.enabled === true;
    out.push({ id: `css:${c.name}`, group: "Appearance", label: `CSS snippet ${c.name}`, ok,
      detail: c.enabled === undefined ? "Can't tell in this Obsidian version: check Settings → Appearance → CSS snippets." : ok ? "On." : "Off.",
      fix: c.enabled === false ? { kind: "css", names: [c.name] } : undefined });
  }

  // A settings folder that is missing after the install was most likely moved outside Obsidian: look for it rather than make it again
  const installed = s.installed.lab || s.installed.planning;
  for (const f of s.folders) {
    const moved = !f.exists && !!f.setting && installed;
    out.push({ id: `folder:${f.path}`, group: "Folders", label: f.path, ok: f.exists,
      detail: f.exists ? "Exists." : moved ? "Missing. Moved outside Obsidian? Find looks for where it went (or makes it again)." : "Missing.",
      fix: f.exists ? undefined : moved ? { kind: "find-moved" } : { kind: "folder", path: f.path } });
  }

  return out;
}

/** What a Meta Bind button does, in words: "opens [[Meetings]]", "runs lab-kit:new-meeting", or "something else". */
export function describeActions(actions: unknown): string {
  if (!Array.isArray(actions) || !actions.length) return "does nothing";
  return actions.map((a: { type?: string; link?: string; command?: string; templateFile?: string }) =>
    a?.type === "open" && a.link ? `opens ${a.link}` : a?.type === "command" && a.command ? `runs ${a.command}` : a?.templateFile ? `runs the template ${a.templateFile}` : "does something else").join(", then ");
}
/** The kit's buttons whose installed button of the same id has other actions (compared as JSON). Missing buttons and your own are not listed. */
export function differingButtons(kit: { id: string; actions?: unknown }[], installed: { id: string; actions?: unknown }[]): { id: string; now: string; kit: string }[] {
  const out: { id: string; now: string; kit: string }[] = [];
  for (const k of kit) {
    const have = installed.find(b => b.id === k.id);
    if (have && k.actions !== undefined && actionsDiffer(k.actions, have.actions)) out.push({ id: k.id, now: describeActions(have.actions), kit: describeActions(k.actions) });
  }
  return out;
}
