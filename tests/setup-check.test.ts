// Phase 6: the setup check's list (pure: a SetupState in, items out).
import { describe, it, expect } from "vitest";
import { checkSetup, type SetupState } from "../src/kit/setup-check";

const MENU = "Extras/Templates/Lab Kit/Insert snippet.md";
const CMD = `templater-obsidian:${MENU}`;
const state = (o: Partial<SetupState> = {}): SetupState => ({
  plugins: new Set(["templater-obsidian", "dataview"]),
  planning: false,
  templater: { templatesFolder: "Extras/Templates", userScriptsFolder: "Extras/scripts/templater", menuHotkey: true, folderTemplates: [] },
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
    expect(r["plugin:obsidian-zotero-desktop-connector"]).toMatchObject({ ok: false, optional: true });
    expect(r["folder-template:01 Daily Notes"].fix).toEqual({ kind: "folder-template", folder: "01 Daily Notes", template: "T/Daily note.md" });
    expect(r["folder-template:00 Planning/To-dos"]).toMatchObject({ ok: true, fix: undefined });
    expect(r["folder-template:00 Planning/To-dos"].detail).toContain("Mine.md");
  });

  it("ZotLit counts as present under its kit name", () => {
    const r = byId(state({ planning: true, plugins: new Set(["templater-obsidian", "dataview", "zotlit"]) }));
    expect(r["plugin:obsidian-zotero-desktop-connector"].ok).toBe(true);
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
});
