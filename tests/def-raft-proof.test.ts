// RAFT proof, part 1 (Phase C4): the RAFT definition (tests/fixtures/defs/raft.md) gives the built-in RAFT block's text byte for byte,
// except the fence line, the `use:` line and the head line's definition name. Reference: src/blocks/raft/text.ts and tests/raft-text.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { parseTemplate } from "../src/kit/snippet-template";
import { readDefinition, type Definition } from "../src/blocks/def/definition";
import { BlockModel, answersFromBlock, blockSource, blockText, changes, readAnswers, shortHash, type Answers, type BlockField } from "../src/blocks/def/block";
import { blockRange, parseBlock } from "../src/blocks/core";
import { DEFAULT_RAFT, applyOps, inBlock, raftBlock, raftChanges, raftLines, replaceWorkedOut, valuesFromBlock, workedFor, writeUsed, type RaftLines, type RaftValues } from "../src/blocks/raft/text";
import { raftTargets } from "../src/blocks/raft/maths";

const parseYaml = (s: string): unknown => load(s);
const snippet = readFileSync("tests/fixtures/defs/raft.md", "utf8");
const header = parseTemplate(snippet, parseYaml)!.header;
const FIELDS: BlockField[] = header.fields;
const DEF_TEXT = /```lk-definition\n([\s\S]*?)\n```/.exec(snippet)![1];
const read = readDefinition(DEF_TEXT, parseYaml, FIELDS);
if (!("def" in read)) throw new Error(read.problems.map(p => p.text).join("\n"));
const DEF: Definition = read.def;
const HASH = shortHash(DEF_TEXT);

const note = (f: string): string => readFileSync(`tests/fixtures/raft/${f}`, "utf8");
const MW: Record<string, number> = { DAAm: 169.23, "PDMA 76": 2220.99, "VA-044": 323.33, DMAm: 99.13, "Lipoic Acid": 206.32 };
const mwOf = (n: string): number | null => MW[n] ?? null;
const lookup = (name: string, prop: string): number | null => prop === "MW" ? mwOf(name) : null;
const picture: RaftValues = { ...DEFAULT_RAFT, monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", mass: "2.5", dp: "105" };
const lines = (v: RaftValues): RaftLines => { const r = raftLines(v); if (!("lines" in r)) throw new Error(r.problem); return r.lines; };

/** The built-in's boxes as the definition's boxes. */
const boxes = (v: RaftValues): Record<string, string> => ({
  monomers: v.monomers, cta: v.cta, initiator: v.initiator, solvent: v.solvent, cosolvent: v.cosolvent, "cosolvent-pct": v.cosolvent ? v.cosolventPct : "",
  "monomer-mass": v.mass, DP: v.dp, "CTA-to-initiator": v.ratio, solids: v.solids,
});
const answersOf = (v: RaftValues): Answers => { const r = readAnswers(FIELDS, boxes(v)); if (!("answers" in r)) throw new Error(r.problem); return r.answers; };
const model = (a: Answers, used: Record<string, string> = {}, lk: typeof lookup = lookup): BlockModel => new BlockModel(DEF, FIELDS, a, used, lk);
const defSource = (v: RaftValues): string => { const m = model(answersOf(v)); return blockSource(m, m.worked(HASH)); };

/** The one place the two texts may differ: the `use:` line and the definition name in the head line. */
const same = (s: string): string => s.replace(/^use: raft\n/m, "").replace(/^# worked out by Lab Kit \(raft, [0-9a-f]{6}\)/m, "# worked out by Lab Kit");
const rebrand = (s: string): string => s.replace("```raft", "```lk-block");
const builtIn = (v: RaftValues): string => raftBlock(lines(v), workedFor(lines(v), mwOf)).replace(/^```raft\n|\n```\n$/g, "");
const fence = (n: string, tag: string): number => n.split("\n").findIndex(l => l.startsWith("```" + tag));

describe("the definition reads", () => {
  it("the snippet's header and definition are fine, 'cosolvent-pct' is read as cosolvent_pct", () => {
    expect(FIELDS.map(f => f.key)).toEqual(["monomers", "cta", "initiator", "solvent", "cosolvent", "cosolvent-pct", "monomer-mass", "DP", "CTA-to-initiator", "solids"]);
    expect(FIELDS.find(f => f.key === "cosolvent-pct")!.when).toBe("cosolvent");
    expect(DEF.worked.length).toBe(8);
  });
});

describe("the C4 additions to the header and the reader", () => {
  it("a worked line with neither each: nor label: is a problem with a sentence", () => {
    const r = readDefinition(DEF_TEXT.replace("  - label: Mn\n    text:", "  - text:"), parseYaml, FIELDS);
    expect("problems" in r && r.problems.map(p => p.text)).toEqual(['Line 65, worked line 8: needs "label:" (the first column of its # line) or "each:" (one line per item).']);
  });
  it("when: must name another question", () => {
    expect(() => parseTemplate(snippet.replace("when: cosolvent", "when: nothing"), parseYaml)).toThrow('Field "cosolvent-pct": when: "nothing" is not another one of the fields.');
  });
  it("a hyphenated question is a formula name with _ (monomer-mass → monomer_mass)", () => {
    expect(model(answersOf(picture)).value("monomer_mass")).toBe(2.5);
  });
});

describe("block text, definition vs built-in", () => {
  it("fresh 0005: the saved note's block, byte for byte", () => {
    const fresh = note("raft-0005-fresh-units.md");
    const saved = blockRange(fresh, fence(fresh, "raft"))!.source;
    expect(same(defSource(picture))).toBe(saved);
    expect(defSource(picture)).toContain("use: raft\n");
  });
  const cases: [string, RaftValues][] = [
    ["two monomers, equal shares", { ...picture, monomers: "DAAm, DMAm" }],
    ["two monomers, 0.7 : 0.3", { ...picture, monomers: "DAAm: 0.7, DMAm: 0.3" }],
    ["three monomers", { ...picture, monomers: "DMAm, DAAm, Lipoic Acid" }],
    ["a co-solvent", { ...picture, cosolvent: "Ethanol", cosolventPct: "25" }],
    ["units typed: 2500 mg, 20%", { ...picture, mass: "2500 mg", solids: "20%", ratio: "20.0" }],
  ];
  for (const [name, v] of cases) it(name, () => expect(same(defSource(v))).toBe(builtIn(v)));

  it("three monomers write the mean MW line and one line each", () => {
    const w = model(answersOf({ ...picture, monomers: "DMAm, DAAm, Lipoic Acid" })).worked(HASH);
    expect(w.some(x => x.includes("mean MW = (99.13 g/mol × 1 + 169.23 g/mol × 1 + 206.32 g/mol × 1) ÷ 3 = 158.2267 g/mol"))).toBe(true);
    expect(w[w.length - 1]).toMatch(/^# Mn +105 × 158\.2267 g\/mol \+ 2220\.99 g\/mol = /);
  });
  it("short reagent names (6 characters or fewer): `# Monomers` keeps one space before its text, in the built-in and in the definition", () => {
    const mws: Record<string, number> = { AAm: 71.08, MAm: 85.1, CTA: 417.69, INIT: 323.33 };
    const v: RaftValues = { ...picture, monomers: "AAm, MAm", cta: "CTA", initiator: "INIT" };
    const old = workedFor(lines(v), n => mws[n] ?? null);
    expect(old.some(l => l.startsWith("# Monomers mean MW"))).toBe(true);
    const m = model(answersOf(v), {}, (n, p) => p === "MW" ? mws[n] ?? null : null);
    expect(m.worked(HASH).some(l => l.startsWith("# Monomers mean MW"))).toBe(true);
    expect(m.worked(HASH).filter(l => !l.startsWith("# Monomers")).slice(1)).toEqual(old.filter(l => !l.startsWith("# Monomers")).slice(1));
  });
  it("no worked-out lines when a MW is missing", () => {
    expect(model(answersOf(picture), {}, (n, p) => n === "DAAm" ? null : lookup(n, p)).worked()).toEqual([]);
  });
});

describe("0005 known answer through the definition path", () => {
  it("Mn = 19990.14, CTA 0.3125 g, water 11.259 g", () => {
    const m = model(answersOf(picture));
    expect(m.value("mn") as number).toBeCloseTo(19990.14, 6);
    expect(m.value("cta.target") as number).toBeCloseTo(0.31248, 4);
    expect(m.value("solvent.target") as number).toBeCloseTo(11.259, 3);
    const w = m.worked(HASH);
    expect(w[w.length - 1]).toBe("# Mn       105 × 169.23 g/mol + 2220.99 g/mol = 19990.14 g/mol");
    expect(w.some(x => x.includes("19990.14"))).toBe(true);
  });
});

describe("typed actuals and the head line", () => {
  const mine = (v: RaftValues): string => blockText(defSource(v));
  const mineNote = `---\nExp. Class: RAFT\n---\n\n${mine(picture)}\nAfter the block.\n`;
  const builtNote = `---\nExp. Class: RAFT\n---\n\n${raftBlock(lines(picture), workedFor(lines(picture), mwOf))}\nAfter the block.\n`;
  it("a used: line is written alone; the same as the built-in's", () => {
    const a = writeUsed(mineNote, fence(mineNote, "lk-block"), "DAAm", "2.5012 g")!;
    const b = writeUsed(builtNote, fence(builtNote, "raft"), "DAAm", "2.5012 g")!;
    expect(same(a)).toBe(rebrand(b));
    const was = mineNote.split("\n");
    expect(a.split("\n").filter((l, i) => l !== was[i]).length).toBe(1);
  });
  it("typed values come back out of the used: lines the model reads", () => {
    const src = blockRange(mineNote, fence(mineNote, "lk-block"))!.source;
    const m = model(answersFromBlock(FIELDS, parseBlock(src)), { DAAm: "2.5012 g" });
    expect(m.value("weighed")).toBe(1);
    expect(m.value("monomers.amount")).toEqual([2.5012]);
    expect(blockSource(m, m.worked(HASH))).toContain("  DAAm: 2.5012 g\n  PDMA 76:");
  });
  it("the head line names the definition and a hash of it; replacing the group with itself changes nothing", () => {
    const src = blockRange(mineNote, fence(mineNote, "lk-block"))!.source;
    expect(src).toContain(`# worked out by Lab Kit (raft, ${HASH}), rewritten when the set-up changes`);
    expect(replaceWorkedOut(src, model(answersFromBlock(FIELDS, parseBlock(src))).worked(HASH))).toBe(src);
  });
  it("a hand comment above the group stays", () => {
    const src = blockRange(mineNote, fence(mineNote, "lk-block"))!.source.replace("# worked out", "# kept by hand: degas\n# worked out");
    expect(replaceWorkedOut(src, model(answersFromBlock(FIELDS, parseBlock(src))).worked(HASH))).toBe(src);
  });
  it("a newer format is refused and left alone", () => {
    const newer = mineNote.replace("format: 1", "format: 2");
    expect(writeUsed(newer, fence(newer, "lk-block"), "DAAm", "1 g")).toBeNull();
  });
});

describe("Edit set-up changes only what changed", () => {
  const start = blockText(defSource(picture));
  const noteOf = (s: string): string => `${s}\nAfter.\n`;
  const full = noteOf(start);
  const before = (n: string): Answers => answersFromBlock(FIELDS, parseBlock(blockRange(n, fence(n, "lk-block"))!.source));
  const edit = (n: string, v: RaftValues): string => inBlock(n, fence(n, "lk-block"), s => applyOps(s, changes(FIELDS, before(n), answersOf(v))))!;
  const builtFull = `${raftBlock(lines(picture), workedFor(lines(picture), mwOf))}\nAfter.\n`;
  const builtEdit = (change: Partial<RaftValues>): string => {
    const b = valuesFromBlock(parseBlock(blockRange(builtFull, fence(builtFull, "raft"))!.source));
    return inBlock(builtFull, fence(builtFull, "raft"), s => applyOps(s, raftChanges(b, { ...b, ...change })))!;
  };
  it("DP 105 → 120 rewrites DP only, as the built-in does", () => {
    const out = edit(full, { ...picture, dp: "120" });
    expect(out).toBe(full.replace("DP: 105", "DP: 120"));
    expect(same(out)).toBe(rebrand(builtEdit({ dp: "120" })));
  });
  it("nothing changed, nothing written", () => {
    expect(changes(FIELDS, before(full), answersOf(picture))).toEqual([]);
    expect(edit(full, picture)).toBe(full);
  });
  it("a monomer added adds one line; taken away again, the note is as it was", () => {
    const two = edit(full, { ...picture, monomers: "DAAm, DMAm" });
    expect(two).toBe(full.replace('  "[[DAAm]]": 1\n', '  "[[DAAm]]": 1\n  "[[DMAm]]": 1\n'));
    expect(edit(two, picture)).toBe(full);
  });
  it("a co-solvent is added and taken away again, both lines together", () => {
    const withCo = edit(full, { ...picture, cosolvent: "Ethanol", cosolventPct: "25" });
    expect(withCo).toContain('solids: 20 %\ncosolvent: "[[Ethanol]]"\ncosolvent-pct: 25 %\nused:');
    expect(edit(withCo, picture)).toBe(full);
  });
});

describe("the owner's sheet cases (my_work/private/raft-excel/compare.py, output compare-output.txt)", () => {
  // Cases A, B, C of the sheet through the definition. A, B and C at 0.5 : 0.5 equal the sheet's numbers (6 decimals); C at 0.95 : 0.05 follows CQ10 a (weighted mean),
  // so its numbers are Lab Kit's, not the sheet's plain average. The NMR standard row and `Init eq` are not in the definition (CQ11).
  type Want = { monomers: number[]; cta: number; init: number; solvent: number; mn: number };
  const cases: [string, number, [string, number][], number, number, number, number, Want][] = [
    ["A acrylamide, DP 2350", 2.5, [["AAm", 1]], 2350, 10, 20, 34000, { monomers: [2.5], cta: 0.508866, init: 0.000484, solvent: 12.037401, mn: 201038.0 }],
    ["B DMAm, DP 76", 10, [["DMAm", 1]], 76, 20, 20, 417.69, { monomers: [10], cta: 0.554416, init: 0.021458, solvent: 42.303496, mn: 7951.57 }],
    ["C at 0.5 : 0.5 (the sheet's plain average is right here)", 20, [["DMAm", 0.5], ["Lipoic Acid", 0.5]], 76, 20, 30, 417.69, { monomers: [6.490751, 13.509249], cta: 0.719715, init: 0.027856, solvent: 48.410999, mn: 12024.79 }],
    ["C copolymer 0.95 : 0.05 (CQ10 a: weighted mean; the sheet differs)", 20, [["DMAm", 0.95], ["Lipoic Acid", 0.05]], 76, 20, 30, 417.69, { monomers: [18.025448, 1.974552], cta: 1.051957, init: 0.040715, solvent: 49.216235, mn: 8358.892 }],
  ];
  for (const [name, mass, mons, dp, ratio, solids, mwCta, want] of cases) {
    it(name, () => {
      const mws: Record<string, number> = { AAm: 71.08, DMAm: 99.13, "Lipoic Acid": 206.32, CTA: mwCta, INIT: 323.33 };
      const v: RaftValues = { ...DEFAULT_RAFT, monomers: mons.map(([n, f]) => `${n}: ${f}`).join(", "), cta: "CTA", initiator: "INIT", solvent: "Water", mass: String(mass), dp: String(dp), ratio: String(ratio), solids: String(solids) };
      const m = model(answersOf(v), {}, (n, p) => p === "MW" ? mws[n] ?? null : null);
      const t = raftTargets({ monomers: mons.map(([n, f]) => ({ name: n, mw: mws[n], fraction: f })), cta: { name: "CTA", mw: mwCta }, initiator: { name: "INIT", mw: 323.33 }, massG: mass, dp, ratio, solidsPct: solids })!;
      // the definition equals the built-in maths to 9 decimals ...
      expect(m.value("mn") as number).toBeCloseTo(t.mn, 9);
      (m.value("monomers.target") as number[]).forEach((x, i) => expect(x).toBeCloseTo(t.monomers[i].g, 9));
      expect(m.value("cta.target") as number).toBeCloseTo(t.cta.g, 9);
      expect(m.value("initiator.target") as number).toBeCloseTo(t.initiator.g, 9);
      expect(m.value("solvent.target") as number).toBeCloseTo(t.solventG, 9);
      // ... and the sheet's printed numbers (6 decimals)
      (m.value("monomers.target") as number[]).forEach((x, i) => expect(x).toBeCloseTo(want.monomers[i], 5));
      expect(m.value("cta.target") as number).toBeCloseTo(want.cta, 5);
      expect(m.value("initiator.target") as number).toBeCloseTo(want.init, 5);
      expect(m.value("solvent.target") as number).toBeCloseTo(want.solvent, 5);
      expect(m.value("mn") as number).toBeCloseTo(want.mn, 2);
    });
  }
});
