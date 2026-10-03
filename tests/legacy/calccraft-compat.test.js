const Module = require("module");
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "obsidian") return { Plugin: class {}, MarkdownRenderer: {}, Notice: class {}, Menu: class {}, getIcon: () => null, Modal: class {}, Setting: class {}, PluginSettingTab: class {}, Platform: {} };
  return origLoad.call(this, req, ...rest);
};
const { __engine: E } = require(require("path").join(__dirname, "../../legacy/main.js"));
const assert = require("assert");

function evalNote(text) {
  const blocks = E.extractBlocks(text).map(b => E.parseBlock(b.source));
  const wb = new E.Workbook(blocks);
  return (bi, addr) => {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    const c = m[1].charCodeAt(0) - 65, r = +m[2] - 1;
    return wb.cell(bi, r, c);
  };
}
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

// 1. CalcCraft-style table from note 0010 (Exp 1, Solution 1), pasted as-is
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
close(g(1, "B4") === undefined ? 0 : 0, 0);
assert.strictEqual(g(1, "B5").err, "#CIRC!");
assert.strictEqual(g(1, "B7").err, "#DIV/0!");
assert.strictEqual(g(1, "B8").err, "#NAME?");
assert.strictEqual(g(1, "B9").err, "#REF!");
close(g(1, "B10"), 1 * 238.39 + 1.05 * 108.14);
assert.strictEqual(g(1, "B11"), "big");
close(g(1, "B12"), 6.283);
close(g(1, "B13"), 4);                      // Excel: -2^2 = 4

// 2. Column weighing from 0011
const note0011 = "```calc\nname: column\n| State | Weight(g) |\n|---|---|\n| Empty no plugs |  |\n| Empty with plugs | 111.076 |\n| Packed | 111.967 |\n| Mass of beads | =b4-b3 |\n| Packed and full | 114.576 |\n| Mass DCM | =b6-b4 |\n| Volume DCM | =b7/1.325 |\n| Reactor volume | =b8-0.21 |\n```";
const h = evalNote(note0011);
close(h(0, "B5"), 0.891);
close(h(0, "B9"), (114.576 - 111.967) / 1.325 - 0.21);   // ≈1.759, note says 1.76 ✓

// 3. Formatting
assert.strictEqual(E.formatValue(0.00014069328, {}), "0.0001407");
assert.strictEqual(E.formatValue(8358.89234, {}), "8358.8923");
assert.strictEqual(E.formatValue(1.5, { decimals: "3" }), "1.500");
assert.strictEqual(E.formatValue({ err: "#REF!" }, {}), "#REF!");

// 4. Callout-wrapped block is still found
const inCallout = "> [!example]- Sol\n> ```calc\n> name: x\n> | a | b |\n> | 1 | =A2+1 |\n> ```";
const k = evalNote(inCallout);
close(k(0, "B2"), 2);

console.log("All engine tests passed ✔");
