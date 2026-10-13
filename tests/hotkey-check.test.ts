// Check hotkeys: the report per kit function (pure: a HotkeyState in, rows out).
import { describe, it, expect } from "vitest";
import { RECOMMENDED_HOTKEYS, checkHotkeys, hotkeyReportMarkdown, type HotkeyState } from "../src/kit/hotkey-check";

const SNIP = "templater-obsidian:Extras/Templates/Lab Kit/Insert snippet.md";
const state = (o: Partial<HotkeyState> = {}): HotkeyState => ({
  planning: true,
  hotkeys: { [SNIP]: [{ modifiers: ["Alt"], key: "S" }] },
  commands: { [SNIP]: "Templater: Insert Extras/Templates/Lab Kit/Insert snippet.md", "lab-kit:new-todo": "Lab Kit: New to-do", "editor:save": "Save", "omnisearch:show-modal": "Omnisearch: Vault search" },
  ...o,
});
const by = (s: HotkeyState) => Object.fromEntries(checkHotkeys(s).map(r => [r.command, r]));

describe("check hotkeys", () => {
  it("finds a template command by name (Templater names it after the path) and reports it set", () => {
    expect(by(state())["Templater: Insert snippet.md"]).toMatchObject({ status: "set", recommended: "Alt+S", current: ["Alt+S"] });
  });
  it("not set, a key of the user's own left alone, and a clash named", () => {
    expect(by(state({ hotkeys: {} }))["Lab Kit: New to-do"]).toMatchObject({ status: "none", detail: "Not set." });
    expect(by(state({ hotkeys: { "lab-kit:new-todo": [{ modifiers: ["Mod"], key: "T" }] } }))["Lab Kit: New to-do"]).toMatchObject({ status: "other", current: ["Mod+T"] });
    const clash = by(state({ hotkeys: { "editor:save": [{ modifiers: ["Alt"], key: "t" }] } }))["Lab Kit: New to-do"];
    expect(clash.status).toBe("clash");
    expect(clash.detail).toMatch(/already used by Save/);
  });
  it("a command that isn't there is missing; unreadable hotkeys are reported, not guessed", () => {
    expect(by(state())["ZotLit: insert citation"].status).toBe("missing");
    expect(by(state({ hotkeys: null }))["Lab Kit: New to-do"].status).toBe("unreadable");
  });
  it("commands with no suggested key show their key when you set one", () => {
    const s = state({ commands: { "lab-kit:sort": "Lab Kit: Sort inbox" }, hotkeys: { "lab-kit:sort": [{ modifiers: ["Mod"], key: "I" }] } });
    expect(by(s)["Lab Kit: Sort inbox"]).toMatchObject({ status: "set", recommended: "", current: ["Mod+I"] });
  });
  it("planning rows are left out with the planning kit off", () => {
    const r = checkHotkeys(state({ planning: false }));
    expect(r.every(x => RECOMMENDED_HOTKEYS.find(h => h.command === x.command)?.kit === "lab")).toBe(true);
    expect(r.map(x => x.command)).toEqual(["Lab Kit: New lab entry", "Templater: Insert snippet.md", "Lab Kit: New chemical", "Lab Kit: New rig", "Lab Kit: Clone experiment"]);
  });
  it("Markdown report has a row per function", () => {
    const md = hotkeyReportMarkdown(checkHotkeys(state()));
    expect(md.split("\n").length).toBe(2 + RECOMMENDED_HOTKEYS.length);
    expect(md).toContain("`Alt+S`");
  });
});
