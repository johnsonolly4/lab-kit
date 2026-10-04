import { describe, expect, it } from "vitest";
import { addTemplaterHotkey } from "../src/kit/obsidian-private";

const appWith = (tpl: unknown): any => ({ plugins: { plugins: { "templater-obsidian": tpl } } });

describe("addTemplaterHotkey", () => {
  it("adds the template once, syncs the commands and saves", async () => {
    let synced = 0, saved = 0;
    const tpl = { settings: { enabled_templates_hotkeys: ["Other.md"] }, command_handler: { sync_template_hotkeys: () => { synced++; } }, save_settings: async () => { saved++; } };
    expect(await addTemplaterHotkey(appWith(tpl), "Templates/Lab Kit/Insert snippet.md")).toBe(true);
    expect(tpl.settings.enabled_templates_hotkeys).toEqual(["Other.md", "Templates/Lab Kit/Insert snippet.md"]);
    expect([synced, saved]).toEqual([1, 1]);
    expect(await addTemplaterHotkey(appWith(tpl), "Templates/Lab Kit/Insert snippet.md")).toBe(false);
    expect([synced, saved]).toEqual([1, 1]);
  });

  it("recognises the object form and uses the older per-template call", async () => {
    const calls: unknown[] = [];
    const tpl = { settings: { enabled_templates_hotkeys: [{ template: "A.md" }] }, command_handler: { add_template_hotkey: (...a: unknown[]) => { calls.push(a); } }, saveSettings: async () => { /* saved */ } };
    expect(await addTemplaterHotkey(appWith(tpl), "A.md")).toBe(false);
    expect(await addTemplaterHotkey(appWith(tpl), "B.md")).toBe(true);
    expect(calls).toEqual([[null, "B.md"]]);
  });

  it("does nothing without Templater", async () => {
    expect(await addTemplaterHotkey(appWith(undefined), "A.md")).toBe(false);
  });
});

describe("templaterScriptsNeedChange", () => {
  it("only asks for a change when Templater cannot find the kit's scripts", async () => {
    const { templaterScriptsNeedChange: need } = await import("../src/kit/managed");
    expect(need("", "Extras/scripts/lab-kit")).toBe(true);
    expect(need(undefined, "Extras/scripts/lab-kit")).toBe(true);
    expect(need("Extras/scripts/lab-kit", "Extras/scripts/lab-kit")).toBe(false);
    expect(need("Extras/scripts/", "Extras/scripts/lab-kit")).toBe(false);   // a folder above: Templater reads subfolders
    expect(need("Extras/scripts-old", "Extras/scripts/lab-kit")).toBe(true);
    expect(need("Other", "Extras/scripts/lab-kit")).toBe(true);
  });
});
