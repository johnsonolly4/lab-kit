// Block definitions (Phase C3): the limits, the reader, one bad fixture per check, the good RAFT definition.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
// Obsidian's parseYaml is not run in tests (the stub reads JSON only); js-yaml reads the same block YAML.
import { load } from "js-yaml";
import { CHECKS, lineOf, readDefinition, type Definition, type Problem } from "../src/blocks/def/definition";
import { evalScope } from "../src/blocks/def/formula";
import { LIMITS, definitionsProblem, itemsProblem, rowsProblem, sizeProblem } from "../src/blocks/def/limits";
import { raftTargets } from "../src/blocks/raft/maths";

const DIR = "tests/fixtures/defs/";
const parseYaml = (s: string): unknown => load(s);
/** The RAFT snippet's questions (C7 writes them into the kit snippet's header). */
const FIELDS = [
  { key: "monomers", type: "list" }, { key: "cta", type: "text" }, { key: "initiator", type: "text" }, { key: "solvent", type: "text" },
  { key: "cosolvent", type: "text" }, { key: "cosolvent_pct", type: "number" }, { key: "mass", type: "number" }, { key: "dp", type: "number" },
  { key: "ratio", type: "number" }, { key: "solids", type: "number" },
];
const read = (text: string) => readDefinition(text, parseYaml, FIELDS);
const problemsOf = (text: string): Problem[] => { const r = read(text); return "problems" in r ? r.problems : []; };

/** Each bad fixture: its check, key, line and the whole sentence. */
const BAD: Record<string, [Problem["check"], string, number, string]> = {
  "bad-yaml": ["yaml", "", 4, "Line 4, the definition: cannot be read as YAML (missed comma between flow collection entries)."],
  "bad-format-missing": ["format-missing", "", 1, 'Line 1, the definition: needs "format: 1" as its first line.'],
  "bad-format-newer": ["format-newer", "format", 1, 'Line 1, "format": made with a newer Lab Kit (format 2): update the plugin.'],
  "bad-format-bad": ["format-bad", "format", 1, 'Line 1, "format": "one" is not a format number; use format: 1.'],
  "bad-name": ["name", "name", 2, 'Line 2, "name": "Tiny Block" is not a definition name: use small letters, digits and -, starting with a letter.'],
  "bad-key-unknown": ["key-unknown", "colour", 10, 'Line 10, "colour": "colour" is not a definition key. Use format, name, layout, status, title, summary, values, rows, live, worked.'],
  "bad-kind": ["kind", "rows", 4, 'Line 4, "rows": must be a list, one "- " item each.'],
  "bad-choice": ["choice", "layout", 3, 'Line 3, "layout": "cards" is not one of list, table, steps, grouped.'],
  "bad-value-name": ["value-name", "dp1", 6, 'Line 6, value "dp1": "dp1" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.'],
  "bad-formula": ["formula", "target", 9, 'Line 9, "target" of row 1: The formula cannot be read: Expected ")".'],
  "bad-function": ["function", "n", 5, 'Line 5, value "n": XLOOKUP cannot be used in a definition. Look-ups go through "lookup:" on a row.'],
  "bad-cell": ["cell", "n", 5, 'Line 5, value "n": "a1" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.'],
  "bad-list": ["list", "n", 5, 'Line 5, value "n": "monomers.fraction" is a list. Use it only inside SUM, SUMPRODUCT, AVERAGE, MIN, MAX, COUNT.'],
  "bad-circle": ["circle", "a", 6, 'Line 6, value "a": a → b → a refer to each other in a circle.'],
  "bad-name-unknown": ["name-unknown", "target", 9, `Line 9, "target" of row 1: "dq" is not a question in the snippet's fields:, a value or a row name.`],
  "bad-format-unknown": ["format-unknown", "colour", 13, 'Line 13, "colour" in "format" of live line 1: "colour" is not a format. Use mass, mass2, mol, mw, group, lower-first, number, sig, percent, unit.'],
  "bad-each-unknown": ["each-unknown", "each", 10, `Line 10, "each" of row 2: "reagents" is not a question in the snippet's fields:.`],
  "bad-each-not-list": ["each-not-list", "each", 10, 'Line 10, "each" of row 2: "mass" is not a list question (type: list), so a row cannot repeat over it.'],
  "bad-row-id": ["row-id", "rows", 10, 'Line 10, row 2: needs "id:" (a name for the row) or "each:" (a list question).'],
  "bad-row-duplicate": ["row-duplicate", "id", 10, 'Line 10, "id" of row 2: "salt" is already row 1; each row needs its own name.'],
  "bad-target-missing": ["target-missing", "rows", 10, 'Line 10, row 2: needs "target:", the formula for the amount to weigh.'],
  "bad-lookup": ["lookup", "mw", 8, 'Line 8, "mw" in "lookup" of row 1: needs the chemical-note property to read, e.g. "mw: MW".'],
  "bad-token": ["token", "sub", 10, 'Line 10, "sub" of row 1: a "{{=" has no closing "}}".'],
};

describe("bad fixtures: one per check, each gives exactly its sentence", () => {
  const files = readdirSync(DIR).filter(f => f.startsWith("bad-")).map(f => f.replace(/\.yaml$/, ""));
  it("there is one fixture for every check, and no other", () => {
    expect(files.length).toBe(CHECKS.length);
    expect(new Set(files.map(f => BAD[f]?.[0]))).toEqual(new Set(CHECKS));
  });
  for (const f of files) it(f, () => {
    const [check, key, line, text] = BAD[f];
    const r = read(readFileSync(`${DIR}${f}.yaml`, "utf8"));
    expect("def" in r).toBe(false);
    expect("problems" in r && r.problems).toEqual([{ check, key, line, text }]);
  });
});

describe("format: (Target design §5)", () => {
  it("format: 2 is refused before anything else is checked", () => {
    const p = problemsOf("format: 2\nname: Not Checked\nlayout: cards\nfuture-key: 1\n");
    expect(p).toHaveLength(1);
    expect(p[0].text).toContain("made with a newer Lab Kit (format 2): update the plugin");
  });
  it('format: "1" as text reads as 1', () => {
    const r = read(readFileSync(`${DIR}good-raft.yaml`, "utf8").replace("format: 1", 'format: "1"'));
    expect("def" in r && r.def.format).toBe(1);
  });
});

describe("the good RAFT definition (the built-in RAFT block)", () => {
  const r = read(readFileSync(`${DIR}good-raft.yaml`, "utf8"));
  const def = ("def" in r ? r.def : null) as Definition;
  it("reads with no problem", () => {
    expect("problems" in r ? r.problems : []).toEqual([]);
    expect(def.name).toBe("raft");
    expect(def.layout).toBe("list");
    expect(def.rows.map(x => x.id ?? x.each)).toEqual(["monomers", "cta", "solvent", "cosolvent", "initiator"]);
    expect(Object.keys(def.values)).toHaveLength(7);
    expect(def.rows[0].lookup).toEqual({ mw: "MW" });
    expect(def.live[0].format).toEqual([{ name: "number", arg: 0 }, { name: "group", arg: true }, { name: "unit", arg: "g/mol" }]);
  });
  it("its values give the 0005 known answer, Mn = 19990.14, and the RAFT block's initiator mol", () => {
    const s = evalScope(def.values, { "monomers.mw": [169.23], "monomers.fraction": [1], mass: 2.5, dp: 105, ratio: 20, "cta.mw": 2220.99 });
    expect(s.get("MN") as number).toBeCloseTo(19990.14, 6);
    const t = raftTargets({ monomers: [{ name: "DAAm", mw: 169.23, fraction: 1 }], cta: { name: "PDMA 76", mw: 2220.99 }, initiator: { name: "VA-044", mw: 323.33 }, massG: 2.5, dp: 105, ratio: 20, solidsPct: 20 })!;
    expect(s.get("N_INIT") as number).toBeCloseTo(t.initiator.mol, 12);
  });
});

describe("limits hit by generated over-size definitions", () => {
  const head = "format: 1\nname: big\nlayout: list\n";
  const row = (i: number): string => `  - id: r_${i}\n    target: 1\n`;
  it("51 rows", () => {
    expect(problemsOf(head + "rows:\n" + Array.from({ length: 50 }, (_, i) => row(i)).join(""))).toEqual([]);
    const p = problemsOf(head + "rows:\n" + Array.from({ length: 51 }, (_, i) => row(i)).join(""));
    expect(p.map(x => [x.check, x.line, x.text])).toEqual([["limit", 4, 'Line 4, "rows": A definition may have 50 rows at most; this one has 51.']]);
  });
  it("201 named values", () => {
    const values = (n: number): string => "values:\n" + Array.from({ length: n }, (_, i) => `  v_${i}: ${i}\n`).join("");
    expect(problemsOf(head + values(200) + "rows:\n" + row(0))).toEqual([]);
    const p = problemsOf(head + values(201) + "rows:\n" + row(0));
    expect(p.map(x => x.check)).toEqual(["limit"]);
    expect(p[0].text).toBe('Line 4, "values": A definition may have 200 named values at most; this one has 201.');
  });
  it("a formula of 301 characters", () => {
    const f = (n: number): string => "SUM(" + "1,".repeat(Math.floor((n - 6) / 2)) + "1".repeat(1 + (n % 2)) + ")"; // flat: one level deep
    expect(f(301)).toHaveLength(301);
    expect(problemsOf(head + `values:\n  v: ${f(299)}\nrows:\n` + row(0))).toEqual([]);
    const p = problemsOf(head + `values:\n  v: ${f(301)}\nrows:\n` + row(0));
    expect(p.map(x => [x.check, x.key, x.line])).toEqual([["limit", "v", 5]]);
    expect(p[0].text).toContain("longer than 300 characters");
  });
  it("nesting 33 deep", () => {
    const nest = (n: number): string => "ABS(".repeat(n) + "1" + ")".repeat(n);
    expect(problemsOf(head + `values:\n  v: ${nest(32)}\nrows:\n` + row(0))).toEqual([]);
    const p = problemsOf(head + `values:\n  v: ${nest(33)}\nrows:\n` + row(0));
    expect(p.map(x => x.check)).toEqual(["limit"]);
    expect(p[0].text).toContain("nested more than 32 levels deep");
  });
  it("a block over 32 KB", () => {
    const pad = (n: number): string => head + "rows:\n" + row(0) + "# " + "x".repeat(n);
    const base = new TextEncoder().encode(pad(0)).length;
    expect(problemsOf(pad(32768 - base))).toEqual([]);
    const p = problemsOf(pad(32769 - base));
    expect(p.map(x => [x.check, x.line])).toEqual([["limit", 1]]);
    expect(p[0].text).toContain("A definition may be 32 KB at most");
  });
  it("31 items and 101 definitions (draw time and registry)", () => {
    expect(itemsProblem("monomers", 31)).not.toBeNull();
    expect(definitionsProblem(101)).not.toBeNull();
  });
});

describe("lineOf", () => {
  const y = "format: 1\nrows:\n- id: a\n  target: 1\n# note\n- id: b\n  lookup:\n    mw: MW\n  target: 2\nlive: []\n";
  it("finds keys, list items at the parent's indent, and nested keys", () => {
    expect(lineOf(y, ["rows"])).toBe(2);
    expect(lineOf(y, ["rows", 1])).toBe(6);
    expect(lineOf(y, ["rows", 1, "target"])).toBe(9);
    expect(lineOf(y, ["rows", 1, "lookup", "mw"])).toBe(8);
    expect(lineOf(y, ["rows", 0, "lookup"])).toBe(3);
    expect(lineOf(y, ["live"])).toBe(10);
  });
});

describe("limits (CQ6 a)", () => {
  it("are the numbers of the plan", () => {
    expect(LIMITS).toEqual({ values: 200, formulaChars: 300, depth: 32, rows: 50, items: 30, bytes: 32768, definitions: 100 });
  });
  it("each is hit one over the edge, not at it", () => {
    expect(sizeProblem("x".repeat(32768))).toBeNull();
    expect(sizeProblem("x".repeat(32769))).toBe("A definition may be 32 KB at most; this one is 32.0 KB. Split it into two snippets.");
    expect(sizeProblem("µ".repeat(16385))).not.toBeNull();
    expect(rowsProblem(50)).toBeNull();
    expect(rowsProblem(51)).toBe("A definition may have 50 rows at most; this one has 51.");
    expect(itemsProblem("monomers", 30)).toBeNull();
    expect(itemsProblem("monomers", 31)).toBe('"monomers" may hold 30 items at most; it holds 31.');
    expect(definitionsProblem(100)).toBeNull();
    expect(definitionsProblem(101)).toBe("The vault may hold 100 block definitions at most; it holds 101.");
  });
});
