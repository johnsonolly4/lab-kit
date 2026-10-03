// Ported from the v0.3 plain-Node test of the same name.
// Drives the real Templater snippets in kit/ and evaluates the generated calc tables with the src/ engine.
// Known answers: 0005 RAFT Mn = 19990.14, 0011 reactor volume = 1.7591 mL.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { extractBlocks, parseBlock, Workbook, type Env } from "../src/calc/engine";
import { editRows } from "../src/calc/rewrite";

const require = createRequire(import.meta.url);
const labSnippets = require("../kit/Extras/scripts/templater/labSnippets.js");

const MW: Record<string, number> = { "lipoic acid": 206.32, "benzyl alcohol": 108.14, "dcm": 84.93, "pabtc": 238.39, "dmam": 99.13, "daam": 169.23, "va-044": 323.33 };
const close = (a: unknown, b: number, tol = 1e-4) => assert.ok(typeof a === "number" && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${JSON.stringify(a)} != ${b}`);

describe("snippets", () => {
  it("generate valid tables whose numbers match the known answers", async () => {
    let note = "---\nChemicals:\n  - \"[[Lipoic Acid]]\"\n  - \"[[Benzyl alcohol]]\"\n  - \"[[DCM]]\"\n---\n";
    const tags: string[] = [];
    const g = globalThis as any;
    g.Notice = class { constructor(_m: string) { /* silent */ } };
    g.app = {
      vault: { adapter: { read: async () => JSON.stringify({ initials: "ABC" }) } },
      workspace: { activeEditor: { editor: { getValue: () => note } } },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { Chemicals: ["[[Lipoic Acid]]", "[[Benzyl alcohol]]", "[[DCM]]"] } }),
        getFirstLinkpathDest: (n: string) => MW[n.toLowerCase()] ? { path: n + ".md" } : null,
      },
      fileManager: { processFrontMatter: async (_f: unknown, fn: (fm: any) => void) => { const fm = { tags: tags.slice() }; fn(fm); tags.splice(0, tags.length, ...fm.tags); } },
    };
    const env: Env = { prop: (n) => MW[n.toLowerCase()] ?? { err: "#NOTE?" } };

    async function run(key: string, overrides: Record<string, unknown> = {}) {
      const tp = {
        config: { target_file: { basename: "0016 - Test", path: "0016 - Test.md" } },
        file: { title: "0016 - Test" },
        date: { now: () => "2026_10_02" },
        user: {
          labForm: async (_tp: unknown, _title: string, fields: any[]) => {
            const v: Record<string, unknown> = {};
            for (const f of fields) if (f.key) v[f.key] = f.key in overrides ? overrides[f.key] : (f.type === "toggle" ? !!f.value : String(f.value ?? ""));
            return v;
          }
        }
      };
      const md: string = await labSnippets(tp, key);
      note += "\n" + md;
      return { md };
    }
    const evalNote = () => {
      const blocks = extractBlocks(note).map(b => parseBlock(b.source));
      const wb = new Workbook(blocks, env);
      const byName = (n: string) => blocks.findIndex(b => b.name === n);
      const gc = (name: string, addr: string): any => { const m = addr.match(/^([A-Z]+)(\d+)$/)!; return wb.cell(byName(name), +m[2] - 1, m[1].charCodeAt(0) - 65); };
      const errs: string[] = [];
      blocks.forEach((b) => b.cells.forEach(row => row.forEach(c => { if (c.kind === "formula" && c.parseError) errs.push(b.name + ": " + c.raw + " → " + c.parseError); })));
      return { g: gc, wb, errs, blocks, byName };
    };

    // Solution prep: defaults to Chemicals, MW pulled, mmol
    let r = await run("solution");
    assert.ok(r.md.includes("[[Lipoic Acid]]") && !r.md.includes("Appearance"));
    note = note.replace("| [[Lipoic Acid]] | =MW(A2) |  |  |", "| [[Lipoic Acid]] | =MW(A2) | 1 | 1.0316 |");
    let { g: gg } = evalNote();
    close(gg("sol1", "B2"), 206.32); close(gg("sol1", "E2"), 5);

    // Recipe by equivalents with solvent rest + total
    r = await run("recipe", { mmol: "10", total: "60" });
    ({ g: gg } = evalNote());
    close(gg("recipe", "F3"), 10);                  // 1 eq of BA relative to LA
    close(gg("recipe", "G2"), 2.0632);
    close(gg("recipe", "G4"), 60 - 2.0632 - 1.0814);  // DCM (rest)
    close(gg("recipe", "I2"), 2.0632 / 60 * 100);

    // RAFT generator: blanks → needs messages, then numbers from 0005
    r = await run("raft", { monomers: "DAAm", cta: "PDMA 76", init: "VA-044", solvent: "Water" });
    let ev = evalNote();
    const v = ev.g("raft", "B6");
    assert.ok(v.err, "blank mass should error");
    note = note.replace("| Total monomer mass (g) |  |", "| Total monomer mass (g) | 2.5 |").replace("| Target DP |  |", "| Target DP | 105 |")
               .replace("| CTA | PDMA 76 | =MW(B3) |", "| CTA | PDMA 76 | 2220.99 |");
    ev = evalNote();
    close(ev.g("raft_r", "F3"), 0.3125, 1e-3); close(ev.g("raft_r", "F5"), 11.259, 1e-3); close(ev.g("raft", "B7"), 19990.14, 1e-5);

    // Three monomers: rounded fractions (0.333 x 3) must still be normalised, so the monomer masses add up to the total
    r = await run("raft", { monomers: "DMAm, DAAm, Lipoic Acid", cta: "PABTC", init: "VA-044", solvent: "Water" });
    assert.ok(!r.md.includes("[!tip]"), "tip callout removed");
    note = note.replace("| Total monomer mass (g) |  |", "| Total monomer mass (g) | 2.5 |").replace("| Target DP |  |", "| Target DP | 105 |");
    ev = evalNote();
    const mean = (99.13 + 169.23 + 206.32) / 3;
    close(ev.g("raft2_r", "F2") + ev.g("raft2_r", "F3") + ev.g("raft2_r", "F4"), 2.5, 1e-9);
    close(ev.g("raft2", "B6"), 2.5 / mean, 1e-9);
    close(ev.g("raft2", "B7"), 105 * mean + 238.39, 1e-9);

    // Sample list + NMR/GPC + results
    r = await run("samples", { codes: "", count: "3", nmr: true, gpc: true, results: true });
    note = note.replace("| 1 | ABC0016-A | CDCl3 | 1H |  |  |", "| 1 | ABC0016-A | CDCl3 | 1H | 42 |  |")
               .replace("| ABC0016-B | THF |  |  |", "| ABC0016-B | THF | 10000 | 12000 |");
    ev = evalNote();
    close(ev.g("results", "B2"), 42); close(ev.g("results", "C3"), 10000); close(ev.g("results", "E3"), 1.2);
    // adding an NMR row grows the results XLOOKUP ranges
    const nmrStart = extractBlocks(note).find(b => /name: nmr\n/.test(b.source))!.lineStart;
    note = editRows(note, nmrStart, "insert", 4)!;
    assert.ok(/XLOOKUP\(A2, nmr!B\$2:B\$5, nmr!E\$2:E\$5, ""\)/.test(note), "results ranges should grow");

    // Timetable with start time + DLS
    r = await run("timetable", { times: "0, 30, 90", letters: "A, B", start: "10:37", dls: true });
    ev = evalNote();
    assert.strictEqual(ev.g("sampling", "C4"), "12:07");
    assert.ok(r.md.includes("ABC0016-B90"));
    // NMR snippet a second time: unique name + codes from samples table
    r = await run("nmr");
    assert.ok(r.md.includes("name: nmr2") && r.md.includes("ABC0016-A"), r.md);

    // Variant matrix
    r = await run("matrix", { rows: "Lipoic acid, Acetic acid", cols: "Benzyl alcohol, Methanol" }); assert.ok(r.md.includes("copy: list") && r.md.includes("ABC0016-D"));
    // Column + RT linked
    r = await run("column", { density: "1.325", packing: "glass beads" });
    assert.ok(r.md.includes("| Packing material | glass beads |"), r.md);
    note = note.replace("| Empty column (blanking plugs, glass wool) (g) |  |", "| Empty column (blanking plugs, glass wool) (g) | 111.076 |")
               .replace("| Packed column (beads, plugs, glass wool) (g) |  |", "| Packed column (beads, plugs, glass wool) (g) | 111.967 |")
               .replace("| Packed + full of solvent (g) |  |", "| Packed + full of solvent (g) | 114.576 |");
    r = await run("rt");
    assert.ok(r.md.includes("> [!info] Residence time\n> $$\\tau = \\frac{V_{\\text{reactor}}}{Q}$$\n\n"), r.md);
    ev = evalNote();
    close(ev.g("rt", "B4"), 1.7591 / 20, 1e-3);
    r = await run("gpc"); r = await run("dls"); r = await run("results"); r = await run("blank");
    ev = evalNote();
    assert.deepStrictEqual(ev.errs, []);
    await new Promise(res => setTimeout(res, 1000));
    assert.ok(["NMR", "GPC", "DLS"].every(t => tags.includes(t)));
  }, 20000);
});
