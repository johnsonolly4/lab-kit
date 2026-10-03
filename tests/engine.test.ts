// Ported from the v0.3 plain-Node test of the same name.
import { describe, it } from "vitest";
import assert from "node:assert";
import { extractBlocks, parseBlock, Workbook, type Env, type Value } from "../src/calc/engine";
import { autoInsertIndex, editRows, shiftRelative, writeCellText } from "../src/calc/rewrite";

const close = (a: unknown, b: number, tol = 1e-6) => assert.ok(typeof a === "number" && Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${JSON.stringify(a)} != ${b}`);
const MWS: Record<string, number> = { "lipoic acid": 206.32, "benzyl alcohol": 108.14, "dcm": 84.93 };
const env: Env = { prop: (note) => MWS[note.toLowerCase()] ?? { err: "#NOTE?", msg: "no note " + note } };
function wbOf(text: string) {
  const blocks = extractBlocks(text).map(b => parseBlock(b.source));
  const wb = new Workbook(blocks, env);
  const g = (bi: number, addr: string): any => { const m = addr.match(/^([A-Z]+)(\d+)$/)!; return wb.cell(bi, +m[2] - 1, m[1].charCodeAt(0) - 65) as Value; };
  return { wb, g, blocks };
}

describe("engine", () => {
  it("MW() from note properties, [[links]] with aliases in cells, pipes inside links", () => {
    const { g } = wbOf("```calc\nname: s\n| Reagent | MW | Added | mmol |\n|---|---|---|---|\n| [[Lipoic Acid|LA]] | =MW(A2) | 1.0316 | =C2/B2*1000 |\n| [[Nothing]] | =MW(A3) |  | =C3/B3 |\n```");
    close(g(0, "B2"), 206.32); close(g(0, "D2"), 5);
    assert.strictEqual(g(0, "B3").err, "#NOTE?");
  });

  it("'needs' tracking: RAFT-style DIV/0 caused by blank MW", () => {
    const { g, wb } = wbOf("```calc\nname: t\n| Parameter | Value |\n|---|---|\n| Mass (g) | 5 |\n| Total mol | =B2/SUMPRODUCT(r!C2:C3, r!D2:D3) |\n```\n```calc\nname: r\n| Role | Name | MW | frac |\n|---|---|---|---|\n| Monomer | DMAm |  | 0.5 |\n| Monomer | DAAm |  | 0.5 |\n```");
    assert.strictEqual(g(0, "B3").err, "#DIV/0!");
    const labels = [...wb.blanksOf(0, 2, 1)].map(k => wb.label(k).text);
    assert.deepStrictEqual(labels.sort(), ["MW · DAAm", "MW · DMAm"]);
  });

  it("XLOOKUP chain (recipe by equivalents) without circularity", () => {
    const recipe = "```calc\nname: recipe\n| Reagent | Eq. | Relative to | MW | Set mmol | mmol | Mass (g) |\n|---|---|---|---|---|---|---|\n| [[Lipoic Acid]] | 1 |  | =MW(A2) | 10 | =IF(E2<>\"\", E2, XLOOKUP(C2, A$2:A$4, F$2:F$4)*B2) | =F2*D2/1000 |\n| [[Benzyl alcohol]] | 1.05 | Lipoic Acid | =MW(A3) |  | =IF(E3<>\"\", E3, XLOOKUP(C3, A$2:A$4, F$2:F$4)*B3) | =F3*D3/1000 |\n| [[DCM]] | 2 | Benzyl alcohol | =MW(A4) |  | =IF(E4<>\"\", E4, XLOOKUP(C4, A$2:A$4, F$2:F$4)*B4) | =F4*D4/1000 |\n```";
    const { g } = wbOf(recipe);
    close(g(0, "F3"), 10.5); close(g(0, "F4"), 21); close(g(0, "G3"), 10.5 * 108.14 / 1000);
    // blank Set mmol and Relative to on first row → needs message
    const r2 = wbOf(recipe.replace("| 1 |  | =MW(A2) | 10 |", "| 1 |  | =MW(A2) |  |"));
    assert.ok(r2.g(0, "F2").err);
    assert.ok([...r2.wb.blanksOf(0, 1, 5)].map(k => r2.wb.label(k).text).includes("Set mmol · Lipoic Acid"));
  });

  it("CLOCK", () => {
    const { g } = wbOf("```calc\nname: st\n| S | V |\n|---|---|\n| Start | 10:37 |\n```\n```calc\n| Code | min | target |\n|---|---|---|\n| A0 | 0 | =CLOCK(st!B2, B2) |\n| A90 | 90 | =CLOCK(st!B2, B3) |\n| A900 | 900 | =CLOCK(st!B2, B4) |\n```");
    assert.strictEqual(g(1, "C3"), "12:07"); assert.strictEqual(g(1, "C4"), "01:37");
  });

  const sol = "intro\n```calc\nname: sol1\n| Reagent | Added | wt% |\n|---|---|---|\n| A | 1 | =C2/SUM(B$2:B$3)*100 |\n| B | 3 | =B3/SUM(B$2:B$3)*100 |\n| **Total** | =SUM(B2:B3) |  |\n```\n\n```calc\nname: other\n| x | y |\n|---|---|\n| total | =sol1!B4 |\n| sum | =SUM(sol1!B2:B3) |\n| first | =sol1!B2 |\n```\n";

  it("row insert before Total: ranges grow, other tables' refs shift, formulas fill down", () => {
    const parsed = parseBlock(extractBlocks(sol)[0].source);
    const at = autoInsertIndex(parsed); assert.strictEqual(at, 3);
    const ins = editRows(sol, 1, "insert", at)!;
    assert.ok(ins.includes("| **Total** | =SUM(B2:B4) |"));
    assert.ok(ins.includes("| total | =sol1!B5 |"));
    assert.ok(ins.includes("| sum | =SUM(sol1!B2:B4) |"));
    assert.ok(ins.includes("| first | =sol1!B2 |"));
    assert.ok(ins.includes("|  |  | =B4/SUM(B$2:B$4)*100 |"));       // fill-down from row above
    // delete row 2 (A): refs to it become #REF!, others shift up, ranges shrink
    const del = editRows(ins, 1, "delete", 1)!;
    assert.ok(del.includes("| first | =sol1!#REF! |") || del.includes("| first | =#REF! |"));
    assert.ok(del.includes("| **Total** | =SUM(B2:B3) |"));
    assert.ok(del.includes("| total | =sol1!B4 |"));
  });

  it("appends at end when there's no total row: range ending at last row grows", () => {
    const plain = "```calc\nname: p\n| a | b |\n|---|---|\n| 1 | =SUM(A2:A3) |\n| 2 |  |\n```";
    const app2 = editRows(plain, 0, "insert", autoInsertIndex(parseBlock(extractBlocks(plain)[0].source)))!;
    assert.ok(app2.includes("=SUM(A2:A4)"), app2);
  });

  it("writeCellText keeps [[a|b]] intact", () => {
    const w = writeCellText("```calc\n| x | y |\n|---|---|\n| [[Lipoic Acid|LA]] | 1 |\n```", 0, 1, 1, "2");
    assert.ok(w.includes("| [[Lipoic Acid|LA]] | 2 |"), w);
  });

  it("string literals in formulas are never rewritten", () => {
    assert.strictEqual(shiftRelative('=IF(B2="B2","B2",B2)', 1), '=IF(B3="B2","B2",B3)');
  });
});

describe("duplicate table names", () => {
  const DUP = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*3 |\n```\n```calc\nname: A \n| P | Q |\n|---|---|\n| 5 | 6 |\n```\n```calc\nname: c\n| M | N |\n|---|---|\n| 1 | =a!B2 |\n| 2 | =SUM(a!A2:B2) |\n| 3 | =XLOOKUP(3, a!A2:A2, a!B2:B2) |\n```";
  it("refs to a shared name are #REF! with a clear message", () => {
    const { g } = wbOf(DUP);
    for (const addr of ["B2", "B3", "B4"]) {
      const v = g(2, addr);
      assert.strictEqual(v.err, "#REF!", addr);
      assert.match(v.msg, /more than one table/);
    }
  });
  it("names differing only by case or spaces count as duplicates", () => {
    const { wb } = wbOf(DUP);
    assert.ok(wb.isDuplicate("a")); assert.ok(!wb.isDuplicate("c")); assert.ok(!wb.isDuplicate(null));
  });
  it("a duplicated table still evaluates its own cells; unique names still resolve", () => {
    const { g } = wbOf(DUP.replace("=a!B2", "=A2*0+7"));
    close(g(0, "B2"), 6); close(g(2, "B2"), 7);
  });
  it("a missing name keeps the old message", () => {
    const { g } = wbOf("```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =zz!A2 |\n```");
    assert.match(g(0, "B2").msg, /no table named "zz"/);
  });
});
