// "No behaviour change" proof for the TypeScript port: run the same input through legacy/main.js and src/
// and require identical output. Delete together with legacy/ once the port is accepted.
import { describe, it } from "vitest";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import { extractBlocks, formatValue, isErr, joinRow, parseBlock, splitRow, Workbook, SUPPORTED_FUNCTIONS, type Env, type Value } from "../src/calc/engine";
import { autoInsertIndex, editRows, shiftForDelete, shiftForInsert, shiftRelative, writeCellText } from "../src/calc/rewrite";

const nodeRequire = createRequire(import.meta.url);
const M = Module as any;
const origLoad = M._load;
M._load = function (req: string, ...rest: unknown[]) {
  if (req === "obsidian") return { Plugin: class {}, MarkdownRenderer: {}, Notice: class {}, Menu: class {}, getIcon: () => null, Modal: class {}, Setting: class {}, PluginSettingTab: class {}, Platform: {} };
  return origLoad.call(this, req, ...rest);
};
const L = nodeRequire("../legacy/main.js").__engine;
M._load = origLoad;

const root = path.join(__dirname, "..");
const fixture = fs.readFileSync(path.join(root, "tests/fixtures/kit-demo.md"), "utf8");
// Deterministic stand-in for note properties: known chemicals give a number, "Unknown*" gives an error.
const env: Env = { prop: (note, keys) => /^unknown/i.test(note) ? { err: "#NOTE?", msg: "no note " + note } : (note.length * 10.5 + keys.length) };
const norm = (v: Value | undefined): unknown => JSON.parse(JSON.stringify(v ?? null));

const extra = [
  "```calc\nname: a\n| X | Y | Z |\n|---|---|---|\n| 2 | =A2*b!B2 | =IF(A2>1,\"hi\",\"lo\") |\n| [[Lipoic Acid|LA]] | =MW(A3) | =PROP(\"x\",\"y\") |\n| total | =SUM(B2:B3) | =CLOCK(\"10:30\", 90) |\n```\n```calc\nname: b\n| P | Q |\n|---|---|\n| q | 5 |\n```",
  "> [!example]- Sol\n> ```calc\n> name: x\n> | a | b |\n> | 1 | =A2+1 |\n> | 2 | =XLOOKUP(A3, A2:A3, B2:B3, \"none\") |\n> ```",
  "```calc\nname: bad\n| a | b |\n|---|---|\n| 1 | =1+ |\n| 2 | =FOO(1) |\n| 3 | =1/0 |\n| 4 | =B6 |\n| 5 | =B5 |\n```",
];

const sources = [fixture, ...extra];

describe("src/ matches legacy/main.js", () => {
  it("exports the same formula functions", () => {
    assert.deepStrictEqual([...SUPPORTED_FUNCTIONS], [...L.SUPPORTED_FUNCTIONS]);
  });

  it("splits, joins and parses blocks identically", () => {
    for (const text of sources) {
      assert.deepStrictEqual(extractBlocks(text), L.extractBlocks(text));
      for (const b of extractBlocks(text)) {
        assert.deepStrictEqual(norm(parseBlock(b.source) as any), norm(L.parseBlock(b.source)));
        for (const line of b.source.split("\n").filter(l => l.startsWith("|"))) {
          assert.deepStrictEqual(splitRow(line), L.splitRow(line));
          assert.strictEqual(joinRow(splitRow(line)), L.joinRow(L.splitRow(line)));
        }
      }
    }
  });

  it("evaluates every cell and formats every result identically", () => {
    let formulas = 0;
    for (const text of sources) {
      const blocksNew = extractBlocks(text).map(b => parseBlock(b.source));
      const blocksOld = L.extractBlocks(text).map((b: any) => L.parseBlock(b.source));
      const wbNew = new Workbook(blocksNew, env), wbOld = new L.Workbook(blocksOld, env);
      blocksNew.forEach((b, bi) => b.cells.forEach((row, r) => row.forEach((cell, c) => {
        const a = wbNew.cell(bi, r, c), o = wbOld.cell(bi, r, c);
        assert.deepStrictEqual(norm(a), norm(o), `value at block ${bi} r${r} c${c}`);
        for (const opts of [{}, { decimals: "2" }, { sig: 10 }]) assert.strictEqual(formatValue(a, opts), L.formatValue(o, opts));
        assert.deepStrictEqual([...wbNew.blanksOf(bi, r, c)], [...wbOld.blanksOf(bi, r, c)]);
        if (isErr(a)) for (const k of wbNew.blanksOf(bi, r, c)) assert.deepStrictEqual(wbNew.label(k), wbOld.label(k));
        if (cell.kind === "formula") formulas++;
      })));
    }
    assert.ok(formulas > 50, `expected a real workload, only ${formulas} formulas`);
  });

  it("inserts, deletes and writes cells identically", () => {
    for (const text of sources) {
      for (const b of extractBlocks(text)) {
        const parsed = parseBlock(b.source);
        const n = parsed.cells.length;
        const auto = autoInsertIndex(parsed);
        assert.strictEqual(auto, L.autoInsertIndex(L.parseBlock(b.source)));
        for (const at of [1, auto, n, n + 3]) assert.strictEqual(editRows(text, b.lineStart, "insert", at), L.editRows(text, b.lineStart, "insert", at));
        for (const at of [0, 1, n - 1, n]) assert.strictEqual(editRows(text, b.lineStart, "delete", at), L.editRows(text, b.lineStart, "delete", at));
        for (const [r, c, val] of [[1, 0, "9"], [1, 1, "=A2*2"], [n - 1, 5, "[[A|B]]"]] as [number, number, string][]) {
          assert.strictEqual(writeCellText(text, b.lineStart, r, c, val), L.writeCellText(text, b.lineStart, r, c, val));
        }
      }
    }
  });

  it("rewrites formula references identically", () => {
    const formulas = ["=SUM(B2:B3)", "=sol1!B4", "=$A$2+B$3*C4", "=IF(B2=\"B2\",\"B2\",B2)", "=SUM(sol1!B2:B3)/x!A1", "=A1+A2", "=B3:B5"];
    for (const f of formulas) {
      for (const at of [1, 2, 3, 5]) {
        assert.strictEqual(shiftForInsert(f, () => true, at), L.shiftForInsert(f, () => true, at));
        assert.strictEqual(shiftForDelete(f, () => true, at), L.shiftForDelete(f, () => true, at));
      }
      assert.strictEqual(shiftRelative(f, 1), L.shiftRelative(f, 1));
      assert.strictEqual(shiftRelative(f, -1), L.shiftRelative(f, -1));
    }
  });
});
