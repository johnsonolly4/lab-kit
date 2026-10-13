// Phase 6: the setup check's list (pure: a SetupState in, items out).
import { describe, it, expect } from "vitest";
import { checkSetup, describeActions, differingButtons, labFolderTemplates, type SetupState } from "../src/kit/setup-check";

const MENU = "Extras/Templates/Lab Kit/Insert snippet.md";
const CMD = `templater-obsidian:${MENU}`;
const state = (o: Partial<SetupState> = {}): SetupState => ({
  lab: { initials: "ABC", dataRoot: true, methodsFolder: "Methods", rigsFolder: "Rigs", labFolder: "03 Lab Book/Notes", chemicalFolder: "05 Chemicals/Chemicals" },
  metaBind: { missing: 0, total: 26 },
  zotlitGuide: null,
  propertiesView: "hidden",
  plugins: new Set(["templater-obsidian", "dataview", "table-editor-obsidian"]),
  planning: false,
  templater: { templatesFolder: "Extras/Templates", userScriptsFolder: "Extras/scripts/templater", menuHotkey: true, folderTemplates: [], matchingMode: "folder", startupTemplates: [] },
  menu: MENU,
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
      plugins: new Set(["templater-obsidian"]), installed: { lab: false, planning: false }, menu: null,
      templater: { templatesFolder: "", userScriptsFolder: "", menuHotkey: true, folderTemplates: [] },
      css: [{ name: "scrolling-mermaid", enabled: false }], folders: [{ path: "03 Lab Book/Notes", exists: false }],
    }));
    expect(r["plugin:dataview"]).toMatchObject({ ok: false, fix: { kind: "plugin", id: "dataview" } });
    expect(r["install:lab"]).toMatchObject({ ok: false, fix: { kind: "install", kit: "lab" } });
    expect(r["templater:templates-folder"].ok).toBe(false);
    expect(r["templater:templates-folder"].fix).toBeUndefined();          // Set up needs the kit installed first
    expect(r["templater:menu-hotkey"]).toBeUndefined();
    expect(r["css:scrolling-mermaid"].fix).toEqual({ kind: "css", names: ["scrolling-mermaid"] });
    expect(r["folder:03 Lab Book/Notes"].fix).toEqual({ kind: "folder", path: "03 Lab Book/Notes" });
  });

  it("Templater values already set are ok and get no fix", () => {
    const r = byId(state({ templater: { templatesFolder: "Mine", userScriptsFolder: "My scripts", menuHotkey: true, folderTemplates: [] } }));
    expect(r["templater:templates-folder"]).toMatchObject({ ok: true, fix: undefined });
    expect(r["templater:user-scripts"]).toMatchObject({ ok: true, fix: undefined });
  });

  it("planning on: Meta Bind and ZotLit (optional) are checked, a folder template is added only where the folder has none", () => {
    const r = byId(state({
      planning: true, installed: { lab: true, planning: true },
      templater: { templatesFolder: "T", userScriptsFolder: "S", menuHotkey: true, folderTemplates: [{ folder: "00 Planning/To-dos", template: "Mine.md" }] },
      folderTemplates: [{ folder: "01 Daily Notes", template: "T/Daily note.md" }, { folder: "00 Planning/To-dos", template: "T/To-do.md" }],
    }));
    expect(r["plugin:obsidian-meta-bind-plugin"].ok).toBe(false);
    expect(r["plugin:zotlit"]).toMatchObject({ ok: false, optional: true });
    expect(r["folder-template:01 Daily Notes"].fix).toEqual({ kind: "folder-template", folder: "01 Daily Notes", template: "T/Daily note.md" });
    expect(r["folder-template:00 Planning/To-dos"]).toMatchObject({ ok: true, fix: undefined });
    expect(r["folder-template:00 Planning/To-dos"].detail).toContain("Mine.md");
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
      templater: { templatesFolder: "T", userScriptsFolder: "S", menuHotkey: true, folderTemplates: [], ...t } }));
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

  it("Meta Bind buttons and the ZotLit checklist (planning only); no Dataview JS row since Phase 5a (no DataviewJS in the kit)", () => {
    const r = byId(state({ planning: true, metaBind: { missing: 3, total: 26, names: ["new-meeting-series", "go-deck", "help"] }, zotlitGuide: "07 How-tos/Obsidian/Set up ZotLit.md",
      plugins: new Set(["templater-obsidian", "dataview", "obsidian-meta-bind-plugin", "zotlit"]) }));
    expect(r["dataview:js"]).toBeUndefined();
    expect(r["metabind:buttons"]).toMatchObject({ ok: false, fix: { kind: "meta-bind" } });
    expect(r["metabind:buttons"].detail).toContain("3 of 26");
    expect(r["metabind:buttons"].detail).toContain("new-meeting-series, go-deck, help");
    expect(r["zotlit:settings"].fix).toEqual({ kind: "open-note", path: "07 How-tos/Obsidian/Set up ZotLit.md" });
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

  it("Methods folder Fix creates the suggested folder; ZotLit is a warning, not a tick", () => {
    const r = byId(state({ planning: true, lab: { initials: "A", dataRoot: true, methodsFolder: "", rigsFolder: "", labFolder: "L", chemicalFolder: "C" },
      plugins: new Set(["templater-obsidian", "dataview", "zotlit"]), zotlitGuide: "07 How-tos/Obsidian/Set up ZotLit.md" }));
    expect(r["lab:methods-folder"]).toMatchObject({ ok: false, optional: true, fix: { kind: "methods-folder", path: "Extras/methods" } });
    expect(r["lab:rigs-folder"]).toMatchObject({ ok: false, optional: true, fix: { kind: "rigs-folder", path: "03 Lab Book/Rigs" } });
    expect(r["lab:rigs-folder"].detail).toContain("Fix creates 03 Lab Book/Rigs and uses it.");
    expect(byId(state())["lab:rigs-folder"]).toMatchObject({ ok: true, detail: "Set." });
    expect(r["zotlit:settings"]).toMatchObject({ ok: false, warn: true });
    expect(r["zotlit:settings"].detail).toContain("07 How-tos/Obsidian/Set up ZotLit.md");
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

describe("check setup: ZotLit settings read from its data.json", () => {
  const zot = (o: Partial<NonNullable<SetupState["zotlitData"]>> = {}): SetupState["zotlitData"] => ({ readable: true, missing: [], differing: [], literature: "ok", templates: "ok", ...o });
  const on = (zotlitData: SetupState["zotlitData"]) => byId(state({ planning: true, zotlitData, plugins: new Set(["templater-obsidian", "dataview", "zotlit"]), zotlitGuide: "07 How-tos/Obsidian/Set up ZotLit.md" }));
  const field = { key: "DOI", expr: "zt.DOI", merge: "keep" as const, language: "liquid" as const };
  it("everything there: both rows are ok and the old warning is gone", () => {
    const r = on(zot());
    expect(r["zotlit:fields"]).toMatchObject({ ok: true });
    expect(r["zotlit:folders"]).toMatchObject({ ok: true });
    expect(r["zotlit:settings"]).toBeUndefined();
  });
  it("a missing field is a warning with a Fix that names it; yours that differ are named and have no Fix of their own", () => {
    const r = on(zot({ missing: [field], differing: [{ key: "Year", now: "zt.x (replace)", kit: "zt.date.year (replace)" }] }));
    expect(r["zotlit:fields"]).toMatchObject({ ok: false, warn: true, fix: { kind: "zotlit-fields" } });
    expect(r["zotlit:fields"].detail).toContain("DOI is missing");
    expect(r["zotlit:fields"].detail).toContain("Year differs (yours: zt.x (replace); kit: zt.date.year (replace))");
  });
  it("only differing fields: flagged as a warning to check by hand, nothing to fix", () => {
    const r = on(zot({ differing: [{ key: "Year", now: "a", kit: "b" }] }));
    expect(r["zotlit:fields"]).toMatchObject({ ok: false, warn: true });
    expect(r["zotlit:fields"].fix).toBeUndefined();
    expect(r["zotlit:fields"].detail).toContain("Year differs");
    expect(r["zotlit:fields"].detail).toContain("check the ones that differ");
  });
  it("folders: empty ones are fixed through the fields row Fix when fields are fine; your own folder is left alone", () => {
    const r = on(zot({ literature: "empty", templates: "other" }));
    expect(r["zotlit:folders"]).toMatchObject({ ok: false, warn: true, fix: { kind: "zotlit-fields" } });
    expect(r["zotlit:folders"].detail).toContain("Template folder is your own (left alone)");
    const both = on(zot({ missing: [field], literature: "empty" }));
    expect(both["zotlit:folders"].fix).toBeUndefined();   // the fields row's Fix sets both
  });
  it("no ZotLit data (no file or unreadable): the old warning stays, pointing at the checklist note", () => {
    const r = on(null);
    expect(r["zotlit:settings"]).toMatchObject({ ok: false, warn: true, fix: { kind: "open-note", path: "07 How-tos/Obsidian/Set up ZotLit.md" } });
    expect(r["zotlit:fields"]).toBeUndefined();
  });
});
