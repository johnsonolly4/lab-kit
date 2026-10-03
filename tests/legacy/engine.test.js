const Module = require("module"); const o = Module._load;
Module._load = function (r, ...a) { if (r === "obsidian") return { Plugin: class {}, MarkdownRenderer: {}, Notice: class {}, Menu: class {}, getIcon: () => null, Modal: class {}, Setting: class {}, PluginSettingTab: class {}, Platform: {} }; return o.call(this, r, ...a); };
const { __engine: E } = require(require("path").join(__dirname, "../../legacy/main.js"));
const assert = require("assert");
const close = (a, b, tol = 1e-6) => assert.ok(typeof a === "number" && Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${JSON.stringify(a)} != ${b}`);
const env = { prop: (note, keys, isMW) => ({ "lipoic acid": 206.32, "benzyl alcohol": 108.14, "dcm": 84.93 }[note.toLowerCase()] ?? { err: "#NOTE?", msg: "no note " + note }) };
function wbOf(text) {
  const blocks = E.extractBlocks(text).map(b => E.parseBlock(b.source));
  const wb = new E.Workbook(blocks, env);
  const g = (bi, addr) => { const m = addr.match(/^([A-Z]+)(\d+)$/); return wb.cell(bi, +m[2] - 1, m[1].charCodeAt(0) - 65); };
  return { wb, g, blocks };
}

// 1. MW() from note properties, [[links]] with aliases in cells, pipes inside links
let { g, wb } = wbOf("```calc\nname: s\n| Reagent | MW | Added | mmol |\n|---|---|---|---|\n| [[Lipoic Acid|LA]] | =MW(A2) | 1.0316 | =C2/B2*1000 |\n| [[Nothing]] | =MW(A3) |  | =C3/B3 |\n```");
close(g(0, "B2"), 206.32); close(g(0, "D2"), 5);
assert.strictEqual(g(0, "B3").err, "#NOTE?");

// 2. "needs" tracking: RAFT-style DIV/0 caused by blank MW
({ g, wb } = wbOf("```calc\nname: t\n| Parameter | Value |\n|---|---|\n| Mass (g) | 5 |\n| Total mol | =B2/SUMPRODUCT(r!C2:C3, r!D2:D3) |\n```\n```calc\nname: r\n| Role | Name | MW | frac |\n|---|---|---|---|\n| Monomer | DMAm |  | 0.5 |\n| Monomer | DAAm |  | 0.5 |\n```"));
const v = g(0, "B3"); assert.strictEqual(v.err, "#DIV/0!");
const labels = [...wb.blanksOf(0, 2, 1)].map(k => wb.label(k).text);
assert.deepStrictEqual(labels.sort(), ["MW · DAAm", "MW · DMAm"]);

// 3. XLOOKUP chain (recipe by equivalents) without circularity
const recipe = "```calc\nname: recipe\n| Reagent | Eq. | Relative to | MW | Set mmol | mmol | Mass (g) |\n|---|---|---|---|---|---|---|\n| [[Lipoic Acid]] | 1 |  | =MW(A2) | 10 | =IF(E2<>\"\", E2, XLOOKUP(C2, A$2:A$4, F$2:F$4)*B2) | =F2*D2/1000 |\n| [[Benzyl alcohol]] | 1.05 | Lipoic Acid | =MW(A3) |  | =IF(E3<>\"\", E3, XLOOKUP(C3, A$2:A$4, F$2:F$4)*B3) | =F3*D3/1000 |\n| [[DCM]] | 2 | Benzyl alcohol | =MW(A4) |  | =IF(E4<>\"\", E4, XLOOKUP(C4, A$2:A$4, F$2:F$4)*B4) | =F4*D4/1000 |\n```";
({ g } = wbOf(recipe));
close(g(0, "F3"), 10.5); close(g(0, "F4"), 21); close(g(0, "G3"), 10.5 * 108.14 / 1000);
// blank Set mmol and Relative to on first row → needs message
({ g, wb } = wbOf(recipe.replace("| 1 |  | =MW(A2) | 10 |", "| 1 |  | =MW(A2) |  |")));
assert.ok(g(0, "F2").err);
assert.ok([...wb.blanksOf(0, 1, 5)].map(k => wb.label(k).text).includes("Set mmol · Lipoic Acid"));

// 4. CLOCK
({ g } = wbOf("```calc\nname: st\n| S | V |\n|---|---|\n| Start | 10:37 |\n```\n```calc\n| Code | min | target |\n|---|---|---|\n| A0 | 0 | =CLOCK(st!B2, B2) |\n| A90 | 90 | =CLOCK(st!B2, B3) |\n| A900 | 900 | =CLOCK(st!B2, B4) |\n```"));
assert.strictEqual(g(1, "C3"), "12:07"); assert.strictEqual(g(1, "C4"), "01:37");

// 5. Row insert before Total: ranges grow, other tables' refs shift, formulas fill down
const sol = "intro\n```calc\nname: sol1\n| Reagent | Added | wt% |\n|---|---|---|\n| A | 1 | =C2/SUM(B$2:B$3)*100 |\n| B | 3 | =B3/SUM(B$2:B$3)*100 |\n| **Total** | =SUM(B2:B3) |  |\n```\n\n```calc\nname: other\n| x | y |\n|---|---|\n| total | =sol1!B4 |\n| sum | =SUM(sol1!B2:B3) |\n| first | =sol1!B2 |\n```\n";
const parsed = E.parseBlock(E.extractBlocks(sol)[0].source);
const at = E.autoInsertIndex(parsed); assert.strictEqual(at, 3);
const ins = E.editRows(sol, 1, "insert", at);
console.log(ins);
assert.ok(ins.includes("| **Total** | =SUM(B2:B4) |"));
assert.ok(ins.includes("| total | =sol1!B5 |"));
assert.ok(ins.includes("| sum | =SUM(sol1!B2:B4) |"));
assert.ok(ins.includes("| first | =sol1!B2 |"));
assert.ok(ins.includes("|  |  | =B4/SUM(B$2:B$4)*100 |"));       // fill-down from row above
// 6. Delete row 2 (A): refs to it become #REF!, others shift up, ranges shrink
const del = E.editRows(ins, 1, "delete", 1);
assert.ok(del.includes("| first | =sol1!#REF! |") || del.includes("| first | =#REF! |"));
assert.ok(del.includes("| **Total** | =SUM(B2:B3) |"));
assert.ok(del.includes("| total | =sol1!B4 |"));
// 7. Append at end when there's no total row: range ending at last row grows
const plain = "```calc\nname: p\n| a | b |\n|---|---|\n| 1 | =SUM(A2:A3) |\n| 2 |  |\n```";
const app2 = E.editRows(plain, 0, "insert", E.autoInsertIndex(E.parseBlock(E.extractBlocks(plain)[0].source)));
assert.ok(app2.includes("=SUM(A2:A4)"), app2);
// 8. writeCellText keeps [[a|b]] intact
const w = E.writeCellText("```calc\n| x | y |\n|---|---|\n| [[Lipoic Acid|LA]] | 1 |\n```", 0, 1, 1, "2");
assert.ok(w.includes("| [[Lipoic Acid|LA]] | 2 |"), w);
// 9. String literals in formulas are never rewritten
assert.strictEqual(E.shiftRelative('=IF(B2="B2","B2",B2)', 1), '=IF(B3="B2","B2",B3)');
console.log("All v0.2 engine tests passed ✔");
