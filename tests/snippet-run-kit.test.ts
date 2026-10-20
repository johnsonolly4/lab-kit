// I23 Phase 3 guard: each kit calculator file (a `run:` header) inserts byte for byte what labSnippets.js gives for its key, on the same answers.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { TFile } from "obsidian";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import { miniYaml } from "./token-snippets";
import { solutionBlock } from "../src/solution/setup-text";

const require = createRequire(import.meta.url);
const labSnippets = require("../kits/lab/Extras/scripts/templater/labSnippets.js");
const labMethods = require("../kits/lab/Extras/scripts/templater/labMethods.js");
const DIR = "kits/lab/Templates/Snippets/";
const MW: Record<string, number> = { "lipoic acid": 206.32, "benzyl alcohol": 108.14, dcm: 84.93, pabtc: 238.39, dmam: 99.13, "va-044": 323.33 };

const ANSWERS: Record<string, Record<string, unknown>> = {
  solution: { solutes: "Lipoic Acid, Benzyl alcohol, DCM" },
  recipe: { reagents: "Lipoic Acid, Benzyl alcohol", solvent: "DCM", amount: "10", total: "60" },
  raft: { monomers: "DAAm", cta: "PABTC", init: "VA-044", solvent: "Water" },
  results: { codes: "ABC0016-A, ABC0016-B" },
};

describe("run: files give what labSnippets.js gives", () => {
  // 01 Solution prep is the live block now; its old volume form is the kept copy `run: solution-volume` (the same file with that key)
  it.each([["01 Solution prep", "solution"], ["02 Recipe by equivalents", "recipe"], ["03 RAFT recipe generator", "raft"], ["10 Combined results", "results"]])("%s", async (name, key) => {
    const kept = name === "01 Solution prep";
    const note = "---\nChemicals:\n  - \"[[Lipoic Acid]]\"\n  - \"[[Benzyl alcohol]]\"\n  - \"[[DCM]]\"\n---\n";
    const g = globalThis as Record<string, unknown>;
    g.Notice = class { constructor(_m: string) { /* silent */ } };
    g.app = {
      vault: { adapter: { read: async () => JSON.stringify({ kit: { initials: "ABC" } }) } },
      workspace: { activeEditor: { editor: { getValue: () => note } } },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { Chemicals: ["[[Lipoic Acid]]", "[[Benzyl alcohol]]", "[[DCM]]"] } }),
        getFirstLinkpathDest: (n: string) => MW[n.toLowerCase()] ? { path: n + ".md" } : null,
      },
      fileManager: { processFrontMatter: async () => {} },
    };
    const tp = {
      config: { target_file: { basename: "0016 - Test", path: "0016 - Test.md" } }, file: { title: "0016 - Test" }, date: { now: () => "2026_10_02" },
      user: { labMethods, labSnippets, labForm: async (_t: unknown, _title: string, fields: { key?: string; type?: string; value?: unknown }[]) => Object.fromEntries(fields.filter(f => f.key).map(f => [f.key, f.key! in ANSWERS[key] ? ANSWERS[key][f.key!] : f.type === "toggle" ? !!f.value : String(f.value ?? "")])) },
    };
    const real = readFileSync(`${DIR}${name}.md`, "utf8").replace(kept ? "run: solution\n" : "\0", "run: solution-volume\n");
    if (kept) expect(real).toContain("run: solution-volume");
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(real)!;
    const text = `---\n${JSON.stringify(miniYaml(m[1]))}\n---\n`;
    const app = { vault: { cachedRead: async () => text }, workspace: { activeEditor: { editor: { getValue: () => note } }, getActiveFile: () => null }, metadataCache: {} };
    const st = new SnippetTemplates(app as never, () => ({ ...KIT_DEFAULTS, initials: "ABC" }) as KitData);
    const direct: string = await labSnippets(tp, key);
    const via = await st.run(tp as unknown as SnippetTp, new TFile({ path: `S/${name}.md`, basename: name }));
    expect(direct.length).toBeGreaterThan(0);
    expect(via).toBe(direct);
  });
});

describe("01 Solution prep is the live block", () => {
  it("its header is run: solution and it inserts the block with the window's answers, not the volume tables", async () => {
    const real = readFileSync(`${DIR}01 Solution prep.md`, "utf8");
    expect(real).toMatch(/^run: solution$/m);
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(real)!;
    const text = `---\n${JSON.stringify(miniYaml(m[1]))}\n---\n`;
    const lines = { reagent: "Acetic acid", aqueous: "15.00 g", pH: "4.00", share: "60 %", use: "50 %", balance: "0.1 mg" };
    const app = { vault: { cachedRead: async () => text, getFolderByPath: () => null }, workspace: { activeEditor: { editor: { getValue: () => "", getCursor: () => ({ line: 0, ch: 0 }) } }, getActiveFile: () => null }, metadataCache: {} };
    const st = new SnippetTemplates(app as never, () => ({ ...KIT_DEFAULTS }) as KitData, undefined, undefined, async (_a, i) => ({ values: i.values, lines }));
    const via = await st.run({ user: {} } as unknown as SnippetTp, new TFile({ path: "S/01 Solution prep.md", basename: "01 Solution prep" }));
    expect(via).toBe(solutionBlock(lines));
  });
});
