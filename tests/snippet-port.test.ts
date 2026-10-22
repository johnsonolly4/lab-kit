// Phase 12 guard: every Alt+S calculator key (solution-volume, recipe, raft-table, results, nmr / gpc / dls / Methods-folder)
// gives byte for byte the text and asks the questions recorded from the Templater scripts (tests/fixtures/snippets/expected.json).
// Re-record (only from the old scripts): RECORD=1 npx vitest run tests/snippet-port.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { Notice as StubNotice } from "obsidian";
import { labSnippets, labMethods } from "./helpers/lab-scripts";

const EXPECTED = "tests/fixtures/snippets/expected.json";

interface FileMock { path: string; basename: string; extension: string; fm: Record<string, unknown> }
const file = (path: string, fm: Record<string, unknown>): FileMock => ({ path, basename: path.replace(/^.*\//, "").replace(/\.md$/, ""), extension: "md", fm });

const CHEMS = [
  file("Chem/Lipoic Acid.md", { names: ["LA"], "Chemical class": "monomer" }),
  file("Chem/Benzyl alcohol.md", { "Chemical class": ["solvent"], Density: "1.044" }),
  file("Chem/DCM.md", { "Chemical class": "solvent", Density: "1,33" }),
  file("Chem/DAAm.md", { "Chemical class": "monomer" }),
  file("Chem/DMAm.md", { "Chemical class": "monomer" }),
  file("Chem/PDMA 76.md", { "Chemical class": "CTA" }),
  file("Chem/PABTC.md", { "Chemical class": "CTA" }),
  file("Chem/VA-044.md", { "Chemical class": "initiator" }),
  file("Chem/Water.md", { "Chemical class": "solvent" }),
  file("Chem/Ethanol.md", { "Chemical class": "solvent" }),
];
const METHODS = [
  file("Methods/Mass spec.md", { Columns: ["Sample", "Mode: positive", "m/z", "Notes"], "Sample column": "Sample", Results: ["m/z"], Machines: ["[[Orbitrap]]", "[[Q-TOF]]"], "Default machine": "[[Orbitrap]]", Icon: "atom", Tag: "MS", Dataset: "x", "Dataset folder": true, Checklist: ["Run", "Saved"] }),
  file("Methods/Readme.md", { aliases: "no columns" }),
];
const MACHINES = [file("Machines/Orbitrap.md", { Mode: "negative" }), file("Machines/Q-TOF.md", { Mode: "positive", Notes: "fast" })];
const ALL = [...CHEMS, ...METHODS, ...MACHINES];

const NOTE0 = "---\ntags: [x]\n---\n```calc\nname: samples\ntitle: Samples\ncodes: column A\n| Sample | x |\n|---|---|\n| ABC0016-A | |\n| ABC0016-B | |\n```\n```calc\nname: sampling\ntitle: Timetable\ncodes: cells\n| Time | A | B |\n|---|---|---|\n| 0 | ABC0016-A0 | ABC0016-B0 |\n```\n";

interface Case { key: string; answers?: Record<string, unknown>; cancel?: boolean }
const CASES: Case[] = [
  { key: "solution", answers: { solutes: "Lipoic Acid, Benzyl alcohol, DCM" } },
  { key: "solution", answers: { label: "Solution 2", solutes: "A, B, C", volume: "10", solvents: "S1" } },
  { key: "solution", answers: { label: "Solution 3", solutes: "A, B, C", volume: "10", solvents: "S1, S2", amount: "mol" } },
  { key: "solution", answers: { label: "Solution 4", solutes: "A, B", volume: "10", mode: "total", ratios: "1, 2", basis: "molar", totalUnit: "M", total: "0.3" } },
  { key: "solution", answers: { label: "Solution 5", solutes: "A, B", mode: "total", basis: "mass", totalUnit: "mg/mL", total: "30", ratios: "1, 2" } },
  { key: "solution", answers: { solutes: "" } },
  { key: "solution", answers: { label: "My solution", solutes: "Benzyl alcohol, DCM", solvents: "Water", volume: "5", unit: "mg/mL" } },
  { key: "recipe", answers: { reagents: "Lipoic Acid, Benzyl alcohol", solvent: "DCM", amount: "10", total: "60" } },
  { key: "recipe", answers: { reagents: "A, B", amount: "0.5", amountUnit: "g" } },
  { key: "recipe", answers: { reagents: "A, B", amount: "0.1", amountUnit: "M", volume: "10" } },
  { key: "recipe", answers: { reagents: "A, B", amount: "0.1", amountUnit: "M", volume: "" } },
  { key: "recipe", answers: { reagents: "" } },
  { key: "raft", answers: { monomers: "DAAm", cta: "PDMA 76", init: "VA-044", solvent: "Water" } },
  { key: "raft", answers: { monomers: "DMAm, DAAm, Lipoic Acid", cta: "PABTC", init: "VA-044", solvent: "Water", mass: "2.5", dp: "105" } },
  { key: "raft", answers: { monomers: "DAAm", cta: "PDMA 76", init: "VA-044", solvent: "Water", cosolvent: "Ethanol", cosolventPct: "30" } },
  { key: "raft", answers: { monomers: "" } },
  { key: "nmr" }, { key: "gpc" }, { key: "dls" }, { key: "nmr" },
  { key: "nmr", cancel: true },
  { key: "nmr", answers: { codes: "ZZ-1, ZZ-2", solvent: "D2O", dataset: "folder 1" } },
  { key: "results" },
  { key: "results", answers: { codes: "", nmr: false } },
  { key: "method:mass_spec" },
  { key: "method:mass_spec", answers: { machine: "Q-TOF", codes: "M-1, M-2", dataset: "ms1" } },
  { key: "results" },
  { key: "method:nope" },
  { key: "bogus" },
];

/** One whole run of CASES with the given Lab Kit settings. */
async function runAll(kit: Record<string, unknown>): Promise<unknown[]> {
  let note = NOTE0;
  const tags: string[] = [];
  const notices: string[] = [];
  const g = globalThis as Record<string, unknown>;
  g.Notice = class { constructor(m: string) { notices.push(m); } };
  const folder = (path: string, files: FileMock[]) => ({ path, children: files });
  const folders: Record<string, unknown> = { Chem: folder("Chem", CHEMS), Methods: folder("Methods", METHODS) };
  const find = (n: string) => ALL.find(f => f.basename.toLowerCase() === n.toLowerCase());
  const app = {
    vault: { configDir: ".obsidian", adapter: { read: async () => JSON.stringify({ kit }) }, getFolderByPath: (p: string) => folders[p] ?? null },
    workspace: { activeEditor: { editor: { getValue: () => note } } },
    metadataCache: { getFileCache: (f: FileMock) => ({ frontmatter: f.fm }), getFirstLinkpathDest: (n: string) => find(n) ?? null },
    fileManager: { processFrontMatter: async (_f: unknown, fn: (fm: Record<string, unknown>) => void) => { const fm = { tags: tags.slice() }; fn(fm); tags.splice(0, tags.length, ...(fm.tags as string[])); } },
  };
  g.app = app;
  const out: unknown[] = [];
  for (const c of CASES) {
    const asked: unknown[] = [];
    notices.length = 0;
    const stubFrom = StubNotice.messages.length;
    const tp = {
      config: { target_file: { basename: "0016 - Test", path: "0016 - Test.md" } },
      file: { title: "0016 - Test" },
      date: { now: () => "2026-10-02" },
      user: {
        labMethods,
        labForm: async (_tp: unknown, title: string, fields: Record<string, unknown>[], opts?: unknown) => {
          asked.push({ title, fields, opts });
          if (c.cancel) return null;
          const v: Record<string, unknown> = {};
          for (const f of fields) if (typeof f.key === "string") v[f.key] = f.key in (c.answers ?? {}) ? c.answers![f.key] : f.type === "toggle" ? !!f.value : String(f.value ?? "");
          return v;
        },
      },
    };
    const md: string = await labSnippets(tp, c.key);
    note += "\n" + md;
    out.push({ key: c.key, asked, notices: [...notices, ...StubNotice.messages.slice(stubFrom)], md });
  }
  await new Promise(r => setTimeout(r, 1000));
  out.push({ tags: tags.slice() });
  return out;
}

const KITS = { plain: { methodsFolder: "Methods", chemicalFolder: "Chem" }, classOnly: { methodsFolder: "Methods", chemicalFolder: "Chem", chemClassOnly: true }, noFolders: {} };

describe("calculator snippets give the recorded text and questions", () => {
  it("matches expected.json", async () => {
    const got: Record<string, unknown> = {};
    for (const [name, kit] of Object.entries(KITS)) got[name] = JSON.parse(JSON.stringify(await runAll(kit)));
    if (process.env.RECORD === "1") { writeFileSync(EXPECTED, JSON.stringify(got, null, 1) + "\n"); return; }
    const want = JSON.parse(readFileSync(EXPECTED, "utf8"));
    expect(got).toEqual(want);
  }, 30000);
});
