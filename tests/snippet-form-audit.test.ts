// I23 Phase 2 leftover (2), form audit 2026-10-20: EVERY snippet in the Alt+S menu asks through the plugin's own form
// (src/kit/snippet-form.ts, handed in as `form`), with Templater absent. Rows of the table in docs/plans/snippet-menu.md "Form audit 2026-10-20".
import { DEFAULT_RAFT, raftLines } from "../src/blocks/raft/text";
import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { Notice, TFile, TFolder } from "obsidian";
import { SnippetTemplates } from "../src/kit/snippet-run";
import { insertSnippet, type InsertDeps } from "../src/kit/snippet-insert";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import type { FormField } from "../src/kit/snippet-form";
import { miniYaml } from "./token-snippets";

const require = createRequire(import.meta.url);
const labSnippets = require("../src/kit/bundled/labSnippets.js");
const labMethods = require("../src/kit/bundled/labMethods.js");

const DIR = "kits/lab/Snippets";
const FOLDER = "Templates/Snippets";
// The stub's parseYaml reads JSON only: the shipped header becomes JSON, the body stays as written.
const asJson = (text: string): string => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)!;
  return `---\n${JSON.stringify(miniYaml(m[1]))}\n---\n${m[2]}`;
};
const kitFiles = readdirSync(DIR).filter(f => f.endsWith(".md")).sort().map(f => ({ name: f.replace(/\.md$/, ""), text: asJson(readFileSync(`${DIR}/${f}`, "utf8")) }));
const MASS_SPEC = { Columns: ["Sample", "m/z"], Results: ["m/z"] };
const RIG = readFileSync("tests/fixtures/rigs/inline-analysis.md", "utf8");

/** What Alt+S asks, per menu entry: [menu name, the form title(s) the plugin form is opened with]. */
const EXPECTED: [string, string[]][] = [
  ["Solution prep", []],   // the live block: its own set-up window (src/solution/setup.ts), not the question form
   ["Recipe by equivalents", ["Recipe by equivalents"]], ["RAFT recipe generator", []],   // the live block: its own set-up window (src/blocks/raft/setup.ts), not the question form
  
  ["Variant naming matrix", ["Variant naming matrix"]], ["Sample list", ["Sample list"]], ["Sampling timetable", ["Sampling timetable"]],
  ["Combined results", ["Combined results table"]],
  ["Flow column prep", ["Flow column prep"]], ["Residence times", ["Residence times"]], ["Blank calc table", ["Blank calc table"]], ["Rig", ["Rig"]],
  ["NMR samples", ["NMR samples"]], ["GPC samples", ["GPC samples"]], ["DLS samples", ["DLS samples"]], ["Mass spec samples", ["Mass spec samples"]],
];

function setup(pick: string) {
  const typed: string[] = [], inserted: string[] = [];
  const files = kitFiles.map(f => ({ file: new TFile({ path: `${FOLDER}/${f.name}.md`, basename: f.name }), text: f.text }));
  for (const f of files) (f.file as { parent?: unknown }).parent = { path: FOLDER };
  const texts = new Map(files.map(f => [f.file.path, f.text]));
  const rigNote = new TFile({ path: "Rigs/Rig A.md", basename: "Rig A" });
  const rigs = new TFolder({ path: "Rigs", children: [rigNote] });
  const methodNote = { extension: "md", basename: "Mass spec", path: "Methods/Mass spec.md" };
  const app = {
    vault: {
      getMarkdownFiles: () => files.map(f => f.file),
      cachedRead: async (f: TFile) => (f === rigNote ? RIG : texts.get(f.path) ?? ""),
      adapter: { read: async () => JSON.stringify({ kit: { initials: "ABC", methodsFolder: "Methods" } }) },
      getFolderByPath: (p: string) => (p === "Methods" ? { children: [methodNote] } : p === "Rigs" ? rigs : null),
      // the Rig snippet takes a snapshot of the rig (src/rig/snapshot-io.ts): a new file and a history row
      read: async (f: TFile) => (f === rigNote ? RIG : texts.get(f.path) ?? ""),
      getAbstractFileByPath: (p: string) => (texts.has(p) ? new TFile({ path: p, basename: p.split("/").pop()!.replace(/\.[^.]*$/, ""), extension: p.split(".").pop() }) : null),
      createFolder: async () => { /* folders are implied by the paths */ },
      create: async (p: string, text: string) => { texts.set(p, text); return new TFile({ path: p, basename: p.split("/").pop()!.replace(/\.[^.]*$/, ""), extension: "svg" }); },
      process: async () => { /* the rig note's history row is tested in snippet-rig.test.ts */ },
    },
    workspace: { activeEditor: { editor: { getValue: () => "", getCursor: () => ({ line: 0, ch: 0 }), offsetToPos: (o: number) => ({ line: 0, ch: o }), replaceRange: () => { /* the rig also writes properties */ } } }, getActiveFile: () => ({ basename: "0016 - Test", path: "0016 - Test.md" }) },
    metadataCache: { getFileCache: () => ({ frontmatter: MASS_SPEC }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* not under test */ }, generateMarkdownLink: (f: TFile) => `[[${f.path}]]` },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC", rigsFolder: "Rigs" } as KitData;
  // The plugin's form, as a recording fake: every field answered with its default (a required text field gets a value so the snippet goes on).
  const form = async (title: string, fields: FormField[]): Promise<Record<string, unknown>> => {
    typed.push(title);
    return Object.fromEntries(fields.filter(f => f.key).map(f => [f.key, f.type === "toggle" ? !!f.value : f.key === "rig" ? "Rig A" : f.key === "codes" || f.key === "rows" || f.key === "rts" || f.key === "times" || f.key === "cols" ? (f.key === "codes" ? "ABC0016-A" : "a, b") : String(f.value ?? "")]));
  };
  const setupWindow = async (_a: unknown, i: { values: unknown }) => ({ values: i.values, lines: { reagent: "Acetic acid", aqueous: "15.00 g", pH: "4.00", share: "60 %", use: "50 %", balance: "0.1 mg" } });
  const raftWindow = async (_a: unknown, i: { values: unknown }) => { const r = raftLines({ ...DEFAULT_RAFT, monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", mass: "2.5", dp: "105" }); return { values: i.values, lines: "lines" in r ? r.lines : null }; };
  const real = new SnippetTemplates(app as never, () => kit, async () => {}, form as never, setupWindow as never, undefined, raftWindow as never);
  const snippets = {
    meta: (f: TFile) => real.meta(f), run: (tp: never, f: TFile) => real.run(tp, f),
    menu: async (items: { name: string; value: unknown }[]) => items.find(i => i.name === pick)?.value ?? null,
  };
  const deps: InsertDeps = { app: app as never, snippets: snippets as never, scripts: { labSnippets, labMethods }, snippetFolder: FOLDER, form: form as never, templaterInsert: null };
  return { deps, editor: { replaceSelection: (t: string) => { inserted.push(t); } } as never, typed, inserted };
}

beforeEach(() => { Notice.messages.length = 0; });

describe("Form audit: every Alt+S snippet asks through the plugin form, Templater absent", () => {
  for (const [name, titles] of EXPECTED) {
    it(`${name}: opens the plugin form (${titles.join(", ")}) and inserts text`, async () => {
      const r = setup(name);
      await insertSnippet(r.deps, r.editor);
      if (name === "Solution prep") expect(r.inserted.join("")).toContain("```solution\nformat: 1\n");
      else if (name === "RAFT recipe generator") expect(r.inserted.join("")).toContain("```raft\nformat: 1\n");
      else expect(r.typed.length).toBeGreaterThan(0);
      expect(r.typed).toEqual(titles);
      expect(Notice.messages.filter(m => /Templater|labForm|User script/i.test(m))).toEqual([]);
      // Solution prep, Recipe and RAFT need chemicals to give text (their byte-for-byte output is tested in snippet-run-kit.test.ts and snippets*.test.ts); here only the form matters
      if (!["Solution prep", "Recipe by equivalents", "RAFT recipe generator"].includes(name)) expect(r.inserted.join("")).not.toBe("");
    });
  }

  it("the table above lists every file in the kit's Snippets folder and every built-in method", () => {
    const titles = kitFiles.map(f => /^title: (.+)$/m.exec(readFileSync(`${DIR}/${f.name}.md`, "utf8"))![1].trim());
    for (const t of titles) expect(EXPECTED.map(e => e[0]), t).toContain(t);
    expect(kitFiles.length).toBe(11);
  });

  it("the code that runs a snippet never reaches Templater's form: labForm.js is not required, the form is the one handed in", () => {
    const run = readFileSync("src/kit/snippet-insert.ts", "utf8");
    expect(run).toContain("labForm: (_tp: unknown, title: string, fields: FormField[], opts?: FormOpts) => form(title, fields, opts)");
    expect(run).not.toMatch(/templater-obsidian|user_scripts|labForm\.js/);
  });
});
