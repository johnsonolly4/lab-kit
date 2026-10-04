// v0.4: initials come from the plugin settings, chemical fields and the NMR dataset start empty.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const labSnippets = require("../kit/Extras/scripts/templater/labSnippets.js");

const DATA = ".obsidian/plugins/lab-kit/data.json";
const CONFIG = "Extras/scripts/lab-config.json";

function harness(files: Record<string, string>) {
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
      config: { target_file: { basename: "0014 - Test", path: "0014 - Test.md" } },
      file: { title: "0014 - Test" },
      date: { now: () => "2026_10_03" },
      user: {
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

describe("initials", () => {
  it("come from the plugin settings, which win over lab-config.json", async () => {
    const h = harness({ [DATA]: JSON.stringify({ kit: { initials: "QRS" } }), [CONFIG]: JSON.stringify({ initials: "OLD" }) });
    const md = await h.run("samples", { codes: "", count: "2" });
    assert.ok(md.includes("QRS0014-A") && !md.includes("OLD"), md);
    assert.deepStrictEqual(h.notices, []);
  });

  it("fall back to lab-config.json for older installs", async () => {
    const h = harness({ [DATA]: JSON.stringify({ kit: { initials: "" } }), [CONFIG]: JSON.stringify({ initials: "OLD" }) });
    assert.ok((await h.run("samples", { codes: "", count: "1" })).includes("OLD0014-A"));
    assert.deepStrictEqual(h.notices, []);
  });

  it("are XX with a notice when set nowhere", async () => {
    const h = harness({});
    assert.ok((await h.run("samples", { codes: "", count: "1" })).includes("XX0014-A"));
    assert.strictEqual(h.notices.length, 1);
    assert.ok(/Settings/.test(h.notices[0]));
    // snippets that make no sample codes stay quiet
    const h2 = harness({});
    await h2.run("blank");
    assert.deepStrictEqual(h2.notices, []);
  });
});

describe("empty defaults", () => {
  it("chemical fields start empty, so an untouched form inserts nothing", async () => {
    const h = harness({});
    for (const key of ["solution", "recipe", "raft", "matrix"]) assert.strictEqual(await h.run(key), "", key);
    const empty = (key: string) => h.fields[key].filter(f => ["reagents", "monomers", "cta", "init", "solvent", "rows", "cols"].includes(f.key));
    for (const key of ["solution", "recipe", "raft", "matrix"]) {
      for (const f of empty(key)) if (f.key !== "solvent" || key === "raft") assert.strictEqual(f.value, "", `${key}.${f.key}`);
    }
  });

  it("sample list and timetable label the technique toggles as appended below", async () => {
    const h = harness({ [DATA]: JSON.stringify({ kit: { initials: "ABC" } }) });
    for (const key of ["samples", "timetable"]) {
      await h.run(key, { codes: "ABC0014-A", times: "0" });
      const heading = h.fields[key].find(f => f.type === "heading" && /Also add/.test(f.label));
      assert.strictEqual(heading?.label, "Also add (appended below)", key);
    }
  });

  it("NMR dataset is empty by default, in the snippet and in the sample list", async () => {
    const h = harness({ [DATA]: JSON.stringify({ kit: { initials: "ABC" } }) });
    const md = await h.run("nmr", { codes: "ABC0014-A" });
    assert.ok(/^Dataset: *$/m.test(md), md);
    assert.ok(!md.includes("Monty"));
    const md2 = await h.run("samples", { codes: "ABC0014-A", nmr: true });
    assert.ok(/^Dataset: *$/m.test(md2) && !md2.includes("Monty"), md2);
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
    assert.deepStrictEqual(suggestKeys(h, "solution"), ["reagents"]);
    assert.deepStrictEqual(suggestKeys(h, "recipe"), ["reagents", "solvent"]);
    assert.deepStrictEqual(suggestKeys(h, "raft"), ["monomers", "cta", "init", "solvent"]);
    assert.deepStrictEqual(h.fields.solution.find(f => f.key === "reagents").suggest, [{ name: "DTT", aliases: ["Dithiothreitol"] }, { name: "Toluene", aliases: [] }]);
  });

  it("no folder set, or a folder that does not exist: no suggestions, forms as before", async () => {
    for (const data of [{}, { chemicalFolder: "Nope" }]) {
      const h = withFolder(harness({ [DATA]: JSON.stringify({ kit: data }) }));
      for (const key of ["solution", "recipe", "raft"]) await h.run(key);
      for (const key of ["solution", "recipe", "raft"]) assert.deepStrictEqual(suggestKeys(h, key), [], key);
    }
  });
});

describe("column density from the solvent's note", () => {
  const setup = (fm: Record<string, unknown>) => {
    const h = harness({});
    const app = (globalThis as any).app;
    app.metadataCache.getFirstLinkpathDest = (n: string) => n === "DCM" ? { path: "Chem/DCM.md" } : null;
    app.metadataCache.getFileCache = (f: any) => ({ frontmatter: f.path === "Chem/DCM.md" ? fm : {} });
    return h;
  };
  const density = (md: string) => md.match(/\| Solvent density \(g\/mL\) \| (.*?) \|/)![1];

  it("fills the density row from the note's Density (a link or a comma decimal works)", async () => {
    assert.strictEqual(density(await setup({ Density: 1.325 }).run("column", { solvent: "DCM" })), "1.325");
    assert.strictEqual(density(await setup({ density: "1,325" }).run("column", { solvent: "[[DCM]]" })), "1.325");
  });
  it("a density typed in the form wins; no solvent, an unknown solvent or an empty Density leave it blank", async () => {
    assert.strictEqual(density(await setup({ Density: 1.325 }).run("column", { solvent: "DCM", density: "0.9" })), "0.9");
    assert.strictEqual(density(await setup({ Density: 1.325 }).run("column", { solvent: "" })), "");
    assert.strictEqual(density(await setup({ Density: 1.325 }).run("column", { solvent: "Nope" })), "");
    assert.strictEqual(density(await setup({ Density: null }).run("column", { solvent: "DCM" })), "");
  });
});
