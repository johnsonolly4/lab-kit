// v0.4: chemical fields and the NMR dataset start empty. (Initials and the experiment number are tested in snippet-run.test.ts.)
import { labSnippets, labMethods } from "./helpers/lab-scripts";
import { describe, it } from "vitest";
import assert from "node:assert";

import { runToken, shippedTemplate } from "./token-snippets";

const DATA = ".obsidian/plugins/lab-kit/data.json";

function harness(files: Record<string, string>, basename = "0014 - Test") {
  const notices: string[] = [];
  const fields: Record<string, any[]> = {};
  const g = globalThis as any;
  g.Notice = class { constructor(m: string) { notices.push(m); } };
  g.app = {
    vault: { configDir: ".obsidian", adapter: { read: async (p: string) => { if (p in files) return files[p]; throw new Error("ENOENT " + p); } } },
    workspace: { activeEditor: { editor: { getValue: () => "" } } },
    metadataCache: { getFileCache: () => ({ frontmatter: {} }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
  };
  const run = async (key: string, overrides: Record<string, unknown> = {}): Promise<string> => {
    const tp = {
      config: { target_file: { basename, path: `${basename}.md` } },
      file: { title: basename },
      date: { now: () => "2026_10_03" },
      user: {
        labMethods,
        labForm: async (_tp: unknown, _t: string, f: any[]) => {
          fields[key] = f;
          const v: Record<string, unknown> = {};
          for (const x of f) if (x.key) v[x.key] = x.key in overrides ? overrides[x.key] : (x.type === "toggle" ? !!x.value : String(x.value ?? ""));
          return v;
        }
      }
    };
    return labSnippets(tp, key);
  };
  return { run, notices, fields };
}

describe("empty defaults", () => {
  it("chemical fields start empty, so an untouched form inserts nothing", async () => {
    const h = harness({});
    for (const key of ["solution", "recipe", "raft"]) assert.strictEqual(await h.run(key), "", key);
    const empty = (key: string) => h.fields[key].filter(f => ["reagents", "solutes", "solvents", "monomers", "cta", "init", "solvent", "rows", "cols"].includes(f.key));
    for (const key of ["solution", "recipe", "raft"]) {
      for (const f of empty(key)) if (f.key !== "solvent" || key === "raft") assert.strictEqual(f.value, "", `${key}.${f.key}`);
    }
    // the variant matrix is a token template: untouched, its form inserts nothing
    assert.strictEqual(runToken("matrix", { note: "", prefix: "ABC0014-" }), "");
    for (const f of shippedTemplate("matrix").header.fields) assert.strictEqual(f.value, "", `matrix.${f.key}`);
  });

  it("sample list and timetable have no technique toggles: the methods are added afterwards", () => {
    for (const key of ["samples", "timetable"]) assert.ok(!shippedTemplate(key).header.fields.some(f => (f.type as string) === "toggle"), key);
  });

  it("the column's Solvent field suggests solvents, as the script did", () => {
    const f = shippedTemplate("column").header.fields.find(x => x.key === "solvent")!;
    assert.strictEqual(f.suggest, "chemicals");
    assert.deepStrictEqual(f.classes, ["solvent"]);
  });

  it("NMR dataset is empty by default", async () => {
    const h = harness({ [DATA]: JSON.stringify({ kit: { initials: "ABC" } }) });
    const md = await h.run("nmr", { codes: "ABC0014-A" });
    assert.ok(/^Dataset: *$/m.test(md), md);
    assert.ok(!md.includes("Monty"));
  });
});

describe("chemical folder suggestions", () => {
  const FOLDER = { children: [
    { path: "Chem/Toluene.md", basename: "Toluene", extension: "md" },
    { path: "Chem/Sub", children: [{ path: "Chem/Sub/DTT.md", basename: "DTT", extension: "md" }] },
    { path: "Chem/scan.pdf", basename: "scan", extension: "pdf" },
  ] };
  const withFolder = (h: ReturnType<typeof harness>) => {
    const app = (globalThis as any).app;
    app.vault.getFolderByPath = (p: string) => p === "Chem" ? FOLDER : null;
    app.metadataCache.getFileCache = (f: any) => ({ frontmatter: f.basename === "DTT" ? { Names: ["DTT", "Dithiothreitol"] } : {} });
    return h;
  };
  const suggestKeys = (h: ReturnType<typeof harness>, key: string) => h.fields[key].filter(f => f.suggest).map(f => f.key);

  it("reagent, solvent, monomer, CTA and initiator fields get the notes of the folder, with their aliases", async () => {
    const h = withFolder(harness({ [DATA]: JSON.stringify({ kit: { chemicalFolder: "/Chem/" } }) }));
    for (const key of ["solution", "recipe", "raft"]) await h.run(key);
    assert.deepStrictEqual(suggestKeys(h, "solution"), ["solutes", "solvents"]);
    assert.deepStrictEqual(suggestKeys(h, "recipe"), ["reagents", "solvent"]);
    assert.deepStrictEqual(suggestKeys(h, "raft"), ["monomers", "cta", "init", "solvent", "cosolvent"]);
    assert.deepStrictEqual(h.fields.solution.find(f => f.key === "solutes").suggest, [{ name: "DTT", aliases: ["Dithiothreitol"] }, { name: "Toluene", aliases: [] }]);
  });

  it("no folder set, or a folder that does not exist: no suggestions, forms as before", async () => {
    for (const data of [{}, { chemicalFolder: "Nope" }]) {
      const h = withFolder(harness({ [DATA]: JSON.stringify({ kit: data }) }));
      for (const key of ["solution", "recipe", "raft"]) await h.run(key);
      for (const key of ["solution", "recipe", "raft"]) assert.deepStrictEqual(suggestKeys(h, key), [], key);
    }
  });
});
