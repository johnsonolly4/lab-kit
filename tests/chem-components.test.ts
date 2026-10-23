// Chemical components (Phase CD-A): the reader and the content maths. Fixtures in tests/fixtures/chem/components/ are saved notes.
// Known answers: docs/plans/chemical-components-known-answers.py (D1-D4).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { readComponents, content, amountFraction, mainComponent, PROBLEM, MAX_DEPTH, type Lookup } from "../src/chem/components";

const DIR = "tests/fixtures/chem/components";

/** Just enough YAML for these notes: `key: value`, numbers, `- item` lists (quotes dropped). Obsidian's own parser is not run in tests. */
function frontMatter(text: string): Record<string, unknown> {
  const body = text.split("\n---\n")[0].replace(/^---\n/, "");
  const fm: Record<string, unknown> = {};
  let key = "";
  for (const line of body.split("\n")) {
    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && key) { const list = Array.isArray(fm[key]) ? (fm[key] as unknown[]) : []; list.push(item[1].replace(/^"(.*)"$/, "$1")); fm[key] = list; continue; }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    key = m[1].trim();
    fm[key] = m[2] === "" ? null : /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return fm;
}
const notes = new Map<string, Record<string, unknown>>();
for (const f of readdirSync(DIR)) notes.set(f.replace(/\.md$/, "").toLowerCase(), frontMatter(readFileSync(`${DIR}/${f}`, "utf8")));
const lookup: Lookup = name => notes.get(name.toLowerCase());
const fm = (name: string) => notes.get(name.toLowerCase())!;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

describe("readComponents", () => {
  it("reads the two lists in step; the first item is the main component", () => {
    const r = readComponents(fm("Solution A"), "Solution A");
    expect(r.problems).toEqual([]);
    expect(r.items.map(i => [i.name, i.basis, i.lo])).toEqual([["C", "ww", 22], ["D", "ww", 5], ["E", "ww", 0.5], ["X", "rest", undefined]]);
    expect(mainComponent(r.items)?.name).toBe("C");
  });
  it("strips alias and heading from links", () => {
    const r = readComponents({ components: ["[[C|the C]]", "[[D#x]]"], component_amounts: ["22 %", "5 ppm"] });
    expect(r.items.map(i => i.name)).toEqual(["C", "D"]);
    expect(r.items[1]).toMatchObject({ basis: "ppm", lo: 5, hi: 5 });
  });
  it("reads only the snake_case names (CDA-2 a): old spellings are not read", () => {
    expect(readComponents({ Components: ["[[C]]"], "Component amounts": ["22 %"] })).toEqual({ items: [], problems: [] });
    expect(readComponents({ Components: ["[[C]]"], component_amounts: ["22 %"] }).problems).toEqual([PROBLEM.mismatch(0, 1)]);
  });
  it("a note without components has none", () => {
    expect(readComponents(fm("C"))).toEqual({ items: [], problems: [] });
  });
  it("parses ranges, limits and units", () => {
    const one = (t: string) => readComponents({ components: ["[[C]]"], component_amounts: [t] }).items[0];
    expect(one("10-20 %")).toMatchObject({ basis: "ww", lo: 10, hi: 20 });
    expect(one("≤ 30 ppm")).toMatchObject({ basis: "ppm", lo: 0, hi: 30 });
    expect(one("20 mmol/L")).toMatchObject({ basis: "molL", lo: 0.02 });
    expect(one("0,5 M")).toMatchObject({ basis: "molL", lo: 0.5 });
    expect(one("20 mg/mL")).toMatchObject({ basis: "gL", lo: 20 });
    expect(one("5 % w/v")).toMatchObject({ basis: "wv", lo: 5 });
    expect(one("10 % v/v")).toMatchObject({ basis: "vv", lo: 10 });
    expect(one("22 wt%")).toMatchObject({ basis: "ww", lo: 22 });
    expect(one("by MW").basis).toBe("byMW");
    expect(one("").basis).toBe("unknown");
  });
  it("one sentence per bad note", () => {
    expect(readComponents(fm("Bad lengths"), "Bad lengths").problems).toEqual([PROBLEM.mismatch(3, 2)]);
    expect(readComponents(fm("Bad amount"), "Bad amount").problems).toEqual([PROBLEM.notAmount("Bad amount", 2, "5 pc")]);
    expect(readComponents(fm("Per kg"), "Per kg").problems).toEqual([PROBLEM.perKg("0.5 mol/kg")]);
    expect(readComponents(fm("Two rest"), "Two rest").problems).toEqual([PROBLEM.twoRest("Two rest")]);
  });
});

describe("content (known answers)", () => {
  it("D1: Solution A carries 0.1452 g pure C per g; 0.500 g C needs 3.4435 g of A", () => {
    const c = content("Solution A", "C", lookup);
    expect(c.problems).toEqual([]);
    expect(r4(c.min)).toBe(0.1452);
    expect(r4(c.max)).toBe(0.1452);
    const a = 0.5 / c.min;
    expect(r4(a)).toBe(3.4435);
    expect(r4(a * content("Solution A", "D", lookup).min)).toBe(0.1722);
    expect(r4(a * content("Solution A", "E", lookup).min)).toBe(0.0172);
    expect(r4(a * content("Solution A", "X", lookup).min)).toBe(2.4966);
  });
  it("D2: acid from a pre-mix and a stock: 2.0000 g of S, 9.0000 g of water to add", () => {
    const inP = content("Premix P", "Acid", lookup).min;
    const inS = content("Stock S", "Acid", lookup).min;
    expect(inP).toBeCloseTo(0.02, 10);
    expect(inS).toBeCloseTo(0.1, 10);
    const stock = (0.3 - 5 * inP) / inS;
    expect(r4(stock)).toBe(2);
    expect(r4(20 - 5 - stock - 4)).toBe(9);
    const water = 9 + 5 * content("Premix P", "Water", lookup).min + stock * content("Stock S", "Water", lookup).min;
    expect(r4(water)).toBe(15.2);
  });
  it("D3: a monomer at most 30 ppm MEHQ brings at most 0.30 mg per 10 g (15.0 ppm of 20 g)", () => {
    const c = content("MMA", "MEHQ", lookup);
    expect(c.min).toBe(0);
    expect(r4(10 * c.max * 1000)).toBe(0.3);
    expect(Math.round(10 * c.max / 20 * 1e7) / 10).toBe(15);
    expect(content("MMA", "MMA", lookup).min).toBeCloseTo(0.99, 10);
  });
  it("D4: a 0.020 mol/L stock carries 0.006467 g VA-044 per g; 3.00 mg needs 0.4639 g", () => {
    const c = content("VA-044 stock", "VA-044", lookup);
    expect(c.problems).toEqual([]);
    expect(Math.round(c.min * 1e6) / 1e6).toBe(0.006467);
    expect(r4(0.003 / c.min)).toBe(0.4639);
  });
  it("D1 with a range: an SDS range gives a range, not a number", () => {
    const c = content("SDS mix", "C", lookup);
    expect(r4(c.min)).toBe(0.066);
    expect(r4(c.max)).toBe(0.132);
  });
});

describe("CD5: the same CAS number is the same ingredient", () => {
  it("glacial acetic acid counts as acetic acid", () => {
    expect(r4(content("Vinegar", "Acetic acid", lookup).min)).toBe(0.0499);
    expect(content("Glacial acetic acid", "Acetic acid", lookup).min).toBeCloseTo(0.997, 10);
  });
  it("notes without a CAS match only themselves", () => {
    expect(content("Vinegar", "Aqua", lookup).max).toBe(0);
    expect(content("Water", "Aqua", lookup).max).toBe(0);
  });
});

describe("one problem sentence", () => {
  it("a cycle", () => {
    expect(content("Cycle A", "C", lookup).problems).toEqual([PROBLEM.cycle(["Cycle A", "Cycle B", "Cycle A"])]);
  });
  it(`nesting deeper than ${MAX_DEPTH} levels`, () => {
    const chain = (n: number): Lookup => name => {
      const i = /^n(\d+)$/.exec(name)?.[1];
      return i === undefined ? undefined : Number(i) < n ? { components: [`[[n${Number(i) + 1}]]`], component_amounts: ["50 %"] } : {};
    };
    expect(content("n0", "Z", chain(6)).problems).toEqual([]);
    expect(content("n0", "Z", chain(8)).problems).toEqual([PROBLEM.deep("n7")]);
  });
  it("a missing density for a molarity", () => {
    expect(content("No density", "VA-044", lookup).problems).toEqual([PROBLEM.missingDensity("No density", "0.020 mol/L")]);
  });
  it("a missing note", () => {
    expect(content("Solution A", "D", n => n === "Solution A" ? fm("Solution A") : undefined).problems).toContain(PROBLEM.noNote("C"));
  });
});

describe("amountFraction", () => {
  const item = (t: string) => readComponents({ components: ["[[C]]"], component_amounts: [t] }).items[0];
  const ctx = { owner: "M", density: 1.02, mw: 100, ownMw: 157.48, componentDensity: 0.9 };
  it("converts each basis", () => {
    expect(amountFraction(item("5 % w/v"), ctx)).toEqual({ lo: 5 / 102, hi: 5 / 102 });
    expect(amountFraction(item("20 g/L"), ctx)).toEqual({ lo: 20 / 1020, hi: 20 / 1020 });
    const vv = amountFraction(item("10 % v/v"), ctx) as { lo: number };
    expect(vv.lo).toBeCloseTo(0.1 * 0.9 / 1.02, 12);
    expect(amountFraction(item("by MW"), ctx)).toEqual({ lo: 100 / 157.48, hi: 100 / 157.48 });
  });
  it("says what is missing", () => {
    expect(amountFraction(item("5 % w/v"), { owner: "M" })).toEqual({ problem: PROBLEM.missingDensity("M", "5 % w/v") });
    expect(amountFraction(item("0.1 mol/L"), { owner: "M", density: 1 })).toEqual({ problem: PROBLEM.missingMw("C", "0.1 mol/L") });
  });
});
