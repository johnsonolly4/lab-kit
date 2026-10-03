const Module = require("module"); const o = Module._load;
Module._load = function (r, ...a) { if (r === "obsidian") return { Plugin: class {}, MarkdownRenderer: {}, Notice: class {}, Menu: class {}, getIcon: () => null, Modal: class {}, Setting: class {}, PluginSettingTab: class {}, Platform: {} }; return o.call(this, r, ...a); };
const { __engine: E } = require(require("path").join(__dirname, "../../legacy/main.js"));
const labSnippets = require(require("path").join(__dirname, "../../kit/Extras/scripts/templater/labSnippets.js"));
const assert = require("assert");

const MW = { "lipoic acid": 206.32, "benzyl alcohol": 108.14, "dcm": 84.93, "pabtc": 238.39, "dmam": 99.13, "daam": 169.23, "va-044": 323.33 };
let note = "---\nChemicals:\n  - \"[[Lipoic Acid]]\"\n  - \"[[Benzyl alcohol]]\"\n  - \"[[DCM]]\"\n---\n";
const tags = [];
global.Notice = class { constructor(m) { console.log("NOTICE:", m); } };
global.app = {
  vault: { adapter: { read: async () => JSON.stringify({ initials: "ABC" }) } },
  workspace: { activeEditor: { editor: { getValue: () => note } } },
  metadataCache: {
    getFileCache: () => ({ frontmatter: { Chemicals: ["[[Lipoic Acid]]", "[[Benzyl alcohol]]", "[[DCM]]"] } }),
    getFirstLinkpathDest: (n) => MW[n.toLowerCase()] ? { path: n + ".md" } : null,
  },
  fileManager: { processFrontMatter: async (f, fn) => { const fm = { tags: tags.slice() }; fn(fm); tags.splice(0, tags.length, ...fm.tags); } },
};
const env = { prop: (n) => MW[n.toLowerCase()] ?? { err: "#NOTE?" } };

async function run(key, overrides = {}) {
  let formSeen;
  const tp = {
    config: { target_file: { basename: "0016 - Test", path: "0016 - Test.md" } },
    file: { title: "0016 - Test" },
    date: { now: () => "2026_10_02" },
    user: {
      labForm: async (tp, title, fields) => {
        formSeen = { title, fields };
        const v = {};
        for (const f of fields) if (f.key) v[f.key] = f.key in overrides ? overrides[f.key] : (f.type === "toggle" ? !!f.value : String(f.value ?? ""));
        return v;
      }
    }
  };
  const md = await labSnippets(tp, key);
  note += "\n" + md;
  return { md, formSeen };
}
const evalNote = () => {
  const blocks = E.extractBlocks(note).map(b => E.parseBlock(b.source));
  const wb = new E.Workbook(blocks, env);
  const byName = (n) => blocks.findIndex(b => b.name === n);
  const g = (name, addr) => { const m = addr.match(/^([A-Z]+)(\d+)$/); return wb.cell(byName(name), +m[2] - 1, m[1].charCodeAt(0) - 65); };
  const errs = [];
  blocks.forEach((b) => b.cells.forEach(row => row.forEach(c => { if (c.parseError) errs.push(b.name + ": " + c.raw + " → " + c.parseError); })));
  return { g, wb, errs, blocks, byName };
};
const close = (a, b, tol = 1e-4) => assert.ok(typeof a === "number" && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${JSON.stringify(a)} != ${b}`);

(async () => {
  // Solution prep: defaults to Chemicals, MW pulled, mmol
  let r = await run("solution");
  console.log(r.md);
  assert.ok(r.md.includes("[[Lipoic Acid]]") && !r.md.includes("Appearance"));
  note = note.replace("| [[Lipoic Acid]] | =MW(A2) |  |  |", "| [[Lipoic Acid]] | =MW(A2) | 1 | 1.0316 |");
  let { g } = evalNote();
  close(g("sol1", "B2"), 206.32); close(g("sol1", "E2"), 5);

  // Recipe by equivalents with solvent rest + total
  r = await run("recipe", { mmol: "10", total: "60" });
  console.log(r.md);
  ({ g } = evalNote());
  close(g("recipe", "F3"), 10);                  // 1 eq of BA relative to LA
  close(g("recipe", "G2"), 2.0632);
  close(g("recipe", "G4"), 60 - 2.0632 - 1.0814);  // DCM (rest)
  close(g("recipe", "I2"), 2.0632 / 60 * 100);

  // RAFT generator: blanks → needs messages, then numbers from 0005
  r = await run("raft", { monomers: "DAAm", cta: "PDMA 76", init: "VA-044", solvent: "Water" });
  let ev = evalNote();
  const v = ev.g("raft", "B6");
  assert.ok(v.err, "blank mass should error");
  console.log("RAFT needs:", [...ev.wb.blanksOf(ev.byName("raft"), 5, 1)].map(k => ev.wb.label(k).text));
  note = note.replace("| Total monomer mass (g) |  |", "| Total monomer mass (g) | 2.5 |").replace("| Target DP |  |", "| Target DP | 105 |")
             .replace("| CTA | PDMA 76 | =MW(B3) |", "| CTA | PDMA 76 | 2220.99 |");
  ev = evalNote();
  close(ev.g("raft_r", "F3"), 0.3125, 1e-3); close(ev.g("raft_r", "F5"), 11.259, 1e-3); close(ev.g("raft", "B7"), 19990.14, 1e-5);

  // Sample list + NMR/GPC + results
  r = await run("samples", { codes: "", count: "3", nmr: true, gpc: true, results: true });
  console.log(r.md);
  note = note.replace("| 1 | ABC0016-A | CDCl3 | 1H |  |  |", "| 1 | ABC0016-A | CDCl3 | 1H | 42 |  |")
             .replace("| ABC0016-B | THF |  |  |", "| ABC0016-B | THF | 10000 | 12000 |");
  ev = evalNote();
  close(ev.g("results", "B2"), 42); close(ev.g("results", "C3"), 10000); close(ev.g("results", "E3"), 1.2);
  // adding an NMR row grows the results XLOOKUP ranges
  const nmrStart = E.extractBlocks(note).find(b => /name: nmr\n/.test(b.source)).lineStart;
  note = E.editRows(note, nmrStart, "insert", 4);
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
  r = await run("matrix"); assert.ok(r.md.includes("copy: list") && r.md.includes("ABC0016-D"));
  // Column + RT linked
  r = await run("column", { density: "1.325" });
  note = note.replace("| Empty column (blanking plugs, glass wool) (g) |  |", "| Empty column (blanking plugs, glass wool) (g) | 111.076 |")
             .replace("| Packed column (beads, plugs, glass wool) (g) |  |", "| Packed column (beads, plugs, glass wool) (g) | 111.967 |")
             .replace("| Packed + full of solvent (g) |  |", "| Packed + full of solvent (g) | 114.576 |");
  r = await run("rt");
  ev = evalNote();
  close(ev.g("rt", "B4"), 1.7591 / 20, 1e-3);
  r = await run("gpc"); r = await run("dls"); r = await run("results"); r = await run("blank");
  ev = evalNote();
  assert.deepStrictEqual(ev.errs, []);
  await new Promise(res => setTimeout(res, 1000));
  console.log("tags:", tags);
  assert.ok(["NMR", "GPC", "DLS"].every(t => tags.includes(t)));
  
  console.log("All v0.2 snippet tests passed ✔");
})().catch(e => { console.error(e); process.exit(1); });
