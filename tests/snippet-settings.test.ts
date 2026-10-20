// Settings → Lab Kit → Snippets: one toggle per Alt+S group (docs/plans/snippet-menu.md Phase 4).
import { describe, it, expect } from "vitest";
import { GROUPS, OWN_GROUP, visibleItems, menuSections, searchItems } from "../src/kit/snippet-menu";
import { FORMS_AT_CURSOR, GROUP_TOGGLE_DESC, formsAtCursorRow, groupToggleRows, setGroupShown } from "../src/kit/snippet-settings";
import { KIT_DEFAULTS, kitLoad, type KitData } from "../src/kit/paths";

/** A stand-in for the setting builder: addToggle hands the callback a toggle that remembers its value and handler. */
function draw(kit: KitData, save: () => Promise<void>) {
  return groupToggleRows(kit, save).map(row => {
    const t = { value: undefined as boolean | undefined, handler: undefined as ((v: boolean) => Promise<void>) | undefined,
      setValue(v: boolean) { this.value = v; return this; }, onChange(h: (v: boolean) => Promise<void>) { this.handler = h; return this; } };
    (row as { render: (b: unknown) => void }).render({ addToggle: (cb: (t: unknown) => void) => cb(t) });
    return { name: (row as { name: string }).name, desc: (row as { desc: string }).desc, t };
  });
}

describe("Snippets settings: group toggles", () => {
  it("one toggle per group, named like the group, all on by default", () => {
    const rows = draw({ ...KIT_DEFAULTS, snippetGroupsOff: [] }, async () => {});
    expect(rows.map(r => r.name)).toEqual([...GROUPS, "My snippets"]);
    expect(rows).toHaveLength(6);
    expect(OWN_GROUP).toBe("My snippets");
    expect(rows.every(r => r.desc === "Show these snippets in the Alt+S menu." && r.desc === GROUP_TOGGLE_DESC)).toBe(true);
    expect(rows.every(r => r.t.value === true)).toBe(true);
  });
  it("a group saved as off shows off; switching writes kit.snippetGroupsOff and saves", async () => {
    const kit: KitData = { ...KIT_DEFAULTS, snippetGroupsOff: ["Flow"] };
    let saves = 0;
    const rows = draw(kit, async () => { saves++; });
    expect(rows.find(r => r.name === "Flow")!.t.value).toBe(false);
    await rows.find(r => r.name === "Tables")!.t.handler!(false);
    expect(kit.snippetGroupsOff).toEqual(["Flow", "Tables"]);
    await rows.find(r => r.name === "Flow")!.t.handler!(true);
    expect(kit.snippetGroupsOff).toEqual(["Tables"]);
    expect(saves).toBe(2);
  });
  it("My snippets can be switched off: menu, search and Recent skip it", async () => {
    const kit: KitData = { ...KIT_DEFAULTS, snippetGroupsOff: [] };
    const rows = draw(kit, async () => {});
    await rows.find(r => r.name === "My snippets")!.t.handler!(false);
    expect(kit.snippetGroupsOff).toEqual(["My snippets"]);
    const items = [{ name: "Mine", value: 1 }, { name: "Unknown", group: "Nope", value: 1 }, { name: "Tab", group: "Tables", value: 1 }];
    const shown = visibleItems(items, kit.snippetGroupsOff);
    expect(shown.map(i => i.name)).toEqual(["Tab"]);
    expect(menuSections(shown, ["Mine", "Tab"]).map(s => s.heading)).toEqual(["Recent", "Tables"]);
    expect(menuSections(shown, ["Mine"]).map(s => s.heading)).toEqual(["Tables"]);
    expect(searchItems(shown, "mine")).toEqual([]);
  });
  it("setGroupShown never repeats a group", () => {
    const kit = { snippetGroupsOff: ["Flow"] };
    setGroupShown(kit, "Flow", false);
    expect(kit.snippetGroupsOff).toEqual(["Flow"]);
  });
  it("data.json: missing or wrong snippetGroupsOff loads as an empty list", () => {
    expect(kitLoad({}).snippetGroupsOff).toEqual([]);
    expect(kitLoad({ snippetGroupsOff: "Flow" }).snippetGroupsOff).toEqual([]);
    expect(kitLoad({ snippetGroupsOff: ["Flow", 3] }).snippetGroupsOff).toEqual(["Flow"]);
  });
});

describe("Snippets settings: Open snippet forms at the cursor (N4 Q8, Q12)", () => {
  const row = (kit: KitData, save: () => Promise<void>) => {
    const t = { value: undefined as boolean | undefined, handler: undefined as ((v: boolean) => Promise<void>) | undefined,
      setValue(v: boolean) { this.value = v; return this; }, onChange(h: (v: boolean) => Promise<void>) { this.handler = h; return this; } };
    const r = formsAtCursorRow(kit, save) as unknown as { name: string; desc: string; render: (b: unknown) => void };
    r.render({ addToggle: (cb: (t: unknown) => void) => cb(t) });
    return { r, t };
  };
  it("is on by default, with the plan's name and description", () => {
    expect(KIT_DEFAULTS.snippetFormsAtCursor).toBe(true);
    const { r, t } = row({ ...KIT_DEFAULTS }, async () => {});
    expect([r.name, r.desc]).toEqual([FORMS_AT_CURSOR.name, FORMS_AT_CURSOR.desc]);
    expect(r.name).toBe("Open snippet forms at the cursor");
    expect(r.desc).toBe("Off: forms open in the middle of the window.");
    expect(t.value).toBe(true);
  });
  it("switching writes the setting and saves; data.json without it loads as on, an explicit false stays off", async () => {
    const kit: KitData = { ...KIT_DEFAULTS };
    let saves = 0;
    const { t } = row(kit, async () => { saves++; });
    await t.handler!(false);
    expect([kit.snippetFormsAtCursor, saves]).toEqual([false, 1]);
    expect(kitLoad({}).snippetFormsAtCursor).toBe(true);
    expect(kitLoad({ snippetFormsAtCursor: false }).snippetFormsAtCursor).toBe(false);
  });
});
