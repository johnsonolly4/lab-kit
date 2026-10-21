// Chemical class on the form fields of the code snippets: a field that asks for a class suggests those chemicals (first, or only).
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const labSnippets = require("../src/kit/bundled/labSnippets.js");
const labMethods = require("../src/kit/bundled/labMethods.js");

const DATA = ".obsidian/plugins/lab-kit/data.json";
const CHEMS: Record<string, Record<string, unknown>> = {
  Acetone: { "Chemical class": "Solvent" },
  AIBN: { "chemical  class": ["initiator"] },
  "Methyl acrylate": { "Chemical class": ["monomer", "reagent"] },
  Mystery: {},
};

/** Runs a snippet's form and returns the suggestion names of each field. */
async function suggestions(key: string, kit: Record<string, unknown>): Promise<Record<string, string[] | undefined>> {
  const g = globalThis as any;
  g.Notice = class { constructor(_m: string) { /* not under test */ } };
  const files = Object.entries(CHEMS).map(([name, fm]) => ({ extension: "md", basename: name, fm }));
  g.app = {
    vault: {
      configDir: ".obsidian",
      adapter: { read: async (p: string) => { if (p === DATA) return JSON.stringify({ kit: { initials: "ABC", chemicalFolder: "Chem", ...kit } }); throw new Error("ENOENT " + p); } },
      getFolderByPath: (p: string) => (p === "Chem" ? { children: files } : null),
    },
    workspace: { activeEditor: { editor: { getValue: () => "" } } },
    metadataCache: { getFileCache: (f: { fm: object }) => ({ frontmatter: f.fm }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* not under test */ } },
  };
  let fields: any[] = [];
  const tp = {
    config: { target_file: { basename: "ABC0016 - test", path: "ABC0016 - test.md" } },
    file: { title: "ABC0016 - test" },
    date: { now: () => "2026-10-09" },
    user: { labMethods, labForm: async (_tp: unknown, _t: string, f: any[]) => { fields = f; return null; } },
  };
  await labSnippets(tp, key);
  return Object.fromEntries(fields.filter(f => f.key).map(f => [f.key, f.suggest?.map((c: { name: string }) => c.name)]));
}

describe("Chemical class on the snippet forms", () => {
  it("class first, then the others (the default setting)", async () => {
    const s = await suggestions("raft", {});
    assert.deepStrictEqual(s.monomers, ["Methyl acrylate", "Acetone", "AIBN", "Mystery"]);
    assert.deepStrictEqual(s.init, ["AIBN", "Acetone", "Methyl acrylate", "Mystery"]);
    assert.deepStrictEqual(s.solvent, ["Acetone", "AIBN", "Methyl acrylate", "Mystery"]);
    assert.deepStrictEqual(s.cosolvent, ["Acetone", "AIBN", "Methyl acrylate", "Mystery"]);
    assert.deepStrictEqual(s.cta, ["Acetone", "AIBN", "Methyl acrylate", "Mystery"], "a class nobody has gives the plain order");
  });

  it("only the asked class when the setting is on; a class nobody has yet gives an empty list", async () => {
    const s = await suggestions("raft", { chemClassOnly: true });
    assert.deepStrictEqual(s.monomers, ["Methyl acrylate"]);
    assert.deepStrictEqual(s.init, ["AIBN"]);
    assert.deepStrictEqual(s.solvent, ["Acetone"]);
    assert.deepStrictEqual(s.cta, [], "no chemical has the class CTA yet");
  });

  it("fields that ask for no class still list every chemical", async () => {
    const s = await suggestions("recipe", { chemClassOnly: true });
    assert.deepStrictEqual(s.reagents, ["Acetone", "AIBN", "Methyl acrylate", "Mystery"]);
    assert.deepStrictEqual(s.solvent, ["Acetone"]);
    const sol = await suggestions("solution", { chemClassOnly: true });
    assert.deepStrictEqual(sol.solutes, ["Acetone", "AIBN", "Methyl acrylate", "Mystery"]);
    assert.deepStrictEqual(sol.solvents, ["Acetone"]);
  });

  it("no Chemical folder: no suggestions, as before", async () => {
    const s = await suggestions("raft", { chemicalFolder: "" });
    assert.strictEqual(s.monomers, undefined);
  });
});
