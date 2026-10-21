// Setup check (Phase 6): what the kits need from other plugins, Templater, CSS snippets, folders and hotkeys, as a list of ok / missing items.
// Pure: the caller reads the vault and Obsidian into a SetupState; each missing item carries a fix the settings UI carries out after a confirmation.
import type { KitHotkey } from "./obsidian-private";
import type { ZotlitScan } from "./zotlit";
import { METHODS_DEFAULT, RIGS_DEFAULT, todoFolder, type KitData, type PlanningFolders } from "./paths";
import { actionsDiffer } from "../planning/buttons";
import { WIN_MARK } from "./window-look";
import type { ClosedScan } from "../close/scan";

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

/** Lab Kit's folder → template rows (`kit.folderTemplates`): the saved list, else today's rows (the planning rows only while the planning kit is on). */
export const folderTemplateRows = (kit: Pick<KitData, "folderTemplates" | "labFolder" | "chemicalFolder" | "planningFolders">, planningOn: boolean): { folder: string; file: string }[] =>
  kit.folderTemplates ?? [...(planningOn ? planningFolderTemplates(kit.planningFolders) : []), ...labFolderTemplates(kit.labFolder, kit.chemicalFolder)];

/** Plugins the kits use, by plugin id (each id checked against the plugin's manifest.json, 2026-10-07), with what each is for. */
export const SETUP_PLUGINS: { id: string; name: string; kit: "lab" | "planning"; optional?: boolean; alias?: string; why: string }[] = [
  { id: "templater-obsidian", name: "Templater", kit: "lab", why: "Runs the kit's templates and the Alt+S snippet forms." },
  { id: "table-editor-obsidian", name: "Advanced Tables", kit: "lab", optional: true, why: "Tab between table cells and keep tables aligned while you type." },
  { id: "dataview", name: "Dataview", kit: "planning", why: "The lists Lab Kit doesn't draw itself (weekly review, daily notes, Literature, a hub's papers) and the date on the homepage." },
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

/** Obsidian's own (core) plugins the kits use, by their id in Settings → Core plugins. */
export const CORE_PLUGINS: { id: string; name: string; kit: "lab" | "planning"; why: string }[] = [
  { id: "bases", name: "Bases", kit: "lab", why: "The Lab book board, the Chemical database and the to-do board are bases." },
  { id: "daily-notes", name: "Daily notes", kit: "planning", why: "The homepage's Today's note button runs its command." },
];

/** The date format the planning kit's daily notes use (a folder per year), as in the Vault spec. */
export const DAILY_FORMAT = "YYYY/YYYY-MM-DD";

/** Property types the kit's lists and boards rely on (Obsidian keeps them in types.json; the templates set them at first use). */
export const PROPERTY_TYPES: { name: string; type: string; why: string }[] = [
  { name: "due", type: "date", why: "A to-do's due date: the countdown and the overdue lists compare dates." },
  { name: "deadline", type: "date", why: "A project's deadline: counted down like a due date." },
  { name: "priority", type: "number", why: "A to-do's priority: the board sorts on it as a number (1, 2, 3)." },
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
  /** Obsidian's Automatically update internal links; undefined when it can't be read (no row when the planning kit is off). */
  updateLinks?: boolean;
  /** Notebook Navigator's homepage (null without the plugin) and the planning kit's homepage note. */
  navigator?: { homepage: { source: string; file: string | null } | null; home: string };
  /** Loaded plugin ids (plus kit names such as `zotlit`). */
  plugins: ReadonlySet<string>;
  planning: boolean;
  templater: { templatesFolder: string; userScriptsFolder: string; folderTemplates: { folder: string; template: string }[]; matchingMode?: string; startupTemplates?: string[] };
  /** The kits' Templater user scripts (tp.user.<name>): `exists` is false when the file isn't where the kit put it. */
  scripts?: { name: string; kit: "lab" | "planning"; exists: boolean }[];
  /** The homepage note's `obsidianUIMode` (Force note view mode reads it); null when the note isn't there. */
  homepageMode?: string | null;
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
  /** Per installed kit, the files (names) with an update waiting, missing from the vault, or in conflict; undefined until counted. Kept and switched-off files are not in it. */
  kitFiles?: { kit: "lab" | "planning"; update: string[]; missing: string[]; conflict: string[] }[];
  /** Obsidian's core plugins that are on, by id; null when Obsidian's list can't be read; undefined = not looked at (no rows). */
  corePlugins?: Record<string, boolean> | null;
  /** The core Daily notes plugin's folder and date format, and the kit's Daily notes folder; null when they can't be read; undefined = no row. */
  dailyNotes?: { folder: string; format: string; want: string } | null;
  /** Dataview's "Enable inline queries"; null when it can't be read; undefined = no row. */
  dataviewInline?: boolean | null;
  /** The type Obsidian has assigned to each property of `PROPERTY_TYPES` (null = none assigned); null when it can't be read; undefined = no rows. */
  propertyTypes?: Record<string, string | null> | null;
  /** Lab Kit's own folder templates (Settings → Folder templates) and the notes whose front matter mixes a template header with their own keys; undefined until scanned (no rows). */
  fill?: FillScan;
  /** Lab notes closed with Close experiment (see `scanClosed`); `canPdf`: this device can make a PDF. undefined until scanned (no rows). */
  closed?: ClosedScan & { canPdf: boolean };
}

/** One Lab Kit folder-template row as the Check setup rows see it. `kind`: what the template file is (a token template Lab Kit fills, a Templater template Templater still runs, or not there). */
export interface FillScanRow { folder: string; file: string; folderExists: boolean; kind: "token" | "templater" | "missing"; templaterRow: boolean }
export interface FillScan { rows: FillScanRow[]; mixed: string[] }

export type SetupFix =
  | { kind: "plugin"; id: string }
  | { kind: "install"; kit: "lab" | "planning" }
  | { kind: "templater" }
  | { kind: "css"; names: string[] }
  | { kind: "folder"; path: string }
  | { kind: "find-moved" }
  | { kind: "folder-template"; folder: string; template: string }
  | { kind: "fill-move"; folders: string[] }
  | { kind: "settings" }
  | { kind: "methods-folder"; path: string }
  | { kind: "rigs-folder"; path: string }
  | { kind: "hide-properties" }
  | { kind: "update-links" }
  | { kind: "navigator-home"; path: string }
  | { kind: "matching-mode" }
  | { kind: "startup-remove"; template: string }
  | { kind: "meta-bind" }
  | { kind: "meta-bind-reset"; ids: string[] }
  | { kind: "open-note"; path: string }
  | { kind: "manage" }
  | { kind: "zotlit-fields" }
  | { kind: "property-type"; name: string; type: string }
  | { kind: "close-notes"; paths: string[] }
  | { kind: "make-pdfs"; paths: string[] };

/** `warn`: can't be checked (shown with "!"), not counted as something to fix. */
export interface SetupItem { id: string; group: string; label: string; ok: boolean; optional?: boolean; warn?: boolean; detail: string; fix?: SetupFix }

/** How a row is shown: missing (red), to do (amber: a warning), optional or information (grey), fine (green). */
export type SetupRowState = "missing" | "todo" | "info" | "ok";
export const setupRowState = (it: SetupItem): SetupRowState => (it.ok ? "ok" : it.warn ? "todo" : it.optional ? "info" : "missing");
/** The mark inside a row's round badge. */
export const SETUP_MARK: Record<SetupRowState, string> = WIN_MARK;
const ROW_RANK: Record<SetupRowState, number> = { missing: 0, todo: 1, info: 2, ok: 3 };

/** The rows in the order the window shows them: what needs the user first (missing, then to do), then optional and information, then what is fine; the order inside each is the order of `checkSetup`. */
export function orderSetupItems(items: SetupItem[]): SetupItem[] {
  return items.map((it, i) => ({ it, i })).sort((a, b) => ROW_RANK[setupRowState(a.it)] - ROW_RANK[setupRowState(b.it)] || a.i - b.i).map(x => x.it);
}

/** The big line at the top: how many things need doing (missing and to do), or that everything is in place. */
export function setupSummary(items: SetupItem[]): string {
  const n = items.filter(it => { const s = setupRowState(it); return s === "missing" || s === "todo"; }).length;
  return n ? `${n} ${n === 1 ? "thing" : "things"} to do.` : "Everything the kits need is in place.";
}

const names1 = (list: unknown[], one: string, many: string): string => list.length === 1 ? one : many;

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
    const gone = id === "rigs-folder" && !!l.rigsFolder.trim();   // the Rigs folder always has a value (its default): not ok means the folder isn't there
    out.push({ id: `lab:${id}`, group: "Lab Kit settings", label, ok, optional, detail: ok ? "Set." : gone ? `Folder missing: ${made[id].path}. ${what} Fix creates it.` : made[id] ? `Not set. ${what} Fix creates ${made[id].path} and uses it.` : `Not set. ${what}`, fix });
  }

  const pv = s.propertiesView;
  out.push({ id: "obsidian:properties", group: "Obsidian", label: "Properties hidden in notes", ok: pv === "hidden", warn: pv === undefined,
    detail: pv === "hidden" ? "Hidden (open them from the note's menu when you need them)." : pv === undefined
      ? "Can't read it in this Obsidian version: set Settings → Editor → Properties in document to Hidden."
      : `Set to ${pv}. The kit's notes keep their details in properties, which fill the top of every note.`,
    fix: pv && pv !== "hidden" ? { kind: "hide-properties" } : undefined });

  if (s.planning) {
    // After, sub, project and experiment links between to-dos are wikilinks matched by name: a rename only keeps them when Obsidian rewrites links itself
    const u = s.updateLinks;
    out.push({ id: "obsidian:update-links", group: "Obsidian", label: "Links follow renames", ok: u === true, warn: u === undefined || undefined,
      detail: u === true ? "On (Automatically update internal links). Renaming a to-do or hub keeps the after, sub and project links." : u === undefined
        ? "Can't read it in this Obsidian version: switch on Settings → Files & links → Automatically update internal links."
        : "Off. Renaming a to-do or hub breaks the after, sub and project links that point to it. Fix switches on Automatically update internal links (Settings → Files & links).",
      fix: u === false ? { kind: "update-links" } : undefined });
  }

  if (s.corePlugins !== undefined) for (const c of CORE_PLUGINS.filter(c => kitOn(c.kit))) {
    const on = s.corePlugins?.[c.id];
    out.push({ id: `core:${c.id}`, group: "Obsidian", label: `${c.name} (core plugin)`, ok: on === true, warn: on === undefined || undefined,
      detail: on === true ? `On. ${c.why}` : on === undefined ? `Can't read Obsidian's core plugins in this version: check ${c.name} is on in Settings → Core plugins. ${c.why}`
        : `Off. ${c.why} Switch it on in Settings → Core plugins.` });
  }
  if (s.planning && s.dailyNotes !== undefined) {
    // Today's note (homepage button, Alt+D) is made by Obsidian's own Daily notes plugin: its folder and file name must be the kit's, or the note lands outside the Daily notes folder
    const d = s.dailyNotes;
    const wrong = d ? [
      d.folder !== d.want ? { now: `New file location is ${d.folder || "empty (the top of the vault)"}`, set: `New file location to ${d.want}` } : null,
      d.format !== DAILY_FORMAT ? { now: `Date format is ${d.format || "empty (so YYYY-MM-DD)"}`, set: `Date format to ${DAILY_FORMAT} (a folder per year)` } : null,
    ].filter((x): x is { now: string; set: string } => !!x) : [];
    out.push({ id: "core:daily-notes-settings", group: "Obsidian", label: "Today's note is made in the Daily notes folder", ok: !!d && !wrong.length, warn: true,
      detail: !d ? `Can't read Obsidian's Daily notes settings. Check them yourself: Settings → Daily notes, New file location should be the kit's Daily notes folder and Date format ${DAILY_FORMAT}.`
        : wrong.length ? `Not yet. Today's note (the homepage button) is made by Obsidian's Daily notes plugin, and there ${wrong.map(w => w.now).join(" and ")}. So the note is made outside ${d.want} and stays empty, because the daily note template only fills notes in that folder. To fix it: open Settings → Daily notes and set ${wrong.map(w => w.set).join(", and ")}. Lab Kit does not change this for you.`
        : `Yes: in ${d.want}, named ${DAILY_FORMAT}.` });
  }
  if (s.planning && s.dataviewInline !== undefined && s.plugins.has("dataview")) {
    const v = s.dataviewInline;
    out.push({ id: "dataview:inline", group: "Obsidian", label: "Dataview inline queries", ok: v === true, warn: true,
      detail: v === true ? "On (the date at the top of the homepage is one)." : v === null ? "Can't read Dataview's settings: check Enable inline queries is on (the date at the top of the homepage is one)."
        : "Off, so the date at the top of the homepage shows as code. Switch on Enable inline queries in Settings → Dataview." });
  }
  if (s.planning && s.propertyTypes !== undefined) for (const p of PROPERTY_TYPES) {
    const have = s.propertyTypes?.[p.name];
    if (s.propertyTypes && have == null) continue;   // never used in this vault: the template sets it at first use
    out.push({ id: `type:${p.name}`, group: "Obsidian", label: `Property ${p.name} is a ${p.type}`, ok: have === p.type, warn: s.propertyTypes === null || undefined,
      detail: s.propertyTypes === null ? `Can't read property types in this Obsidian version. ${p.why}` : have === p.type ? "Set."
        : `It is ${have} now. ${p.why} Fix sets the type; values already typed stay as they are.`,
      fix: s.propertyTypes && have !== p.type ? { kind: "property-type", name: p.name, type: p.type } : undefined });
  }

  for (const kit of ["lab", "planning"] as const) {
    if (!kitOn(kit)) continue;
    const ok = s.installed[kit];
    out.push({ id: `install:${kit}`, group: "Kit files", label: kit === "lab" ? "Lab kit installed" : "Planning kit installed", ok,
      detail: ok ? "Installed." : "Not installed yet.", fix: ok ? undefined : { kind: "install", kit } });
  }

  for (const k of s.kitFiles ?? []) {
    if (!kitOn(k.kit) || !s.installed[k.kit]) continue;
    const part = (names: string[], what: string): string => names.length ? `${names.length} ${what} (${names.join(", ")})` : "";
    const bits = [part(k.missing, "missing"), part(k.conflict, names1(k.conflict, "conflict", "conflicts")), part(k.update, names1(k.update, "update waiting", "updates waiting"))].filter(Boolean);
    const broken = k.missing.length + k.conflict.length > 0;
    out.push({ id: `kit-files:${k.kit}`, group: "Kit files", label: k.kit === "lab" ? "Lab kit files" : "Planning kit files", ok: !bits.length, optional: !broken,
      detail: bits.length ? `${bits.join("; ")}. Fix opens Review update…, which shows each file before anything is written.` : "Every file is there and current.",
      fix: bits.length ? { kind: "install", kit: k.kit } : undefined });
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
    ];
    for (const [id, label, ok] of items) {
      out.push({ id: `templater:${id}`, group: "Templater", label, ok, detail: ok ? "Set." : s.installed.lab ? "Not set. Fix fills in only what is empty." : "Not set. Install the lab kit first, then Fix runs Set up.",
        fix: ok || !s.installed.lab ? undefined : { kind: "templater" } });
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
    const clean = !z.missing.length && !z.differing.length;
    // a missing field is something to fix; a field of yours that only differs is a warning: Lab Kit never changes it, so check it by hand
    out.push({ id: "zotlit:fields", group: "ZotLit", label: "ZotLit frontmatter fields", ok: clean, warn: (!clean && !z.missing.length) || undefined,
      detail: bits.length ? `${bits.join("; ")}.${z.missing.length ? " Fix adds the missing ones, then turns ZotLit off and on so it reads them." : ""}${z.differing.length ? " Lab Kit never changes a field you have: check the ones that differ in Settings → ZotLit → Templates → Frontmatter." : ""}` : "All the kit's fields are there.",
      fix: z.missing.length ? { kind: "zotlit-fields" } : undefined });
    const f = [z.literature === "other" ? "Literature note folder is your own (left alone)" : z.literature === "empty" ? "Literature note folder is not set" : "",
      z.templates === "other" ? "Template folder is your own (left alone)" : z.templates === "empty" ? "Template folder is not set" : ""].filter(Boolean);
    out.push({ id: "zotlit:folders", group: "ZotLit", label: "ZotLit folders", ok: !f.length, warn: !!f.length || undefined,
      detail: f.length ? `${f.join("; ")}.${z.literature === "empty" || z.templates === "empty" ? (z.missing.length ? " The Fix on the fields row sets the empty ones." : " Fix sets the empty ones.") : ""}` : "ZotLit uses the kit's literature and template folders.",
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

  // Close experiment: three cases that need a look. A row appears only when a note is in its case.
  if (s.closed) {
    const { edited, unclosed, noPdf, canPdf } = s.closed;
    const named = (list: { name: string }[]): string => ` ${list.map(n => n.name).join(", ")}.`;
    const nNotes = (n: number): string => `${n} note${n === 1 ? "" : "s"}`;
    if (edited.length) out.push({ id: "closed:edited", group: "Lab notes", label: "Closed lab notes edited after closing", ok: false, warn: true,
      detail: `${nNotes(edited.length)} changed since they were closed.${named(edited)}` });
    if (unclosed.length) out.push({ id: "closed:unclosed", group: "Lab notes", label: "Lab notes marked Closed but not closed", ok: false, warn: true,
      detail: `${nNotes(unclosed.length)} marked Closed but not closed.${named(unclosed)}`, fix: { kind: "close-notes", paths: unclosed.map(n => n.path) } });
    if (noPdf.length) out.push({ id: "closed:no-pdf", group: "Lab notes", label: "Closed lab notes without a PDF", ok: false, warn: true,
      detail: `${nNotes(noPdf.length)} closed without a PDF.${named(noPdf)}`, fix: canPdf ? { kind: "make-pdfs", paths: noPdf.map(n => n.path) } : undefined });
  }

  for (const c of s.css) {
    const ok = c.enabled === true;
    out.push({ id: `css:${c.name}`, group: "Appearance", label: `CSS snippet ${c.name}`, ok,
      detail: c.enabled === undefined ? "Can't tell in this Obsidian version: check Settings → Appearance → CSS snippets." : ok ? "On." : "Off.",
      fix: c.enabled === false ? { kind: "css", names: [c.name] } : undefined });
  }

  if (s.fill) out.push(...fillRows(s.fill));

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

/**
 * Rows for Lab Kit's own folder templates. One row confirms the folders (each: folder there, template there, who fills it); a Fix removes
 * Templater's row for the folders whose template Lab Kit now fills itself. A second row lists mixed notes, which are never guessed.
 */
export function fillRows(f: FillScan): SetupItem[] {
  const out: SetupItem[] = [];
  if (f.rows.length) {
    const line = (r: FillScanRow): string => `${r.folder || "(no folder)"} → ${r.file || "(no file)"}: ${!r.file ? "no template file named" : r.kind === "missing" ? "template file not found" : r.kind === "token" ? (r.templaterRow ? "filled by Lab Kit; Templater has a row too" : "filled by Lab Kit") : (r.templaterRow ? "Templater fills it" : "Templater template, no Templater row for this folder")}${r.folderExists ? "" : "; folder not found"}`;
    const bad = f.rows.filter(r => !r.folderExists || r.kind === "missing" || (r.kind === "templater" && !r.templaterRow));
    const move = f.rows.filter(r => r.kind === "token" && r.templaterRow).map(r => r.folder);
    out.push({ id: "fill:rows", group: "Folder templates", label: "Folder templates run by Lab Kit", ok: !bad.length && !move.length, warn: true,
      detail: `${f.rows.map(line).join(". ")}.${move.length ? " Fix removes Templater's row for the folders Lab Kit fills itself (a copy of Templater's list is saved first)." : ""}`,
      fix: move.length ? { kind: "fill-move", folders: move } : undefined });
  }
  if (f.mixed.length) out.push({ id: "fill:mixed", group: "Folder templates", label: "Notes with a template header mixed into their properties", ok: false, warn: true,
    detail: `${f.mixed.length} ${f.mixed.length === 1 ? "note" : "notes"} (${f.mixed.slice(0, 5).join(", ")}${f.mixed.length > 5 ? ", …" : ""}). Lab Kit does not fill or change them: tidy the properties by hand.`,
    fix: { kind: "open-note", path: f.mixed[0] } });
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
