// The Alt+S menu's contents (pure): groups, section order, Recent, search ranking (docs/plans/snippet-menu.md Phase 1).
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { groupOf, hideShadowedStubs, iconNames, menuSections, pushRecent, searchItems, visibleItems, type MenuItem } from "../src/kit/snippet-menu";

const kit = ["Solution prep", "Recipe by equivalents", "RAFT recipe generator", "Variant naming matrix", "Sample list", "Sampling timetable",
  "NMR samples", "GPC samples", "DLS samples", "Combined results", "Flow column prep", "Residence times", "Blank calc table", "Rig"];
const descs: Record<string, string> = { "GPC samples": "Sample / eluent / Mn / Mw / Đ, checklist · tags GPC", "Combined results": "One row per sample with NMR, GPC and DLS values pulled in" };
// the group each kit snippet's header carries (checked against the files below)
const kitGroup: Record<string, string> = { "Solution prep": "Make up", "Recipe by equivalents": "Make up", "RAFT recipe generator": "Make up", "Variant naming matrix": "Samples", "Sample list": "Samples", "Sampling timetable": "Samples",
  "NMR samples": "Characterise", "GPC samples": "Characterise", "DLS samples": "Characterise", "Combined results": "Characterise", "Flow column prep": "Flow", "Residence times": "Flow", "Rig": "Flow", "Blank calc table": "Tables" };
const items: MenuItem[] = kit.map(name => ({ name, desc: descs[name], group: kitGroup[name], value: name }));
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
  it("the header's group decides (no built-in name map): a name alone is My snippets, a group that is not one of the five is My snippets", () => {
    expect(groupOf({ name: "Solution prep", group: "Tables", value: 1 })).toBe("Tables");
    expect(groupOf({ name: "Anything", group: " samples ", value: 1 })).toBe("Samples");
    expect(groupOf({ name: "Solution prep", group: "Unknown", value: 1 })).toBe("My snippets");
    expect(groupOf({ name: "Solution prep", value: 1 })).toBe("My snippets");
  });
  it("the kit files' own headers put each snippet in the agreed group", () => {
    const dir = "kits/lab/Templates/Snippets";
    const files = readdirSync(dir).filter(f => f.endsWith(".md"));
    expect(files.length).toBe(11);
    for (const f of files) {
      const head = readFileSync(`${dir}/${f}`, "utf8").split("\n---")[0];
      const title = /^title: (.+)$/m.exec(head)![1].trim();
      const group = /^group: (.+)$/m.exec(head)?.[1].trim();
      expect(group, f).toBe(kitGroup[title]);
    }
  });
  it("switched-off groups are skipped by the menu, the search and Recent", () => {
    const shown = visibleItems([...items, method, mine], ["Characterise", "tables"]);
    expect(shown.some(i => ["NMR samples", "Combined results", "Blank calc table"].includes(i.name))).toBe(false);
    expect(shown).toContain(mine);
    expect(menuSections(shown, ["GPC samples", "Rig"])[0].items.map(i => i.name)).toEqual(["Rig"]);
    expect(menuSections(shown, []).map(s => s.heading)).toEqual(["Make up", "Samples", "Flow", "My snippets"]);
    expect(searchItems(shown, "samp").map(i => i.name)).toEqual(["Sample list", "Sampling timetable"]);
    expect(visibleItems(items, [])).toBe(items);
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

describe("old stub files beside the built-in methods", () => {
  const nmr: MenuItem = { name: "NMR samples", value: { method: "nmr" } };
  const stub: MenuItem = { name: "NMR samples", oldStub: "nmr", value: "f7" };
  const names = (list: MenuItem[]) => menuSections(hideShadowedStubs(list), []).flatMap(s => s.items).map(i => i.name);
  it("NMR is listed once with the old file, once without it", () => {
    expect(names([stub, nmr])).toEqual(["NMR samples"]);
    expect(hideShadowedStubs([stub, nmr])).toEqual([nmr]);
    expect(names([nmr])).toEqual(["NMR samples"]);
  });
  it("a stub whose calculator is no built-in method, or a run: header, stays", () => {
    const other: MenuItem = { name: "Solution prep (old)", oldStub: "solution", value: "f1" };
    expect(hideShadowedStubs([other, nmr])).toEqual([other, nmr]);
    expect(hideShadowedStubs([{ name: "Mine", value: "f" }, nmr]).length).toBe(2);
  });
});
