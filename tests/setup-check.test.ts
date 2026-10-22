// Phase 6: the setup check's list (pure: a SetupState in, items out).
import { describe, it, expect } from "vitest";
import { SETUP_MARK, checkSetup, describeActions, differingButtons, labFolderTemplates, orderSetupItems, setupRowState, setupSummary, type SetupItem, type SetupState } from "../src/kit/setup-check";

const MENU = "Extras/Templates/Lab Kit/Insert snippet.md";
const CMD = `templater-obsidian:${MENU}`;
const state = (o: Partial<SetupState> = {}): SetupState => ({
  lab: { initials: "ABC", dataRoot: true, methodsFolder: "Methods", rigsFolder: "Rigs", labFolder: "03 Lab Book/Notes", chemicalFolder: "05 Chemicals/Chemicals" },
  metaBind: { missing: 0, total: 26 },
  propertiesView: "hidden",
  plugins: new Set(["templater-obsidian", "dataview", "table-editor-obsidian"]),
  planning: false,
  templater: { templatesFolder: "Extras/Templates", userScriptsFolder: "Extras/scripts/templater", folderTemplates: [], matchingMode: "folder", startupTemplates: [] },
  installed: { lab: true, planning: false },
  css: [{ name: "scrolling-mermaid", enabled: true }],
  folders: [{ path: "03 Lab Book/Notes", exists: true }],
  folderTemplates: [{ folder: "01 Daily Notes", template: "Extras/Templates/Daily note.md" }],
  ...o,
});
const byId = (s: SetupState) => Object.fromEntries(checkSetup(s).map(i => [i.id, i]));

describe("check setup (Phase 6)", () => {
  it("Phase 5a: a settings folder missing after the install offers Find (moved outside Obsidian?); other folders are made", () => {
    const r = byId(state({ folders: [{ path: "20 Work", exists: false, setting: true }, { path: "00 Planning/To-dos", exists: false }] }));
    expect(r["folder:20 Work"]).toMatchObject({ ok: false, fix: { kind: "find-moved" } });
    expect(r["folder:20 Work"].detail).toMatch(/Moved outside Obsidian/);
    expect(r["folder:00 Planning/To-dos"].fix).toEqual({ kind: "folder", path: "00 Planning/To-dos" });
    const fresh = byId(state({ installed: { lab: false, planning: false }, folders: [{ path: "20 Work", exists: false, setting: true }] }));
    expect(fresh["folder:20 Work"].fix).toEqual({ kind: "folder", path: "20 Work" });   // before the install: just make it
  });

  it("a set-up lab vault is all green and lists no planning items", () => {
    const items = checkSetup(state());
    expect(items.filter(i => !i.ok)).toEqual([]);
    expect(items.some(i => i.id.includes("meta-bind") || i.id.startsWith("folder-template"))).toBe(false);
  });

  it("a fresh vault: missing plugin, kit not installed, empty Templater folders, snippet off, folder missing", () => {
    const r = byId(state({
      plugins: new Set(["templater-obsidian"]), installed: { lab: false, planning: false },
      templater: { templatesFolder: "", userScriptsFolder: "", folderTemplates: [] },
      css: [{ name: "scrolling-mermaid", enabled: false }], folders: [{ path: "03 Lab Book/Notes", exists: false }],
    }));
    expect(r["plugin:dataview"]).toBeUndefined();   // no lab kit file uses Dataview: it is a planning kit plugin
    expect(byId(state({ planning: true, plugins: new Set(["templater-obsidian"]) }))["plugin:dataview"]).toMatchObject({ ok: false, fix: { kind: "plugin", id: "dataview" } });
    expect(r["install:lab"]).toMatchObject({ ok: false, fix: { kind: "install", kit: "lab" } });
    expect(r["templater:templates-folder"].ok).toBe(false);
    expect(r["templater:templates-folder"].fix).toBeUndefined();          // Set up needs the kit installed first
    expect(r["templater:menu-hotkey"]).toBeUndefined();
    expect(r["css:scrolling-mermaid"].fix).toEqual({ kind: "css", names: ["scrolling-mermaid"] });
    expect(r["folder:03 Lab Book/Notes"].fix).toEqual({ kind: "folder", path: "03 Lab Book/Notes" });
  });

  it("Templater values already set are ok and get no fix", () => {
    const r = byId(state({ templater: { templatesFolder: "Mine", userScriptsFolder: "My scripts", folderTemplates: [] } }));
    expect(r["templater:templates-folder"]).toMatchObject({ ok: true, fix: undefined });
    expect(r["templater:user-scripts"]).toMatchObject({ ok: true, fix: undefined });
  });

  it("planning on: Meta Bind and ZotLit (optional) are checked, a folder template is added only where the folder has none", () => {
    const r = byId(state({
      planning: true, installed: { lab: true, planning: true },
      templater: { templatesFolder: "T", userScriptsFolder: "S", folderTemplates: [{ folder: "00 Planning/To-dos", template: "Mine.md" }] },
      folderTemplates: [{ folder: "01 Daily Notes", template: "T/Daily note.md" }, { folder: "00 Planning/To-dos", template: "T/To-do.md" }],
    }));
    expect(r["plugin:obsidian-meta-bind-plugin"].ok).toBe(false);
    expect(r["plugin:zotlit"]).toMatchObject({ ok: false, optional: true });
    expect(r["folder-template:01 Daily Notes"].fix).toEqual({ kind: "folder-template", folder: "01 Daily Notes", template: "T/Daily note.md" });
    expect(r["folder-template:00 Planning/To-dos"]).toMatchObject({ ok: true, fix: undefined });
    expect(r["folder-template:00 Planning/To-dos"].detail).toContain("Mine.md");
  });

  it("no Templater folder-template row is asked for a folder whose template is a token template (Lab Kit fills those; Phase 3)", () => {
    const r = byId(state({
      planning: true, installed: { lab: true, planning: true },
      templater: { templatesFolder: "T", userScriptsFolder: "S", folderTemplates: [] },
      folderTemplates: [{ folder: "01 Daily Notes", template: "T/Daily note.md" }, { folder: "00 Planning/To-dos", template: "T/To-do.md" }],
      fill: { rows: [{ folder: "00 Planning/To-dos", file: "To-do.md", folderExists: true, kind: "token", templaterRow: false }], mixed: [] },
    }));
    expect(r["folder-template:00 Planning/To-dos"]).toBeUndefined();
    expect(r["folder-template:01 Daily Notes"].fix).toEqual({ kind: "folder-template", folder: "01 Daily Notes", template: "T/Daily note.md" });
  });

  it("lab folder template: shown without the planning kit, Fix adds it, set one is kept, none without a Lab notes folder", () => {
    const lab = { folder: "03 Lab Book/Notes", template: "T/Lab Book Template.md", kit: "lab" as const };
    const r = byId(state({ folderTemplates: [lab] }));
    expect(r["folder-template:03 Lab Book/Notes"]).toMatchObject({ ok: false, fix: { kind: "folder-template", folder: lab.folder, template: lab.template } });
    expect(r["templater:matching-mode"]).toBeDefined();   // folder templates need the mode, with or without planning
    const set = byId(state({ folderTemplates: [lab], templater: { ...state().templater, folderTemplates: [{ folder: lab.folder, template: "Mine.md" }] } }));
    expect(set["folder-template:03 Lab Book/Notes"]).toMatchObject({ ok: true, fix: undefined });
    const notInstalled = byId(state({ folderTemplates: [lab], installed: { lab: false, planning: false } }));
    expect(notInstalled["folder-template:03 Lab Book/Notes"].fix).toBeUndefined();
    expect(labFolderTemplates("")).toEqual([]);
    expect(labFolderTemplates("03 Lab Book/Notes")).toEqual([{ folder: "03 Lab Book/Notes", file: "Lab Book Template.md" }]);
    expect(labFolderTemplates("03 Lab Book/Notes", "05 Chemicals/Chemicals")).toEqual([
      { folder: "03 Lab Book/Notes", file: "Lab Book Template.md" }, { folder: "05 Chemicals/Chemicals", file: "Chemical database template.md" }]);
    expect(labFolderTemplates("", "05 Chemicals/Chemicals")).toEqual([{ folder: "05 Chemicals/Chemicals", file: "Chemical database template.md" }]);
  });

  it("ZotLit counts as present under its kit name", () => {
    const r = byId(state({ planning: true, plugins: new Set(["templater-obsidian", "dataview", "zotlit"]) }));
    expect(r["plugin:zotlit"].ok).toBe(true);
  });

  it("sets no hotkey: Check setup has no Hotkeys group (Check hotkeys reports them)", () => {
    expect(checkSetup(state()).some(i => i.group === "Hotkeys" || i.fix?.kind === ("hotkey" as string))).toBe(false);
  });

  it("folder template: no Fix until the planning kit is installed", () => {
    const r = byId(state({ planning: true, installed: { lab: true, planning: false } }));
    expect(r["folder-template:01 Daily Notes"].ok).toBe(false);
    expect(r["folder-template:01 Daily Notes"].fix).toBeUndefined();
    expect(r["folder-template:01 Daily Notes"].detail).toContain("Install the planning kit first");
  });

  it("Lab Kit settings: empty initials, data root, folders are red and open settings; methods folder is optional", () => {
    const r = byId(state({ lab: { initials: "", dataRoot: false, methodsFolder: "", rigsFolder: "", labFolder: "", chemicalFolder: "" } }));
    for (const id of ["initials", "data-root", "lab-folder", "chemical-folder"]) expect(r[`lab:${id}`]).toMatchObject({ ok: false, fix: { kind: "settings" } });
    expect(r["lab:methods-folder"]).toMatchObject({ ok: false, optional: true });
  });

  it("Templater (planning): matching mode None is fixed, a chosen mode is left alone; only the old roll-over startup entry is offered for removal", () => {
    const planned = (t: Partial<SetupState["templater"]>) => byId(state({ planning: true, installed: { lab: true, planning: true },
      templater: { templatesFolder: "T", userScriptsFolder: "S", folderTemplates: [], ...t } }));
    expect(planned({ matchingMode: "none" })["templater:matching-mode"].fix).toEqual({ kind: "matching-mode" });
    const regex = planned({ matchingMode: "regex" })["templater:matching-mode"];
    expect(regex.ok).toBe(false);
    expect(regex.fix).toBeUndefined();
    const st = planned({ matchingMode: "folder", startupTemplates: ["Extras/Templates/Actions/To-do roll-over.md", "Mine.md"] })["templater:startup"];
    expect(st.fix).toEqual({ kind: "startup-remove", template: "Extras/Templates/Actions/To-do roll-over.md" });
    const mine = planned({ matchingMode: "folder", startupTemplates: ["Mine.md"] })["templater:startup"];
    expect(mine.ok).toBe(true);
    expect(mine.detail).toContain("Mine.md");
  });

  it("Meta Bind buttons (planning only); no Dataview JS row since Phase 5a (no DataviewJS in the kit)", () => {
    const r = byId(state({ planning: true, metaBind: { missing: 3, total: 26, names: ["new-meeting-series", "go-deck", "help"] },
      plugins: new Set(["templater-obsidian", "dataview", "obsidian-meta-bind-plugin", "zotlit"]) }));
    expect(r["dataview:js"]).toBeUndefined();
    expect(r["metabind:buttons"]).toMatchObject({ ok: false, fix: { kind: "meta-bind" } });
    expect(r["metabind:buttons"].detail).toContain("3 of 26");
    expect(r["metabind:buttons"].detail).toContain("new-meeting-series, go-deck, help");
  });

  it("a Meta Bind button that does something else than the kit's is reported with both actions, and Fix names it", () => {
    const plugins = new Set(["obsidian-meta-bind-plugin"]);
    const same = byId(state({ planning: true, metaBindDiffers: [], plugins }));
    expect(same["metabind:differs"]).toMatchObject({ ok: true });
    expect(same["metabind:differs"].fix).toBeUndefined();
    const r = byId(state({ planning: true, metaBindDiffers: [{ id: "go-meetings", now: "opens [[Weekly meetings]]", kit: "opens [[Meetings]]" }], plugins }));
    expect(r["metabind:differs"]).toMatchObject({ ok: false, fix: { kind: "meta-bind-reset", ids: ["go-meetings"] } });
    expect(r["metabind:differs"].detail).toContain("go-meetings opens [[Weekly meetings]] (kit: opens [[Meetings]])");
    expect(byId(state({ planning: true, plugins }))["metabind:differs"]).toBeUndefined();   // not read: no row
  });

  it("describeActions and differingButtons: only buttons that exist with other actions; missing and your own are not listed", () => {
    expect(describeActions([{ type: "open", link: "[[Meetings]]" }])).toBe("opens [[Meetings]]");
    expect(describeActions([{ type: "command", command: "lab-kit:new-meeting" }])).toBe("runs lab-kit:new-meeting");
    expect(describeActions([{ type: "templaterCreateNote", templateFile: "T/A.md" }])).toBe("runs the template T/A.md");
    expect(describeActions([])).toBe("does nothing");
    const kit = [{ id: "go-meetings", actions: [{ type: "open", link: "[[Meetings]]" }] }, { id: "today", actions: [{ type: "command", command: "x" }] }, { id: "help", actions: [{ type: "command", command: "y" }] }];
    const have = [{ id: "go-meetings", actions: [{ type: "open", link: "[[Weekly meetings]]" }] }, { id: "today", actions: [{ type: "command", command: "x" }] }, { id: "mine", actions: [] }];
    expect(differingButtons(kit, have)).toEqual([{ id: "go-meetings", now: "opens [[Weekly meetings]]", kit: "opens [[Meetings]]" }]);
  });

  it("Methods folder Fix creates the suggested folder", () => {
    const r = byId(state({ planning: true, lab: { initials: "A", dataRoot: true, methodsFolder: "", rigsFolder: "", labFolder: "L", chemicalFolder: "C" },
      plugins: new Set(["templater-obsidian", "dataview", "zotlit"]) }));
    expect(r["lab:methods-folder"]).toMatchObject({ ok: false, optional: true, fix: { kind: "methods-folder", path: "03 Lab Book/Methods" } });
    expect(r["lab:rigs-folder"]).toMatchObject({ ok: false, optional: true, fix: { kind: "rigs-folder", path: "03 Lab Book/Rigs" } });
    expect(r["lab:rigs-folder"].detail).toContain("Fix creates 03 Lab Book/Rigs and uses it.");
    expect(byId(state())["lab:rigs-folder"]).toMatchObject({ ok: true, detail: "Set." });
    expect(Object.keys(r).filter(k => k.startsWith("zotlit:"))).toEqual([]);   // Lab Kit no longer manages ZotLit (refpane does)
  });

  it("properties view: hidden is ok, visible gets a Fix, unknown is a warning", () => {
    expect(byId(state())["obsidian:properties"].ok).toBe(true);
    expect(byId(state({ propertiesView: "visible" }))["obsidian:properties"]).toMatchObject({ ok: false, fix: { kind: "hide-properties" } });
    expect(byId(state({ propertiesView: undefined }))["obsidian:properties"]).toMatchObject({ ok: false, warn: true });
  });

  it("planning plugins: Force note view mode, Omnisearch, Notebook Navigator needed; Outliner, Editing Toolbar, CSS Editor, Advanced Canvas optional with what they do", () => {
    const r = byId(state({ planning: true }));
    for (const id of ["obsidian-view-mode-by-frontmatter", "omnisearch", "notebook-navigator"]) expect(r[`plugin:${id}`]).toMatchObject({ ok: false, fix: { kind: "plugin", id } });
    for (const id of ["obsidian-outliner", "editing-toolbar", "css-editor", "advanced-canvas", "zotlit"]) {
      expect(r[`plugin:${id}`]).toMatchObject({ ok: false, optional: true });
      expect(r[`plugin:${id}`].detail).toMatch(/^Optional\. ./);
    }
    expect(byId(state())["plugin:omnisearch"]).toBeUndefined();          // lab only: planning plugins not listed
    expect(byId(state({ plugins: new Set(["templater-obsidian", "dataview"]) }))["plugin:table-editor-obsidian"].optional).toBe(true);
  });

  it("Notebook Navigator homepage: none gets a Fix to the kit's homepage, yours is left alone", () => {
    const nav = (homepage: { source: string; file: string | null } | null) => byId(state({ planning: true, navigator: { homepage, home: "00 Home.md" } }))["navigator:homepage"];
    expect(nav({ source: "none", file: null })).toMatchObject({ ok: false, fix: { kind: "navigator-home", path: "00 Home.md" } });
    expect(nav({ source: "file", file: "00 Home.md" }).ok).toBe(true);
    const mine = nav({ source: "daily-note", file: null });
    expect(mine.ok).toBe(false);
    expect(mine.fix).toBeUndefined();
    expect(nav(null)).toBeUndefined();
  });
});

describe("check setup: kept files with a newer kit version", () => {
  const row = (newerKit?: string[]) => checkSetup(state({ newerKit })).find(i => i.id === "kit:newer");
  it("no row until the files are counted", () => expect(row(undefined)).toBeUndefined());
  it("none: green", () => { expect(row([])?.ok).toBe(true); expect(row([])?.fix).toBeUndefined(); });
  it("some: optional, never counted as to fix, lists the files and offers Manage files", () => {
    const r = row(["Templates/Home.md", "Shopping list.md"])!;
    expect(r.ok).toBe(false); expect(r.optional).toBe(true);
    expect(r.detail).toContain("2 files have a newer kit version");
    expect(r.detail).toContain("Shopping list.md");
    expect(r.fix).toEqual({ kind: "manage" });
  });
});

describe("check setup: meeting series (Phase 5b)", () => {
  it("each series is a row; a wrong field is named and Open goes to the note; a missing deck is a warning", () => {
    const r = byId(state({ planning: true, meetings: [
      { name: "Group", path: "08 Meetings/Group/Group.md", deck: true },
      { name: "Odd", path: "08 Meetings/Odd/Odd.md", deck: true, error: 'interval must be weekly, fortnightly or monthly (it is "daily")' },
      { name: "NoDeck", path: "08 Meetings/NoDeck/NoDeck.md", deck: false },
    ] }));
    expect(r["meetings:08 Meetings/Group/Group.md"].ok).toBe(true);
    expect(r["meetings:08 Meetings/Odd/Odd.md"]).toMatchObject({ ok: false, fix: { kind: "open-note", path: "08 Meetings/Odd/Odd.md" } });
    expect(r["meetings:08 Meetings/Odd/Odd.md"].detail).toMatch(/^Interval must be/);
    expect(r["meetings-deck:08 Meetings/NoDeck/NoDeck.md"]).toMatchObject({ ok: false, warn: true, optional: true });
    expect(r["meetings-deck:08 Meetings/Odd/Odd.md"]).toBeUndefined();   // not asked while the series itself is broken
  });

  it("no series: one optional green row; planning kit off: no Meetings rows", () => {
    expect(byId(state({ planning: true, meetings: [] }))["meetings:none"]).toMatchObject({ ok: true, optional: true });
    expect(checkSetup(state({ meetings: [{ name: "X", path: "X.md", deck: false, error: "bad" }] })).some(i => i.group === "Meetings")).toBe(false);
  });

  it("Templater user scripts: missing ones are red; the planning script only counts with the planning kit", () => {
    const scripts = [{ name: "labSnippets", kit: "lab" as const, exists: true }, { name: "labForm", kit: "lab" as const, exists: false }, { name: "vtAsk", kit: "planning" as const, exists: false }];
    const r = byId(state({ scripts }));
    expect(r["script:labSnippets"].ok).toBe(true);
    expect(r["script:labForm"]).toMatchObject({ ok: false });
    expect(r["script:labForm"].fix).toBeUndefined();   // installed: Review update… puts it back
    expect(r["script:vtAsk"]).toBeUndefined();
    const fresh = byId(state({ scripts, installed: { lab: false, planning: false } }));
    expect(fresh["script:labForm"].fix).toEqual({ kind: "install", kit: "lab" });
  });

  it("homepage opens read-only: obsidianUIMode must be preview", () => {
    const on = { planning: true, plugins: new Set(["templater-obsidian", "dataview", "obsidian-view-mode-by-frontmatter"]), navigator: { homepage: null, home: "00 Home.md" } };
    expect(byId(state({ ...on, homepageMode: "preview" }))["viewmode:homepage"].ok).toBe(true);
    expect(byId(state({ ...on, homepageMode: "" }))["viewmode:homepage"]).toMatchObject({ ok: false, fix: { kind: "open-note", path: "00 Home.md" } });
    expect(byId(state({ ...on, homepageMode: null }))["viewmode:homepage"]).toMatchObject({ ok: false, fix: undefined });
    expect(byId(state({ ...on, homepageMode: "preview", plugins: new Set(["templater-obsidian"]) }))["viewmode:homepage"]).toBeUndefined();
  });
});

describe("check setup: kit files, core plugins, Daily notes, Dataview and property types (2026-10-13)", () => {
  const plan = { planning: true, installed: { lab: true, planning: true }, plugins: new Set(["templater-obsidian", "dataview"]) };

  it("none of the new rows is drawn until its part of the state is read", () => {
    const ids = checkSetup(state(plan)).map(i => i.id);
    expect(ids.some(i => i.startsWith("kit-files:") || i.startsWith("core:") || i.startsWith("type:") || i === "dataview:inline")).toBe(false);
  });

  it("kit files: missing files and conflicts count, updates alone are optional, Fix opens Review; a kit that is not installed has no row", () => {
    const r = byId(state({ ...plan, installed: { lab: true, planning: false }, kitFiles: [
      { kit: "lab", update: ["Rig template.md"], missing: ["labForm.js", "14 Rig.md"], conflict: [] },
      { kit: "planning", update: ["vault-theme.css"], missing: [], conflict: [] }] }));
    expect(r["kit-files:lab"]).toMatchObject({ ok: false, optional: false, fix: { kind: "install", kit: "lab" } });
    expect(r["kit-files:lab"].detail).toBe("2 missing (labForm.js, 14 Rig.md); 1 update waiting (Rig template.md). Fix opens Review update…, which shows each file before anything is written.");
    expect(r["kit-files:planning"]).toBeUndefined();
    const waiting = byId(state({ ...plan, kitFiles: [{ kit: "planning", update: ["vault-theme.css", "Project hub.md"], missing: [], conflict: [] }, { kit: "lab", update: [], missing: [], conflict: [] }] }));
    expect(waiting["kit-files:planning"]).toMatchObject({ ok: false, optional: true });
    expect(waiting["kit-files:planning"].detail).toContain("2 updates waiting (vault-theme.css, Project hub.md)");
    expect(waiting["kit-files:lab"]).toMatchObject({ ok: true, detail: "Every file is there and current." });
    expect(byId(state({ ...plan, kitFiles: [{ kit: "lab", update: [], missing: [], conflict: ["Lab Book Template.md"] }] }))["kit-files:lab"].detail).toContain("1 conflict (Lab Book Template.md)");
  });

  it("core plugins: Bases for the lab kit, Daily notes only with the planning kit; off is red, unreadable is a warning", () => {
    const lab = byId(state({ corePlugins: { bases: true, "daily-notes": false } }));
    expect(lab["core:bases"].ok).toBe(true);
    expect(lab["core:daily-notes"]).toBeUndefined();
    const off = byId(state({ ...plan, corePlugins: { bases: false, "daily-notes": true } }));
    expect(off["core:bases"]).toMatchObject({ ok: false });
    expect(off["core:bases"].warn).toBeUndefined();
    expect(off["core:bases"].detail).toContain("Settings → Core plugins");
    expect(off["core:daily-notes"].ok).toBe(true);
    expect(byId(state({ ...plan, corePlugins: null }))["core:bases"]).toMatchObject({ ok: false, warn: true });
  });

  it("Daily notes settings: folder and format are compared, never fixed; a warning either way", () => {
    const row = (dailyNotes: SetupState["dailyNotes"]) => byId(state({ ...plan, dailyNotes }))["core:daily-notes-settings"];
    expect(row({ folder: "01 Daily Notes", format: "YYYY/YYYY-MM-DD", want: "01 Daily Notes" })).toMatchObject({ ok: true });
    const wrong = row({ folder: "", format: "", want: "01 Daily Notes" });
    expect(wrong).toMatchObject({ ok: false, warn: true });
    expect(wrong.fix).toBeUndefined();
    expect(wrong.detail).toBe("Not yet. Today's note (the homepage button) is made by Obsidian's Daily notes plugin, and there New file location is empty (the top of the vault) and Date format is empty (so YYYY-MM-DD). So the note is made outside 01 Daily Notes and stays empty, because the daily note template only fills notes in that folder. To fix it: open Settings → Daily notes and set New file location to 01 Daily Notes, and Date format to YYYY/YYYY-MM-DD (a folder per year). Lab Kit does not change this for you.");
    // only what is wrong is named
    const half = row({ folder: "01 Daily Notes", format: "YYYY-MM-DD", want: "01 Daily Notes" });
    expect(half.detail).toContain("and there Date format is YYYY-MM-DD. So");
    expect(half.detail).toContain("and set Date format to YYYY/YYYY-MM-DD (a folder per year). Lab Kit");
    expect(row({ folder: "01 Daily Notes", format: "YYYY/YYYY-MM-DD", want: "01 Daily Notes" }).detail).toBe("Yes: in 01 Daily Notes, named YYYY/YYYY-MM-DD.");
    expect(row(null)).toMatchObject({ ok: false, warn: true });
    expect(byId(state({ dailyNotes: null }))["core:daily-notes-settings"]).toBeUndefined();   // planning kit off
  });

  it("Links follow renames: planning kit only; off gets a Fix, unreadable is a warning", () => {
    expect(byId(state({ ...plan, updateLinks: true }))["obsidian:update-links"]).toMatchObject({ ok: true });
    expect(byId(state({ ...plan, updateLinks: false }))["obsidian:update-links"]).toMatchObject({ ok: false, fix: { kind: "update-links" } });
    expect(byId(state({ ...plan, updateLinks: undefined }))["obsidian:update-links"]).toMatchObject({ ok: false, warn: true, fix: undefined });
    expect(byId(state({ updateLinks: false }))["obsidian:update-links"]).toBeUndefined();
  });

  it("Dataview inline queries: only with Dataview loaded and the planning kit on", () => {
    expect(byId(state({ ...plan, dataviewInline: true }))["dataview:inline"].ok).toBe(true);
    expect(byId(state({ ...plan, dataviewInline: false }))["dataview:inline"]).toMatchObject({ ok: false, warn: true });
    expect(byId(state({ ...plan, dataviewInline: null }))["dataview:inline"].detail).toContain("Can't read");
    expect(byId(state({ ...plan, plugins: new Set(["templater-obsidian"]), dataviewInline: false }))["dataview:inline"]).toBeUndefined();
  });

  it("property types: a wrong type gets a Fix, a property never used has no row, unreadable is a warning", () => {
    const r = byId(state({ ...plan, propertyTypes: { due: "text", deadline: "date", priority: null } }));
    expect(r["type:due"]).toMatchObject({ ok: false, fix: { kind: "property-type", name: "due", type: "date" } });
    expect(r["type:due"].detail).toContain("It is text now.");
    expect(r["type:deadline"]).toMatchObject({ ok: true });
    expect(r["type:priority"]).toBeUndefined();
    expect(byId(state({ ...plan, propertyTypes: null }))["type:priority"]).toMatchObject({ ok: false, warn: true });
    expect(byId(state({ propertyTypes: { due: "text" } }))["type:due"]).toBeUndefined();   // planning kit off
  });

  it("Rigs folder: set but not there says Folder missing, not Not set", () => {
    const r = byId(state({ lab: { initials: "ABC", dataRoot: true, methodsFolder: "Methods", rigsFolder: "03 Lab Book/Rigs", rigsFolderMissing: true, labFolder: "03 Lab Book/Notes", chemicalFolder: "05 Chemicals/Chemicals" } }));
    expect(r["lab:rigs-folder"].detail).toMatch(/^Folder missing: 03 Lab Book\/Rigs\./);
    expect(r["lab:rigs-folder"].fix).toEqual({ kind: "rigs-folder", path: "03 Lab Book/Rigs" });
  });
});

describe("the Check setup window's order and summary", () => {
  const row = (id: string, o: Partial<SetupItem> = {}): SetupItem => ({ id, group: "G", label: id, ok: false, detail: "", ...o });
  const items = [row("fine1", { ok: true }), row("optional1", { optional: true }), row("warn1", { warn: true }), row("missing1"), row("fine2", { ok: true }), row("missing2"), row("warn2", { warn: true }), row("optional2", { optional: true })];
  it("each row is missing, to do, information or fine, with its mark", () => {
    expect(items.map(setupRowState)).toEqual(["ok", "info", "todo", "missing", "ok", "missing", "todo", "info"]);
    expect(SETUP_MARK).toEqual({ missing: "✗", todo: "!", info: "i", ok: "✓" });
    expect(setupRowState(row("x", { ok: true, warn: true }))).toBe("ok");   // fine wins over a leftover warning
  });
  it("missing first, then to do, then information, then fine; the original order inside each", () => {
    expect(orderSetupItems(items).map(i => i.id)).toEqual(["missing1", "missing2", "warn1", "warn2", "optional1", "optional2", "fine1", "fine2"]);
  });
  it("the summary counts the missing and the to-do rows, not information or fine ones", () => {
    expect(setupSummary(items)).toBe("4 things to do.");
    expect(setupSummary([row("a", { warn: true }), row("b", { ok: true })])).toBe("1 thing to do.");
    expect(setupSummary([row("a", { optional: true }), row("b", { ok: true })])).toBe("Everything the kits need is in place.");
    expect(setupSummary([])).toBe("Everything the kits need is in place.");
  });
});
