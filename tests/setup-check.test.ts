// Phase 6: the setup check's list (pure: a SetupState in, items out).
import { describe, it, expect } from "vitest";
import { checkSetup, type SetupState } from "../src/kit/setup-check";

const MENU = "Extras/Templates/Lab Kit/Insert snippet.md";
const CMD = `templater-obsidian:${MENU}`;
const state = (o: Partial<SetupState> = {}): SetupState => ({
  lab: { initials: "ABC", dataRoot: true, methodsFolder: "Methods", labFolder: "03 Lab Book/Notes", chemicalFolder: "05 Chemicals/Chemicals" },
  dataviewJs: true,
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
  hotkeyCommands: { "Insert snippet": CMD },
  hotkeys: { [CMD]: [{ modifiers: ["Alt"], key: "S" }] },
  commandNames: { "editor:save": "Save" },
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
      hotkeyCommands: { "Insert snippet": null },
    }));
    expect(r["plugin:dataview"]).toMatchObject({ ok: false, fix: { kind: "plugin", id: "dataview" } });
    expect(r["install:lab"]).toMatchObject({ ok: false, fix: { kind: "install", kit: "lab" } });
    expect(r["templater:templates-folder"].ok).toBe(false);
    expect(r["templater:templates-folder"].fix).toBeUndefined();          // Set up needs the kit installed first
    expect(r["templater:menu-hotkey"]).toBeUndefined();
    expect(r["css:scrolling-mermaid"].fix).toEqual({ kind: "css", names: ["scrolling-mermaid"] });
    expect(r["folder:03 Lab Book/Notes"].fix).toEqual({ kind: "folder", path: "03 Lab Book/Notes" });
    expect(r["hotkey:Insert snippet"].ok).toBe(false);
    expect(r["hotkey:Insert snippet"].fix).toBeUndefined();
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

  it("ZotLit counts as present under its kit name", () => {
    const r = byId(state({ planning: true, plugins: new Set(["templater-obsidian", "dataview", "zotlit"]) }));
    expect(r["plugin:zotlit"].ok).toBe(true);
  });

  it("hotkey: offered when free, not offered on a clash, the user's own key is left alone", () => {
    expect(byId(state({ hotkeys: {} }))["hotkey:Insert snippet"].fix).toEqual({ kind: "hotkey", command: CMD, key: { modifiers: ["Alt"], key: "S" } });
    const clash = byId(state({ hotkeys: { "editor:save": [{ modifiers: ["Alt"], key: "s" }] } }))["hotkey:Insert snippet"];
    expect(clash).toMatchObject({ ok: false, fix: undefined });
    expect(clash.detail).toContain("Save");
    const own = byId(state({ hotkeys: { [CMD]: [{ modifiers: ["Mod"], key: "I" }] } }))["hotkey:Insert snippet"];
    expect(own.ok).toBe(true);
    expect(own.fix).toBeUndefined();
    expect(own.detail).toContain("Mod+I");
    expect(byId(state({ hotkeys: null }))["hotkey:Insert snippet"].fix).toBeUndefined();
  });

  it("folder template: no Fix until the planning kit is installed", () => {
    const r = byId(state({ planning: true, installed: { lab: true, planning: false } }));
    expect(r["folder-template:01 Daily Notes"].ok).toBe(false);
    expect(r["folder-template:01 Daily Notes"].fix).toBeUndefined();
    expect(r["folder-template:01 Daily Notes"].detail).toContain("Install the planning kit first");
  });

  it("Lab Kit settings: empty initials, data root, folders are red and open settings; methods folder is optional", () => {
    const r = byId(state({ lab: { initials: "", dataRoot: false, methodsFolder: "", labFolder: "", chemicalFolder: "" } }));
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

  it("Dataview JS, Meta Bind buttons and the ZotLit checklist (planning only)", () => {
    const off = byId(state({ dataviewJs: false, metaBind: { missing: 3, total: 26 } }));
    expect(off["dataview:js"]).toBeUndefined();               // lab only: not listed
    const r = byId(state({ planning: true, dataviewJs: false, metaBind: { missing: 3, total: 26 }, zotlitGuide: "07 How-tos/Obsidian/Set up ZotLit.md",
      plugins: new Set(["templater-obsidian", "dataview", "obsidian-meta-bind-plugin", "zotlit"]) }));
    expect(r["dataview:js"].fix).toEqual({ kind: "dataview-js" });
    expect(r["metabind:buttons"]).toMatchObject({ ok: false, fix: { kind: "meta-bind" } });
    expect(r["metabind:buttons"].detail).toContain("3 of 26");
    expect(r["zotlit:settings"].fix).toEqual({ kind: "open-note", path: "07 How-tos/Obsidian/Set up ZotLit.md" });
  });

  it("Methods folder Fix creates the suggested folder; ZotLit is a warning, not a tick", () => {
    const r = byId(state({ planning: true, lab: { initials: "A", dataRoot: true, methodsFolder: "", labFolder: "L", chemicalFolder: "C" },
      plugins: new Set(["templater-obsidian", "dataview", "zotlit"]), zotlitGuide: "07 How-tos/Obsidian/Set up ZotLit.md" }));
    expect(r["lab:methods-folder"]).toMatchObject({ ok: false, optional: true, fix: { kind: "methods-folder", path: "Extras/methods" } });
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
