// Ported from tests/legacy/calccraft-compat.test.js (runs against src/, not legacy/)
import { describe, it } from "vitest";
import assert from "node:assert";
import { extractBlocks, formatValue, parseBlock, Workbook } from "../src/calc/engine";

function evalNote(text: string) {
  const blocks = extractBlocks(text).map(b => parseBlock(b.source));
  const wb = new Workbook(blocks);
  return (bi: number, addr: string): any => {
    const m = addr.match(/^([A-Z]+)(\d+)$/)!;
    const c = m[1].charCodeAt(0) - 65, r = +m[2] - 1;
    return wb.cell(bi, r, c);
  };
}
const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

describe("CalcCraft compatibility", () => {
  it("table from note 0010 (Exp 1, Solution 1), pasted as-is", () => {
    const note0010 = `
\`\`\`calc
name: sol1
| Ingredient   | Eq.  | Mw     | Weight%          | Mass               | Mol                | Added  |
| ------------ | ---- | ------ | ---------------- | ------------------ | ------------------ | ------ |
| PABTC        | 1    | 238.39 | 15               | =b5*(-1c-0r)/100   | =(-1c-0r)/(-3c-0r) | 8.9966 |
| BA           | 1.05 | 108.14 | =100*(+1c-0r)/b5 | =(+1c-0r)*(-2c-0r) | =(-0c-1r)*(-4c-0r) | 4.2896 |
| DCM          |      |        | =100*(+1c-0r)/b5 | =(b5-sum(e2:e3))   |                    | 47.02  |
| Total weight | 60   |        |                  |                    |                    |        |
\`\`\`

\`\`\`calc
name: check
| What | Value |
|---|---|
| PABTC mass x2 | =sol1!E2*2 |
| total mass | =SUM(sol1!E2:E4) |
| pct | 15% |
| circular | =B6 |
| circ2 | =B5 |
| div0 | =1/0 |
| bad | =FOO(1) |
| missing | =nope!A1 |
| sumproduct | =SUMPRODUCT(sol1!B2:B3, sol1!C2:C3) |
| if | =IF(sol1!E2>5,"big","small") |
| pi | =ROUND((pi)*2, 3) |
| neg pow | =-2^2 |
\`\`\`
`;
    const g = evalNote(note0010);
    close(g(0, "E2"), 9);                       // 60*15/100
    close(g(0, "F2"), 9 / 238.39);
    close(g(0, "F3"), (9 / 238.39) * 1.05);
    close(g(0, "E3"), g(0, "F3") * 108.14);
    close(g(0, "D3"), 100 * g(0, "E3") / 60);
    close(g(0, "E4"), 60 - 9 - g(0, "E3"));
    close(g(1, "B2"), 18);
    close(g(1, "B3"), 60);
    assert.strictEqual(g(1, "B5").err, "#CIRC!");
    assert.strictEqual(g(1, "B7").err, "#DIV/0!");
    assert.strictEqual(g(1, "B8").err, "#NAME?");
    assert.strictEqual(g(1, "B9").err, "#REF!");
    close(g(1, "B10"), 1 * 238.39 + 1.05 * 108.14);
    assert.strictEqual(g(1, "B11"), "big");
    close(g(1, "B12"), 6.283);
    close(g(1, "B13"), 4);                      // Excel: -2^2 = 4
  });

  it("column weighing from 0011 (reactor volume = 1.7591 mL)", () => {
    const note0011 = "```calc\nname: column\n| State | Weight(g) |\n|---|---|\n| Empty no plugs |  |\n| Empty with plugs | 111.076 |\n| Packed | 111.967 |\n| Mass of beads | =b4-b3 |\n| Packed and full | 114.576 |\n| Mass DCM | =b6-b4 |\n| Volume DCM | =b7/1.325 |\n| Reactor volume | =b8-0.21 |\n```";
    const h = evalNote(note0011);
    close(h(0, "B5"), 0.891);
    close(h(0, "B9"), (114.576 - 111.967) / 1.325 - 0.21);
    assert.strictEqual(formatValue(h(0, "B9"), {}), "1.7591");
  });

  it("formatting", () => {
    assert.strictEqual(formatValue(0.00014069328, {}), "0.0001407");
    assert.strictEqual(formatValue(8358.89234, {}), "8358.8923");
    assert.strictEqual(formatValue(1.5, { decimals: "3" }), "1.500");
    assert.strictEqual(formatValue({ err: "#REF!" }, {}), "#REF!");
  });

  it("callout-wrapped block is still found", () => {
    const k = evalNote("> [!example]- Sol\n> ```calc\n> name: x\n> | a | b |\n> | 1 | =A2+1 |\n> ```");
    close(k(0, "B2"), 2);
  });
});
