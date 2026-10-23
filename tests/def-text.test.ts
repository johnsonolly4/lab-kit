// Definition texts (Phase C4): the display formats give the built-in RAFT block's numbers, and the filler fills words, formulas and loops.
import { describe, it, expect } from "vitest";
import { ERR } from "../src/calc/engine";
import { fillText, formatValue, parseFormats, type FillHost } from "../src/blocks/def/text";
import { fmtMass, fmtMmol, fmtMw, fmtMn } from "../src/blocks/raft/format";

const f = (v: Parameters<typeof formatValue>[0], ...parts: string[]): string => formatValue(v, parseFormats(parts));

describe("formats", () => {
  it("mass, mol, mw are the RAFT block's", () => {
    for (const g of [2.5, 0.31248, 11.25901, 0.00227]) expect(f(g, "mass")).toBe(fmtMass(g));
    for (const m of [0.01477279, 0.00014069, 0.00000703466]) expect(f(m, "mol")).toBe(fmtMmol(m));
    expect(f(158.226666, "mw")).toBe(fmtMw(158.226666));
    expect(f(169.23, "mw")).toBe("169.23");
  });
  it("number N drops trailing zeros; no format rounds float noise", () => {
    expect(f(19990.14, "number: 2")).toBe("19990.14");
    expect(f(20000, "number: 2")).toBe("20000");
    expect(f(105 * 169.23 + 2220.99, "number: 2")).toBe("19990.14");
    expect(f(0.1 + 0.2)).toBe("0.3");
    expect(f(105)).toBe("105");
  });
  it("group, unit, mass2, sig, percent, lower-first", () => {
    expect(f(19963.37, "number: 0", "group", "unit: g/mol")).toBe(fmtMn(19963.37, 0));
    expect(f(19990.14, "number: 2", "group", "unit: g/mol")).toBe(fmtMn(19990.14, 2));
    expect(f(2.5, "mass2")).toBe("2.50 g");
    expect(f(0.3125, "mass2")).toBe("0.3125 g");
    expect(f(0.123456, "sig: 3")).toBe("0.123");
    expect(f(20, "percent: 1")).toBe("20 %");
    expect(f("Water", "lower-first")).toBe("water");
  });
  it("an error shows its code, a list of one its value", () => {
    expect(f(ERR("#DIV/0!"), "mass")).toBe("#DIV/0!");
    expect(f([2.5], "mass")).toBe("2.5000 g");
  });
});

describe("the filler", () => {
  type C = { item: number | null };
  const names = ["DAAm", "DMAm"], mw = [169.23, 99.13];
  const host: FillHost<C> = {
    value: (formula, c) => formula === "mw" ? mw[c.item ?? 0] : formula === "total" ? 3 : ERR("#NAME?"),
    word: (key, c) => key === "name" ? names[c.item ?? 0] : key === "cta" ? "PDMA 76" : undefined,
    items: list => list === "monomers" ? names.map((_, i) => ({ item: i })) : null,
  };
  it("words, formulas with formats, loops with a separator", () => {
    expect(fillText("{{cta}}: {{= total | mass}}", { item: null }, host)).toBe("PDMA 76: 3.0000 g");
    expect(fillText('P({{#each monomers | "-co-"}}{{name}}{{/each}})', { item: null }, host)).toBe("P(DAAm-co-DMAm)");
    expect(fillText('({{#each monomers | " + "}}{{= mw | mw}} × 1{{/each}})', { item: null }, host)).toBe("(169.23 × 1 + 99.13 × 1)");
  });
  it("an unknown word is left as written, an unknown name shows its error", () => {
    expect(fillText("{{nope}} {{= x}}", { item: null }, host)).toBe("{{nope}} #NAME?");
  });
});
