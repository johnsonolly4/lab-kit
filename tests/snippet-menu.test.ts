// The Alt+S menu's contents (pure): groups, section order, Recent, search ranking (docs/plans/snippet-menu.md Phase 1).
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { groupOf, iconNames, menuSections, pushRecent, searchItems, type MenuItem } from "../src/kit/snippet-menu";

const kit = ["Solution prep", "Recipe by equivalents", "RAFT recipe generator", "Variant naming matrix", "Sample list", "Sampling timetable",
  "NMR samples", "GPC samples", "DLS samples", "Combined results", "Flow column prep", "Residence times", "Blank calc table", "Rig"];
const descs: Record<string, string> = { "GPC samples": "Sample / eluent / Mn / Mw / Đ, checklist · tags GPC", "Combined results": "One row per sample with NMR, GPC and DLS values pulled in" };
const items: MenuItem[] = kit.map(name => ({ name, desc: descs[name], value: name }));
const method: MenuItem = { name: "UV-vis", desc: "Absorbance", value: { method: "uv-vis" } };
const mine: MenuItem = { name: "Solution prep (mine)", value: "mine" };

describe("snippet menu", () => {
  it("every kit snippet is in its agreed group; methods are Characterise; anything else is My snippets", () => {
    const g = (n: string) => groupOf(items.find(i => i.name === n)!);
    expect(["Solution prep", "Recipe by equivalents", "RAFT recipe generator"].map(g)).toEqual(Array(3).fill("Make up"));
    expect(["Sample list", "Sampling timetable", "Variant naming matrix"].map(g)).toEqual(Array(3).fill("Samples"));
    expect(["NMR samples", "GPC samples", "DLS samples", "Combined results"].map(g)).toEqual(Array(4).fill("Characterise"));
    expect(["Rig", "Flow column prep", "Residence times"].map(g)).toEqual(Array(3).fill("Flow"));
    expect(g("Blank calc table")).toBe("Tables");
    expect(groupOf(method)).toBe("Characterise");
    expect(groupOf(mine)).toBe("My snippets");
  });
  it("a header's group wins over the built-in map when it names one of the groups; any other group text is My snippets", () => {
    expect(groupOf({ name: "Solution prep", group: "Tables", value: 1 })).toBe("Tables");
    expect(groupOf({ name: "Anything", group: " samples ", value: 1 })).toBe("Samples");
    expect(groupOf({ name: "Solution prep", group: "Unknown", value: 1 })).toBe("Make up");
    expect(groupOf({ name: "Mine", group: "Unknown", value: 1 })).toBe("My snippets");
  });
  it("sections: groups in the fixed order, file order inside a group, My snippets last and only when not empty", () => {
    const s = menuSections([...items, method], []);
    expect(s.map(x => x.heading)).toEqual(["Make up", "Samples", "Characterise", "Flow", "Tables"]);
    expect(s[1].items.map(i => i.name)).toEqual(["Variant naming matrix", "Sample list", "Sampling timetable"]);
    expect(s[2].items.map(i => i.name)).toEqual(["NMR samples", "GPC samples", "DLS samples", "Combined results", "UV-vis"]);
    expect(menuSections([...items, mine], []).at(-1)).toMatchObject({ heading: "My snippets", items: [mine] });
  });
  it("Recent: first, newest first, at most 3, only snippets still listed", () => {
    const s = menuSections(items, ["GPC samples", "Gone snippet", "Rig", "Sample list", "Solution prep"]);
    expect(s[0]).toMatchObject({ heading: "Recent" });
    expect(s[0].items.map(i => i.name)).toEqual(["GPC samples", "Rig", "Sample list"]);
    expect(menuSections(items, ["Gone"])[0].heading).toBe("Make up");
  });
  it("pushRecent puts the pick first, no repeats, cap 3", () => {
    expect(pushRecent([], "Rig")).toEqual(["Rig"]);
    expect(pushRecent(["A", "B", "C"], "B")).toEqual(["B", "A", "C"]);
    expect(pushRecent(["A", "B", "C"], "D")).toEqual(["D", "A", "B"]);
  });
  it("search: one flat list, name start > word start > contains (name or description), ties in menu order", () => {
    expect(searchItems(items, "gp").map(i => i.name)).toEqual(["GPC samples", "Combined results"]);
    expect(searchItems(items, "samp").map(i => i.name)).toEqual(["Sample list", "Sampling timetable", "NMR samples", "GPC samples", "DLS samples", "Combined results"]);
    expect(searchItems(items, "hplc")).toEqual([]);
    expect(searchItems(items, "  ")).toBe(items);
  });
  it("icons: the Snippet icons setting first, then the snippet's own (comma lists allowed)", () => {
    expect(iconNames({ name: "Rig", icon: "waves, git-branch", value: 1 }, { Rig: "pipette" })).toEqual(["pipette", "waves", "git-branch"]);
    expect(iconNames({ name: "Rig", value: 1 }, {})).toEqual([]);
  });
});

describe("built-in methods in the menu (labMethods.js menuEntries)", () => {
  const labMethods = createRequire(import.meta.url)("../kits/lab/Extras/scripts/templater/labMethods.js");
  const app = { vault: { adapter: { read: async () => { throw new Error("no settings"); } }, getFolderByPath: () => null } };

  it("without the flag the built-ins are left out; with it NMR, GPC and DLS come first, with the old stubs' icon and description", async () => {
    expect(await labMethods.menuEntries(app)).toEqual([]);
    const e = await labMethods.menuEntries(app, { builtins: true });
    expect(e.map((x: { name: string }) => x.name)).toEqual(["NMR samples", "GPC samples", "DLS samples"]);
    expect(e.map((x: { key: string }) => x.key)).toEqual(["nmr", "gpc", "dls"]);
    expect(e.map((x: { icon: string }) => x.icon)).toEqual(["magnet", "line-chart, chart-line", "sparkles"]);
    expect(e[0].desc).toBe("Sample / solvent / method / conversion, dataset, checklist · tags NMR");
    expect(e[1].desc).toBe("Sample / eluent / Mn / Mw / Đ, checklist · tags GPC");
    expect(e[2].desc).toBe("Sample / solvent / temperature / Dh / PDI, checklist · tags DLS");
  });
  it("in the menu they stand ahead of Combined results and the other methods, in Characterise", async () => {
    const e = await labMethods.menuEntries(app, { builtins: true });
    const built: MenuItem[] = e.map((m: { key: string; name: string }) => ({ name: m.name, value: { method: m.key } }));
    const files: MenuItem[] = [{ name: "Sample list", value: "f5" }, { name: "Combined results", group: "Characterise", value: "f10" }];
    const s = menuSections([...files, { name: "UV-vis", value: { method: "uv-vis" } }, ...built], []);
    expect(s.find(x => x.heading === "Characterise")!.items.map(i => i.name)).toEqual(["NMR samples", "GPC samples", "DLS samples", "Combined results", "UV-vis"]);
  });
});
