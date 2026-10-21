// Named formulas of a block definition (Phase C2): the 0005 known answer, the copolymer mean MW, refusals, cycles, limits.
import { describe, it, expect } from "vitest";
import { checkFormula, checkValues, evalScope, names } from "../src/blocks/def/formula";
import { raftTargets } from "../src/blocks/raft/maths";
import { evaluate, isErr, parseFormula } from "../src/calc/engine";

const raftValues = {
  mean_mw: "SUMPRODUCT(monomers.mw, monomers.fraction) / SUM(monomers.fraction)",
  n_monomer: "mass / mean_mw",
  n_cta: "n_monomer / dp",
  mn: "dp * mean_mw + cta.mw",
};
const daam = { "monomers.mw": [169.23], "monomers.fraction": [1], mass: 2.5, dp: 105, "cta.mw": 2220.99 };

describe("0005 known answer", () => {
  it("dp * mean_mw + cta.mw = 19990.14", () => {
    const s = evalScope(raftValues, daam);
    expect(s.get("MN") as number).toBeCloseTo(19990.14, 6);
    expect(s.get("N_CTA") as number).toBeCloseTo(0.14069e-3, 8);
  });
  it("the formula as a single line, through evaluate", () => {
    const c = checkFormula("dp * mean_mw + cta.mw");
    if (!("node" in c)) throw new Error(c.problem);
    const known: Record<string, number> = { DP: 105, MEAN_MW: 169.23, "CTA.MW": 2220.99 };
    expect(evaluate(c.node, n => known[n])).toBeCloseTo(19990.14, 6);
  });
});

describe("copolymer mean MW (CQ10 a)", () => {
  it("is weighted by the mole fractions and equals the RAFT block's", () => {
    const mw = [99.13, 206.32], fraction = [0.95, 0.05];
    const s = evalScope(raftValues, { "monomers.mw": mw, "monomers.fraction": fraction, mass: 20, dp: 105, "cta.mw": 238.39 });
    const t = raftTargets({ monomers: [{ name: "A", mw: mw[0], fraction: fraction[0] }, { name: "B", mw: mw[1], fraction: fraction[1] }], cta: { name: "C", mw: 238.39 }, initiator: { name: "I", mw: 323.33 }, massG: 20, dp: 105, ratio: 20, solidsPct: 20 })!;
    expect(s.get("MEAN_MW") as number).toBeCloseTo(0.95 * 99.13 + 0.05 * 206.32, 9);
    expect(s.get("MEAN_MW") as number).toBeCloseTo(t.meanMw, 9);
    expect(s.get("MN") as number).toBeCloseTo(t.mn, 6);
  });
  it("fractions given as 19 : 1 weigh the same", () => {
    const s = evalScope(raftValues, { "monomers.mw": [99.13, 206.32], "monomers.fraction": [19, 1], mass: 20, dp: 105, "cta.mw": 238.39 });
    expect(s.get("MEAN_MW") as number).toBeCloseTo(0.95 * 99.13 + 0.05 * 206.32, 9);
  });
});

describe("refusals, one sentence each", () => {
  const problem = (src: string, lists: string[] = []): string => {
    const c = checkFormula(src, new Set(lists));
    if ("node" in c) throw new Error(`accepted: ${src}`);
    return c.problem;
  };
  it("cell references and ranges", () => {
    expect(problem("A1")).toBe(`"a1" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.`);
    expect(problem("sampling!B2")).toBe(`"sampling!b2" is a cell of another table. A definition cannot read the note's tables.`);
    expect(problem("SUM(A1:B3)")).toMatch(/^A range of cells cannot be used/);
    expect(problem("(-1c-0r) + 1")).toMatch(/^A cell reference such as/);
  });
  it("a name that looks like a cell", () => {
    expect(problem("dp1 * 2")).toBe(`"dp1" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.`);
  });
  it("look-ups and CLOCK", () => {
    for (const f of ["XLOOKUP(a, b, c)", "INDEX(a, 1)", "PROP(a, \"mw\")", "MW(a)"]) expect(problem(f)).toBe(`${f.split("(")[0]} cannot be used in a definition. Look-ups go through "lookup:" on a row.`);
    expect(problem("CLOCK(\"09:00\", 5)")).toBe("CLOCK cannot be used in a definition; it works on times in a table.");
  });
  it("unknown function, bad syntax, lists outside the aggregates", () => {
    expect(problem("FOO(1)")).toMatch(/^FOO is not a calc function\./);
    expect(problem("1 +")).toMatch(/^The formula cannot be read/);
    expect(problem("monomers.mw * 2", ["MONOMERS.MW"])).toBe(`"monomers.mw" is a list. Use it only inside SUM, SUMPRODUCT, AVERAGE, MIN, MAX, COUNT.`);
    expect(problem("ROUND(monomers.mw, 2)", ["MONOMERS.MW"])).toMatch(/is a list/);
    expect(checkFormula("COUNT(monomers.mw) + MAX(monomers.mw)", new Set(["MONOMERS.MW"]))).toHaveProperty("node");
  });
  it("the allowed ones are accepted", () => {
    for (const f of ["IF(a > 1, 2, 3)", "ROUND(a / b, 2)", "SQRT(a)^2", "SLOPE(a, b)", "STDEV(a, b)", "-a%", "\"x\" & a"]) expect(checkFormula(f)).toHaveProperty("node");
  });
  it("checkValues names the key and refuses cell-like keys", () => {
    expect(checkValues({ dp1: "1" })).toEqual([`"dp1" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.`]);
    expect(checkValues({ x: "A1" })[0]).toMatch(/^x: "a1" looks like a cell/);
    expect(checkValues({ dp: "1" }, ["DP"])).toEqual([`"dp" is already used as an answer or row name.`]);
  });
});

describe("names(node)", () => {
  it("lists each name once, upper case, without built-ins", () => {
    expect(names(parseFormula("a * b + A + PI + SUM(monomers.mw)"))).toEqual(["A", "B", "MONOMERS.MW"]);
  });
});

describe("cycles and limits", () => {
  it("a: b, b: a is #CIRC!, not a hang", () => {
    const s = evalScope({ a: "b", b: "a", c: "a + 1" });
    expect(isErr(s.get("A")) && (s.get("A") as { err: string }).err).toBe("#CIRC!");
    expect((s.get("B") as { err: string }).err).toBe("#CIRC!");
    expect((s.get("C") as { err: string }).err).toBe("#CIRC!");
    expect(checkValues({ a: "b", b: "a" })[0]).toBe("a → b → a refer to each other in a circle.");
  });
  it("a value that refers to itself", () => {
    expect((evalScope({ a: "a + 1" }).get("A") as { err: string }).err).toBe("#CIRC!");
  });
  it("a long chain of values evaluates once each", () => {
    const v: Record<string, string> = { base: "1" };
    for (let i = 1; i < 200; i++) v[`n${i}x`] = `${i === 1 ? "base" : `n${i - 1}x`} + ${i === 1 ? "base" : `n${i - 1}x`}`;
    expect(Object.keys(v).length).toBe(200);
    expect(evalScope(v).get("N199X") as number).toBe(2 ** 199);
    expect(checkValues(v)).toEqual([]);
  });
  it("201 values, 301 characters, depth 33", () => {
    const v: Record<string, string> = {};
    for (let i = 0; i < 201; i++) v[`v${i}x`] = "1";
    expect(checkValues(v)[0]).toBe("A definition may have 200 named values at most; this one has 201.");
    expect(evalScope(v).get("V0X")).toMatchObject({ err: "#ERROR!" });
    expect(checkFormula("1" + " ".repeat(300))).toMatchObject({ problem: expect.stringMatching(/longer than 300/) });
    expect(checkFormula("1" + " ".repeat(299))).toHaveProperty("node");
    expect(checkFormula("-".repeat(32) + "1")).toHaveProperty("node");
    expect(checkFormula("-".repeat(33) + "1")).toMatchObject({ problem: expect.stringMatching(/nested more than 32/) });
    expect(checkFormula("(".repeat(40) + "1" + ")".repeat(40))).toHaveProperty("node");
  });
  it("errors come back as calc error values", () => {
    const s = evalScope({ q: "a / 0", u: "nothere + 1" }, { a: 1 });
    expect((s.get("Q") as { err: string }).err).toBe("#DIV/0!");
    expect((s.get("U") as { err: string }).err).toBe("#NAME?");
  });
});
