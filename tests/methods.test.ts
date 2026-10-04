// Analysis methods as vault notes: the descriptor module (labMethods.js) and the snippets that use it.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { extractBlocks, parseBlock, Workbook } from "../src/calc/engine";

const require = createRequire(import.meta.url);
const labSnippets = require("../kit/Extras/scripts/templater/labSnippets.js");
const labMethods = require("../kit/Extras/scripts/templater/labMethods.js");
const { parseMethod, loadMethods, planColumns, buildRows } = labMethods;

type Fm = Record<string, unknown>;
const file = (path: string, fm: Fm) => ({ extension: "md", basename: path.split("/").pop()!.replace(/\.md$/, ""), path, fm });

const MASS_SPEC: Fm = {
  Columns: ["Sample", "Ionisation: ESI", "Calibrant", "m/z", 'Mass error (ppm): =IFERROR(({m/z}-100)/100*1000000, "")', "Notes"],
  Machines: ["[[Machine A]]", "[[Machine B]]"], "Default machine": "[[Machine A]]",
  Results: ["m/z", "Mass error (ppm)"],
};
const MACHINE_A = file("Machines/Machine A.md", { Ionisation: "ESI", Calibrant: "NaI" });
const MACHINE_B = file("Machines/Machine B.md", { Ionisation: "APCI", Calibrant: "Ref B" });

/** A vault with a Methods folder: notes by path, folder at "Methods". */
function vault(methodFiles: ReturnType<typeof file>[]) {
  const all = [...methodFiles, MACHINE_A, MACHINE_B];
  const byName = new Map(all.map(f => [f.basename.toLowerCase(), f]));
  return {
    getFolderByPath: (p: string) => p === "Methods" ? { children: [{ children: methodFiles.slice(1) }, methodFiles[0]].filter(Boolean) } : null,
    getFileCache: (f: { fm: Fm }) => ({ frontmatter: f.fm }),
    getFirstLinkpathDest: (n: string) => byName.get(n.toLowerCase()) ?? null,
  };
}
const appFor = (v: ReturnType<typeof vault>, note: () => string, data: Record<string, unknown>) => ({
  vault: { adapter: { read: async () => JSON.stringify({ kit: { initials: "ABC", ...data } }) }, getFolderByPath: v.getFolderByPath },
  workspace: { activeEditor: { editor: { getValue: note } } },
  metadataCache: { getFileCache: v.getFileCache, getFirstLinkpathDest: v.getFirstLinkpathDest },
  fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
});

describe("parseMethod", () => {
  it("reads Name, Name: default, Name: =formula, {n} and the YAML objects an unquoted default becomes", () => {
    const m = parseMethod("XRD", { Columns: ["Run #: {n}", "Sample", { Source: "Cu" }, { Step: 0.02 }, "Ratio: =A2/B2", { "Run2 #": { n: null } }], "Sample column": "sample" });
    assert.deepStrictEqual(m.columns.map((c: any) => [c.name, c.def, c.formula, c.auto]), [
      ["Run #", null, null, true], ["Sample", null, null, false], ["Source", "Cu", null, false], ["Step", "0.02", null, false],
      ["Ratio", null, "=A2/B2", false], ["Run2 #", null, null, true]]);
    assert.strictEqual(m.sampleIdx, 1);
    assert.strictEqual(m.key, "xrd");
    assert.strictEqual(m.title, "XRD samples");
    assert.deepStrictEqual(m.checklist, ["Submitted", "Results processed", "Results saved"]);
  });

  it("ignores property case and spacing, keeps only Results that are columns, skips duplicates and blanks", () => {
    const m = parseMethod("Mass spec", { " columns ": "Sample\nmz\nMZ\n\n:x", " RESULTS": ["MZ", "nope"], tag: "", Checklist: [], "dataset folder": "yes" });
    assert.deepStrictEqual(m.columns.map((c: any) => c.name), ["Sample", "mz"]);
    assert.deepStrictEqual(m.results, ["mz"]);
    assert.strictEqual(m.tag, "Mass-spec");
    assert.deepStrictEqual(m.checklist, []);
    assert.strictEqual(m.dataset, true);
  });

  it("is null without usable Columns, and avoids keys the forms already use", () => {
    assert.strictEqual(parseMethod("README", { tags: ["x"] }), null);
    assert.strictEqual(parseMethod("README", { Columns: [] }), null);
    assert.strictEqual(parseMethod("Results", { Columns: ["Codes", "Sample"] }).key, "results_");
    assert.strictEqual(parseMethod("X", { Columns: ["Codes", "Sample"] }).columns[0].key, "codes_");
  });
});

describe("loadMethods", () => {
  const msFile = file("Methods/Mass spec.md", MASS_SPEC);
  const app = (files: ReturnType<typeof file>[]) => appFor(vault(files), () => "", {});

  it("is the built-in NMR, GPC and DLS without a folder (or with a missing one)", () => {
    for (const folder of [undefined, "", "  ", "Nope"]) {
      assert.deepStrictEqual(loadMethods(app([msFile]), folder).map((m: any) => m.key), ["nmr", "gpc", "dls"]);
    }
  });

  it("adds the notes of the folder after the built-in ones, with their machines", () => {
    const readme = file("Methods/Sub/README.md", { tags: ["x"] });
    const list = loadMethods(app([msFile, readme]), "/Methods/");
    assert.deepStrictEqual(list.map((m: any) => m.key), ["nmr", "gpc", "dls", "mass_spec"]);
    const ms = list[3];
    assert.deepStrictEqual(ms.machines.map((x: any) => x.name), ["Machine A", "Machine B"]);
    assert.strictEqual(ms.defaultMachine, "Machine A");
    assert.strictEqual(ms.resultsLabel, "Mass spec m/z, Mass error (ppm)");
  });

  it("a note with the name of a built-in replaces it; unresolved machine links stay selectable by name", () => {
    const gpc = file("Methods/gpc.md", { Columns: ["Sample", "Mn"], Machines: ["[[Ghost]]"] });
    const list = loadMethods(app([gpc]), "Methods");
    assert.deepStrictEqual(list.map((m: any) => m.key), ["nmr", "gpc", "dls"]);
    assert.deepStrictEqual(list[1].columns.map((c: any) => c.name), ["Sample", "Mn"]);
    assert.deepStrictEqual(list[1].machines.map((x: any) => x.name), ["Ghost"]);
  });

  it("default machine falls back to the first", () => {
    const f = file("Methods/M.md", { Columns: ["Sample"], Machines: ["[[Machine B]]", "[[Machine A]]"], "Default machine": "[[Missing]]" });
    assert.strictEqual(loadMethods(app([f]), "Methods")[3].defaultMachine, "Machine B");
  });
});

describe("planColumns / buildRows", () => {
  it("built-in GPC gives the same table as before: Đ formula on D / C", () => {
    const gpc = loadMethods(appFor(vault([]), () => "", {}), "")[1];
    const plan = planColumns(gpc);
    assert.deepStrictEqual(plan.header, ["Sample", "Eluent", "Mn (g/mol)", "Mw (g/mol)", "Đ", "Notes"]);
    assert.deepStrictEqual(buildRows(plan, ["S1", "S2"])[1], ["S2", "THF", "", "", '=IFERROR(D3/C3, "")', ""]);
    assert.deepStrictEqual(buildRows(plan, []).length, 3);
  });

  it("a method with machines gets a Machine column after the sample column, and machine properties are defaults", () => {
    const ms = loadMethods(appFor(vault([file("Methods/Mass spec.md", MASS_SPEC)]), () => "", {}), "Methods")[3];
    const plan = planColumns(ms);
    assert.deepStrictEqual(plan.header, ["Sample", "Machine", "Ionisation", "Calibrant", "m/z", "Mass error (ppm)", "Notes"]);
    const b = ms.machines[1];
    assert.deepStrictEqual(buildRows(plan, ["S1"], { machineCell: "[[Machine B]]", machineFm: b.fm })[0].slice(0, 5), ["S1", "[[Machine B]]", "APCI", "Ref B", ""]);
    assert.strictEqual(buildRows(plan, ["S1"], { machineCell: "x", machineFm: b.fm, values: { calibrant: "mine" } })[0][3], "mine");
    assert.match(buildRows(plan, ["S1"])[0][5], /^=IFERROR\(\(E2-100\)/);   // {m/z} → E2 because of the Machine column
  });
});

describe("snippets with a Methods folder", () => {
  function harness(initial = "") {
    let note = initial;
    const g = globalThis as any;
    g.Notice = class { constructor(_m: string) { /* silent */ } };
    g.app = appFor(vault([file("Methods/Mass spec.md", MASS_SPEC)]), () => note, { methodsFolder: "Methods" });
    const forms: Record<string, any[]> = {};
    const run = async (key: string, overrides: Record<string, unknown> = {}): Promise<string> => {
      const tp = {
        config: { target_file: { basename: "0001 - Test", path: "0001 - Test.md" } },
        file: { title: "0001 - Test" }, date: { now: () => "2026_10_03" },
        user: {
          labMethods,
          labForm: async (_tp: unknown, title: string, fields: any[]) => {
            forms[title] = fields;
            const v: Record<string, unknown> = {};
            for (const f of fields) if (f.key) v[f.key] = f.key in overrides ? overrides[f.key] : (f.type === "toggle" ? !!f.value : String(f.value ?? f.options?.[0]?.value ?? ""));
            return v;
          },
        },
      };
      const md: string = await labSnippets(tp, key);
      note += "\n" + md;
      return md;
    };
    const evaluate = () => {
      const blocks = extractBlocks(note).map(b => parseBlock(b.source));
      const wb = new Workbook(blocks, {});
      return (name: string, addr: string): any => {
        const m = addr.match(/^([A-Z]+)(\d+)$/)!;
        return wb.cell(blocks.findIndex(b => b.name === name), +m[2] - 1, m[1].charCodeAt(0) - 65);
      };
    };
    return { run, evaluate, forms, get note() { return note; }, set note(v: string) { note = v; } };
  }

  it("Analysis table: Method select, then the method's form with Machine and the default machine's values", async () => {
    const h = harness();
    const md = await h.run("method", { method: "mass_spec", codes: "ABC0001-A, ABC0001-B" });
    assert.deepStrictEqual(h.forms["Analysis table"][0].options.map((o: any) => o.label), ["NMR", "GPC", "DLS", "Mass spec"]);
    const fields = h.forms["Mass spec samples"];
    assert.deepStrictEqual(fields.map((f: any) => f.key), ["codes", "machine", "ionisation", "calibrant"]);
    assert.strictEqual(fields[1].type, "select");
    assert.strictEqual(fields[1].value, "Machine A");
    assert.deepStrictEqual(fields.slice(2).map((f: any) => f.value), ["ESI", "NaI"]);
    assert.match(md, /^## Mass spec samples\n/);
    assert.ok(md.includes("name: mass_spec") && md.includes("icon: microscope") && md.includes("copy: column A"), md);
    assert.ok(md.includes("| ABC0001-A | [[Machine A]] | ESI | NaI |  |"), md);   // the machine note exists, so the cell links to it
    assert.ok(md.trimEnd().endsWith("- [ ] Submitted\n- [ ] Results processed\n- [ ] Results saved"));
  });

  it("picking another machine changes the fields left at the default machine's values, not the ones typed", async () => {
    const h = harness();
    const md = await h.run("method", { method: "mass_spec", codes: "ABC0001-A", machine: "Machine B", calibrant: "typed" });
    assert.ok(md.includes("| ABC0001-A | [[Machine B]] | APCI | typed |"), md);
  });

  it("the formula column follows the Machine column and evaluates", async () => {
    const h = harness();
    await h.run("method", { method: "mass_spec", codes: "ABC0001-A" });
    h.note = h.note.replace("| [[Machine A]] | ESI | NaI |  |", "| [[Machine A]] | ESI | NaI | 101 |");
    assert.strictEqual(h.evaluate()("mass_spec", "F2"), 10000);
  });

  it("sample list toggles include the folder's methods and tag them", async () => {
    const h = harness();
    await h.run("samples", { count: "2", mass_spec: true, nmr: true, results: true });
    assert.deepStrictEqual(h.forms["Sample list"].filter((f: any) => f.type === "toggle").map((f: any) => f.label),
      ["NMR sample list", "GPC sample list", "DLS sample list", "Mass spec sample list", "Combined results table"]);
    assert.ok(h.note.includes("name: mass_spec") && h.note.includes("name: nmr") && h.note.includes("name: results"));
    const header = h.note.match(/name: results[\s\S]*?\n\| (.*) \|/)![1];
    assert.strictEqual(header, "Sample | Conversion (%) | m/z | Mass error (ppm)");
  });

  it("Combined results mixes methods and falls through the tables of one method", async () => {
    const h = harness();
    await h.run("method", { method: "mass_spec", codes: "ABC0001-A" });          // mass_spec: A
    h.note = h.note.replace("| [[Machine A]] | ESI | NaI |  |", "| [[Machine A]] | ESI | NaI | 101 |");
    await h.run("method", { method: "mass_spec", codes: "ABC0001-C" });          // mass_spec2: C
    h.note = h.note.replace(/(\| ABC0001-C \| \[\[Machine A\]\] \| ESI \| NaI \|) {2}\|/, "$1 102 |");
    await h.run("nmr", { codes: "ABC0001-A" });
    h.note = h.note.replace("| 1 | ABC0001-A | CDCl3 | 1H |  |  |", "| 1 | ABC0001-A | CDCl3 | 1H | 42 |  |");
    const res = await h.run("results", { codes: "ABC0001-A, ABC0001-C", gpc: false, dls: false });
    assert.ok(res.includes("mass_spec!E$2:E$2") && res.includes("mass_spec2!E$2:E$2"), res);
    const cell = h.evaluate();
    assert.strictEqual(cell("results", "B2"), 42);      // NMR conversion of A
    assert.strictEqual(cell("results", "C2"), 101);     // m/z of A, from the first table
    assert.strictEqual(cell("results", "C3"), 102);     // m/z of C, from the second table
    assert.strictEqual(cell("results", "D3"), 20000);   // Mass error column, found by header, not by a fixed letter
  });

  it("method:<key> goes straight to that method's form, without the Method select", async () => {
    const h = harness();
    const md = await h.run("method:mass_spec", { codes: "ABC0001-A" });
    assert.ok(!("Analysis table" in h.forms) && "Mass spec samples" in h.forms);
    assert.ok(md.includes("name: mass_spec"), md);
    assert.strictEqual(await h.run("method:nope"), "");
  });

  it("the results form lists every method with results; typed-in columns when a method has no table yet", async () => {
    const h = harness();
    const md = await h.run("results", { codes: "ABC0001-A", nmr: false, gpc: false, mass_spec: true });
    const toggles = h.forms["Combined results table"].filter((f: any) => f.type === "toggle");
    assert.deepStrictEqual(toggles.map((f: any) => [f.key, f.label, f.hint, f.value]), [
      ["nmr", "NMR conversion", "typed in", true], ["gpc", "GPC Mn, Mw, Đ", "typed in", true], ["dls", "DLS Dh, PDI", "typed in", false],
      ["mass_spec", "Mass spec m/z, Mass error (ppm)", "typed in", false]]);
    assert.ok(md.includes("| Sample | m/z | Mass error (ppm) |") && !md.includes("XLOOKUP"), md);
  });
});

describe("Alt+S menu (Insert snippet.md)", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () { /* */ }).constructor;
  const code = readFileSync("kit/Templates/Insert snippet.md", "utf8").replace(/^<%\*/, "").replace(/%>\s*$/, "");
  const menu = new AsyncFunction("tp", "app", "Notice", `let tR = ""; ${code}\n return tR;`);
  const snippetFile = (n: string) => ({ basename: n, parent: { path: "Templates/Snippets" } });

  async function open(data: Record<string, unknown>, pickName: string) {
    const shown: any[] = [], calls: string[] = [];
    const base = appFor(vault([file("Methods/Mass spec.md", MASS_SPEC)]), () => "", data);
    const app = { ...base, vault: { ...base.vault,
      getMarkdownFiles: () => [snippetFile("02 Beta"), snippetFile("01 Alpha")],
      cachedRead: async (f: any) => `// icon: star\n// desc: about ${f.basename}` } };
    const tp = {
      config: { template_file: { parent: { path: "Templates" } } },
      user: {
        labMethods,
        labPick: async (_tp: unknown, items: any[]) => { shown.push(...items); return items.find(i => i.name === pickName)?.value ?? null; },
        labSnippets: async (_tp: unknown, key: string) => { calls.push(key); return "RAN " + key; },
      },
      file: { include: async (f: any) => "INCLUDED " + f.basename },
    };
    const out: string = await menu(tp, app, class { constructor(_m: string) { /* silent */ } });
    return { shown, out, calls };
  }

  it("lists the snippet files, then one entry per method of the Methods folder (not the built-in three)", async () => {
    const r = await open({ methodsFolder: "Methods" }, "Alpha");
    assert.deepStrictEqual(r.shown.map(i => i.name), ["Alpha", "Beta", "Mass spec samples"]);
    const m = r.shown[2];
    assert.strictEqual(m.icon, "microscope");
    assert.strictEqual(m.desc, "Sample table for Mass spec · Machine A, Machine B");
    assert.strictEqual(r.out, "INCLUDED 01 Alpha");
  });

  it("picking a method entry builds that method's table", async () => {
    const r = await open({ methodsFolder: "Methods" }, "Mass spec samples");
    assert.deepStrictEqual(r.calls, ["method:mass_spec"]);
    assert.strictEqual(r.out, "RAN method:mass_spec");
  });

  it("no Methods folder: the menu is only the snippet files", async () => {
    const r = await open({}, "Beta");
    assert.deepStrictEqual(r.shown.map(i => i.name), ["Alpha", "Beta"]);
  });
});
