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
const labMethods = require("../kit/Extras/scripts/templater/labMethods.js");

const MW: Record<string, number> = { "lipoic acid": 206.32, "benzyl alcohol": 108.14, "dcm": 84.93, "pabtc": 238.39, "dmam": 99.13, "daam": 169.23, "va-044": 323.33, "a": 100, "b": 200, "c": 50 };
const close = (a: unknown, b: number, tol = 1e-4) => assert.ok(typeof a === "number" && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${JSON.stringify(a)} != ${b}`);

describe("snippets", () => {
  it("generate valid tables whose numbers match the known answers", async () => {
    let note = "---\nChemicals:\n  - \"[[Lipoic Acid]]\"\n  - \"[[Benzyl alcohol]]\"\n  - \"[[DCM]]\"\n---\n";
    const tags: string[] = [];
    const g = globalThis as any;
    g.Notice = class { constructor(_m: string) { /* silent */ } };
    g.app = {
      vault: { adapter: { read: async () => JSON.stringify({ kit: { initials: "ABC" } }) } },
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
        labMethods,
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

    // Solution prep: starts empty (no Chemicals default), two tables (targets + components), MW pulled
    const setCell = (table: string, row: number, col: string, val: string) => {
      const lines = note.split("\n");
      const head = lines.findIndex((l, i) => l === `name: ${table}` && lines.slice(i).some(x => x.startsWith("|")));
      const at = head + lines.slice(head).findIndex(l => l.startsWith("|")) + 1 + row;
      const cells = lines[at].split("|").slice(1, -1).map(c => c.trim());
      cells[col.charCodeAt(0) - 65] = val;
      lines[at] = "| " + cells.join(" | ") + " |";
      note = lines.join("\n");
    };
    const sol = { solutes: "A, B, C", volume: "10" };
    let r = await run("solution", { solutes: "Lipoic Acid, Benzyl alcohol, DCM" });
    assert.ok(r.md.includes("[[Lipoic Acid]]") && !r.md.includes("Appearance") && r.md.includes("name: sol1_in"));
    assert.strictEqual(await run("solution", { solutes: "" }).then(x => x.md), "");
    setCell("sol1", 1, "C", "1"); setCell("sol1", 1, "F", "1.0316");
    let { g: gg, errs } = evalNote();
    assert.deepStrictEqual(errs, []);
    close(gg("sol1", "B2"), 206.32); close(gg("sol1", "I2"), 1.0316); close(gg("sol1", "J2"), 5);   // 1.0316 g / 206.32 = 5 mmol

    // Each solute its own target (V = 10 mL): 0.5 M of A, 20 mg/mL of B, 0.3 g of C; solvent makes up the rest
    r = await run("solution", { label: "Solution 2", ...sol, solvents: "S1" });
    assert.ok(r.md.includes("make up to the final volume"));
    setCell("sol2", 1, "C", "0.5"); setCell("sol2", 2, "C", "20"); setCell("sol2", 2, "D", "mg/mL"); setCell("sol2", 3, "C", "0.3"); setCell("sol2", 3, "D", "g");
    setCell("sol2", 1, "F", "0.5");                                                // A weighed in g
    setCell("sol2", 2, "F", "2"); setCell("sol2", 2, "G", "mL");                   // B added as 2 mL, no density yet
    ({ g: gg, errs } = evalNote());
    assert.deepStrictEqual(errs, []);
    close(gg("sol2", "E2"), 0.5); close(gg("sol2", "E3"), 0.2); close(gg("sol2", "E4"), 0.3); close(gg("sol2", "E5"), 10);
    close(gg("sol2", "E6"), 1.0);                                                  // total target (g)
    assert.ok(gg("sol2", "I3").err, "mL with no density is flagged, not assumed 1.0");
    close(gg("sol2", "I2"), 0.5); close(gg("sol2", "J2"), 5); close(gg("sol2", "K2"), 0.5); close(gg("sol2", "L2"), 50);
    setCell("sol2", 2, "H", "0.8");
    ({ g: gg } = evalNote());
    close(gg("sol2", "I3"), 1.6); close(gg("sol2", "J3"), 8); close(gg("sol2", "K3"), 0.8); close(gg("sol2", "L3"), 160);
    close(gg("sol2", "I6"), 2.1);

    // Mol instead of mmol; two solvents share the final volume
    r = await run("solution", { label: "Solution 3", ...sol, solvents: "S1, S2", amount: "mol" });
    setCell("sol3", 1, "F", "0.5");
    ({ g: gg, errs } = evalNote());
    assert.deepStrictEqual(errs, []);
    assert.ok(r.md.includes("mol (added)"));
    close(gg("sol3", "J2"), 0.005); close(gg("sol3", "K2"), 0.5); close(gg("sol3", "E5"), 5); close(gg("sol3", "E6"), 5);

    // Total concentration split 1:2: molar / mass ratio × M / mg/mL (A = 100, B = 200 g/mol, 10 mL)
    const split = async (label: string, basis: string, totalUnit: string, total: string) =>
      run("solution", { label, solutes: "A, B", volume: "10", mode: "total", ratios: "1, 2", basis, totalUnit, total });
    await split("Solution 4", "molar", "M", "0.3");        // 3 mmol → 1 + 2 mmol → 0.1 g, 0.4 g
    await split("Solution 5", "molar", "mg/mL", "30");     // 0.3 g in the ratio 1×100 : 2×200
    await split("Solution 6", "mass", "mg/mL", "30");      // 0.3 g → 0.1 g, 0.2 g
    await split("Solution 7", "mass", "M", "0.3");         // 3 mmol in the ratio 1/100 : 2/200 = 1 : 1
    ({ g: gg, errs } = evalNote());
    assert.deepStrictEqual(errs, []);
    close(gg("sol4", "E2"), 0.1); close(gg("sol4", "E3"), 0.4);
    close(gg("sol5", "E2"), 0.06); close(gg("sol5", "E3"), 0.24);
    close(gg("sol6", "E2"), 0.1); close(gg("sol6", "E3"), 0.2);
    close(gg("sol7", "E2"), 0.15); close(gg("sol7", "E3"), 0.3);
    r = await split("Solution 8", "molar", "M", "");        // blank total concentration: flagged
    assert.ok(evalNote().g("sol8", "E2").err);

    // Recipe by equivalents with solvent rest + total
    r = await run("recipe", { reagents: "Lipoic Acid, Benzyl alcohol", solvent: "DCM", amount: "10", total: "60" });
    ({ g: gg } = evalNote());
    close(gg("recipe", "F3"), 10);                  // 1 eq of BA relative to LA
    close(gg("recipe", "G2"), 2.0632);
    close(gg("recipe", "G4"), 60 - 2.0632 - 1.0814);  // DCM (rest)
    close(gg("recipe", "I2"), 2.0632 / 60 * 100);

    // Recipe: the first reagent's amount in g (÷ MW) or as a concentration (× volume)
    await run("recipe", { reagents: "A, B", amount: "0.5", amountUnit: "g" });
    await run("recipe", { reagents: "A, B", amount: "0.1", amountUnit: "M", volume: "10" });
    await run("recipe", { reagents: "A, B", amount: "0.1", amountUnit: "M", volume: "" });       // no volume: left blank, not guessed
    let ev0 = evalNote();
    assert.deepStrictEqual(ev0.errs, []);
    close(ev0.g("recipe2", "F2"), 5); close(ev0.g("recipe2", "G2"), 0.5);                         // 0.5 g / 100 g/mol
    close(ev0.g("recipe3", "F2"), 1); close(ev0.g("recipe3", "G2"), 0.1);                         // 0.1 M × 10 mL
    assert.ok(ev0.g("recipe4", "F2").err, "no amount, no number");

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

    // RAFT co-solvent: a share of the solvent's mass, outside the solids
    r = await run("raft", { monomers: "DAAm", cta: "PDMA 76", init: "VA-044", solvent: "Water", cosolvent: "Ethanol" });
    const rid = r.md.match(/name: (raft\d*)\n/)![1];
    setCell(rid, 1, "B", "2.5"); setCell(rid, 2, "B", "105"); setCell(`${rid}_r`, 2, "C", "2220.99");
    ev = evalNote();
    assert.deepStrictEqual(ev.errs, []);
    close(ev.g(`${rid}_r`, "F5"), 11.259, 1e-3); close(ev.g(`${rid}_r`, "F6"), 11.259 * 0.2, 1e-3);
    assert.ok(r.md.includes("Co-solvent (% of solvent mass) | 20"));

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
