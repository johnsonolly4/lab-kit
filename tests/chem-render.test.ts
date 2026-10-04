// Chemical database in the calc tables: the user's MW property name, and the [[ suggestions while a cell is edited.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { AbstractInputSuggest, TFile, TFolder } from "obsidian";
import { CalcRenderer, type CalcEntry, type ChemSettings } from "../src/calc/render";
import { isErr } from "../src/calc/engine";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const MW_KEYS = ["mw", "mr", "molecular weight"];

const NOTES: Record<string, Record<string, unknown>> = {
  "Chem/Toluene.md": { "Molecular weight": 92.14, "Molar mass (g/mol)": 1, Density: 0.87, Names: ["PhMe"] },
  "Chem/Empty.md": { "Molecular weight": null },
  "Chem/Odd.md": { "Mol. wt": "100,5" },
};
const notes = Object.keys(NOTES).map(path => new TFile({ path, basename: path.slice(5, -3) }));

function make(settings: ChemSettings, text = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n") {
  let fileText = text;
  const app: any = {
    vault: {
      getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText,
      process: async (_f: unknown, fn: (d: string) => string) => { fileText = fn(fileText); },
      getFolderByPath: (p: string) => p === "Chem" ? new TFolder({ path: "Chem", children: notes }) : null,
      getFileByPath: (p: string) => notes.find(n => n.path === p) ?? null,
    },
    metadataCache: {
      getFirstLinkpathDest: (n: string) => notes.find(f => f.basename.toLowerCase() === n.toLowerCase()) ?? null,
      getFileCache: (f: TFile) => ({ frontmatter: NOTES[f.path] }),
    },
  };
  const renderer = new CalcRenderer({ app, registerEvent() { /* unused */ } } as any, () => settings);
  return { renderer, text: () => fileText };
}

describe("MW with the user's property name", () => {
  it("uses the configured property first, then the built-in names", () => {
    const { renderer } = make({ mwProperty: "Molar mass (g/mol)" });
    assert.strictEqual(renderer.env("n.md").prop("Toluene", MW_KEYS, true), 1);
    const plain = make({}).renderer.env("n.md");
    assert.strictEqual(plain.prop("Toluene", MW_KEYS, true), 92.14);
  });
  it("matches the configured name ignoring capitals and spacing, and reads a comma decimal", () => {
    const { renderer } = make({ mwProperty: "  MOL.  wt " });
    assert.strictEqual(renderer.env("n.md").prop("Odd", MW_KEYS, true), 100.5);
  });
  it("an empty or missing value is #PROP?, a missing note #NOTE?, and PROP() still reads any property", () => {
    const env = make({ mwProperty: "Molecular weight" }).renderer.env("n.md");
    const empty = env.prop("Empty", MW_KEYS, true), none = env.prop("Nope", MW_KEYS, true);
    assert.ok(isErr(empty) && empty.err === "#PROP?");
    assert.ok(isErr(none) && none.err === "#NOTE?");
    assert.strictEqual(env.prop("Toluene", ["density"], false), 0.87);
  });
});

describe("[[ suggestions in a calc cell", () => {
  async function open(settings: ChemSettings) {
    const h = make(settings);
    const el = new El("div");
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }), addChild() { /* unused */ } };
    const entry: CalcEntry = { el, ctx, source: "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |" };
    h.renderer.live.set("n.md", new Set([entry]));
    await h.renderer.render(entry);
    const td = entry.tds!.get("1|0")!;
    td.dispatch("click");
    const input = td.querySelector("input");
    const key = (k: string) => { let stopped = false; for (const f of input.listeners.keydown) f({ key: k, preventDefault() { /* unused */ }, stopPropagation() { stopped = true; } }); return stopped; };
    return { ...h, input, key };
  }
  const popup = () => (AbstractInputSuggest as any).instances.at(-1);
  const settle = () => new Promise(r => setTimeout(r, 10));

  it("no popup without a chemical folder", async () => {
    const before = (AbstractInputSuggest as any).instances.length;
    await open({});
    assert.strictEqual((AbstractInputSuggest as any).instances.length, before);
  });

  it("suggests while [[ is typed; Enter then belongs to the popup, a pick fills the cell, the next Enter saves", async () => {
    const { input, key, text } = await open({ chemicalFolder: "Chem" });
    input.value = "[[phm"; input.selectionStart = 5;
    const found = popup().getSuggestions(input.value);
    assert.deepStrictEqual(found.map((s: any) => [s.chemical.name, s.alias]), [["Toluene", "PhMe"]]);
    assert.strictEqual(key("Enter"), false, "Enter was taken from the popup");
    await settle();
    assert.ok(!text().includes("[[phm"), "saved while the popup was open");
    popup().selectSuggestion(found[0]);
    assert.strictEqual(input.value, "[[Toluene|PhMe]]");
    assert.strictEqual(key("Enter"), true);
    await settle();
    assert.ok(text().includes("| [[Toluene|PhMe]] | 5 |"), text());
  });

  it("with no suggestions showing, Enter and Escape work as before", async () => {
    const { input, key, text } = await open({ chemicalFolder: "Chem" });
    input.value = "7"; input.selectionStart = 1;
    assert.deepStrictEqual(popup().getSuggestions("7"), []);
    assert.strictEqual(key("Escape"), true);
    await settle();
    assert.ok(!text().includes("| 7 |"), "Escape saved");
  });
});
