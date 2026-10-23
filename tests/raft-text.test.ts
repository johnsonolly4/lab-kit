// RAFT block text: the window's answers as block lines, reading them back, the worked-out `#` lines, one-line writes. Fixtures in tests/fixtures/raft/ are saved notes, never regenerated.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { blockRange, parseBlock } from "../src/blocks/core";
import { DEFAULT_RAFT, applyOps, inBlock, monomersOf, parseMonomers, raftBlock, raftChanges, raftLines, raftSource, removeLine, replaceWorkedOut, valuesFromBlock, workedFor, writeUsed, type RaftLines, type RaftValues } from "../src/blocks/raft/text";
import { fmtMass, fmtMmol, fmtMn } from "../src/blocks/raft/format";

const note = (f: string): string => readFileSync(`tests/fixtures/raft/${f}`, "utf8");
const MW: Record<string, number> = { DAAm: 169.23, "PDMA 76": 2220.99, "VA-044": 323.33, DMAm: 99.13, "Lipoic Acid": 206.32 };
const mwOf = (n: string): number | null => MW[n] ?? null;
const fence = (n: string): number => n.split("\n").findIndex(l => l.startsWith("```raft"));
const picture: RaftValues = { ...DEFAULT_RAFT, monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", mass: "2.5", dp: "105" };
const lines = (v: RaftValues): RaftLines => { const r = raftLines(v); if (!("lines" in r)) throw new Error(r.problem); return r.lines; };

describe("numbers as written", () => {
  it("masses, mmol, Mn", () => {
    expect(fmtMass(2.5)).toBe("2.5000 g");
    expect(fmtMass(0.31248)).toBe("0.3125 g");
    expect(fmtMass(11.25901)).toBe("11.259 g");
    expect(fmtMass(0.00227)).toBe("2.27 mg");
    expect(fmtMmol(0.01477279)).toBe("14.773 mmol");
    expect(fmtMmol(0.00014069)).toBe("0.1407 mmol");
    expect(fmtMmol(0.00000703466)).toBe("0.00703 mmol");
    expect(fmtMn(19990.14, 2)).toBe("19 990.14 g/mol");
    expect(fmtMn(19963.37, 0)).toBe("19 963 g/mol");
  });
});

describe("the window's answers as block text", () => {
  it("the picture's values give the saved fresh block byte for byte (with the worked-out lines)", () => {
    const fresh = note("raft-0005-fresh-units.md");
    const l = lines(picture);
    const worked = workedFor(l, mwOf);
    expect(worked.length).toBe(7);
    expect(raftBlock(l, worked)).toBe(fresh.slice(fresh.indexOf("```raft"), fresh.indexOf("```\n\nAfter") + 4));
    expect(blockRange(fresh, fence(fresh))!.source).toBe(raftSource(l, worked));
  });
  it("a bare mass takes g, % is added, numbers stay as typed", () => {
    const l = lines({ ...picture, mass: "2500 mg", solids: "20%", ratio: "20.0" });
    expect([l.mass, l.solids, l.ratio]).toEqual(["2500 mg", "20 %", "20.0"]);
    expect(lines({ ...picture, mass: "2.5" }).mass).toBe("2.5 g");
  });
  it("several monomers, with and without fractions; a co-solvent adds its two lines", () => {
    expect(parseMonomers("DAAm, DMAm")).toEqual([{ name: "DAAm", fraction: "1" }, { name: "DMAm", fraction: "1" }]);
    expect(parseMonomers("[[DAAm]]: 0.7, DMAm: 0.3")).toEqual([{ name: "DAAm", fraction: "0.7" }, { name: "DMAm", fraction: "0.3" }]);
    expect(parseMonomers("")).toBeNull();
    expect(parseMonomers("DAAm, daam")).toBeNull();
    expect(parseMonomers("DAAm: x")).toBeNull();
    const src = raftSource(lines({ ...picture, monomers: "DAAm, DMAm", cosolvent: "Ethanol" }));
    expect(src).toContain('monomers:\n  "[[DAAm]]": 1\n  "[[DMAm]]": 1\ncta:');
    expect(src).toContain('solvent: "[[Water]]"\ncosolvent: "[[Ethanol]]"\ncosolvent-pct: 20 %\nmonomer-mass');
    expect(src).toContain("used:\n  DAAm:\n  DMAm:\n  PDMA 76:\n  Water:\n  Ethanol:\n  VA-044:");
  });
  it("the first unusable box is named", () => {
    expect(raftLines({ ...picture, monomers: "" })).toMatchObject({ field: "monomers" });
    expect(raftLines({ ...picture, mass: "abc" })).toMatchObject({ field: "mass" });
    expect(raftLines({ ...picture, mass: "2.5 mL" })).toMatchObject({ field: "mass" });
    expect(raftLines({ ...picture, dp: "0" })).toMatchObject({ field: "dp" });
    expect(raftLines({ ...picture, solids: "120" })).toMatchObject({ field: "solids" });
    expect(raftLines({ ...picture, cta: " " })).toMatchObject({ field: "cta" });
  });
  it("no worked-out lines when a MW is missing", () => {
    expect(workedFor(lines(picture), n => n === "DAAm" ? null : mwOf(n))).toEqual([]);
  });
  it("three monomers write the mean MW and one line each", () => {
    const w = workedFor(lines({ ...picture, monomers: "DMAm, DAAm, Lipoic Acid", cta: "PDMA 76" }), mwOf);
    expect(w.some(x => x.includes("mean MW = (99.13 g/mol × 1 + 169.23 g/mol × 1 + 206.32 g/mol × 1) ÷ 3 = 158.2267 g/mol"))).toBe(true);
    expect(w.filter(x => /^# (DMAm|DAAm|Lipoic Acid) /.test(x)).length).toBe(3);
    expect(w[w.length - 1]).toMatch(/^# Mn +105 × 158\.2267 g\/mol \+ 2220\.99 g\/mol = /);
  });
});

describe("the saved format-1 note", () => {
  const full = note("raft-0005.md");
  const src = blockRange(full, fence(full))!.source;
  const block = parseBlock(src);
  it("reads set-up, used and the version; hand comments are not problems", () => {
    expect(block.version).toBe(1);
    expect(block.newer).toBe(false);
    expect(block.problems).toEqual([]);
    expect(block.setup.DP).toBe("105");
    expect(monomersOf(block)).toEqual([{ key: '"[[DAAm]]"', name: "DAAm", fraction: "1" }]);
    expect(block.steps.find(s => s.name === "used")!.values).toEqual({ DAAm: "2.5012 g", "PDMA 76": "0.3131 g", Water: "11.2630 g", "VA-044": "" });
  });
  it("the boxes of Edit set-up", () => {
    expect(valuesFromBlock(block)).toEqual({ ...DEFAULT_RAFT, monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", mass: "2.5 g", dp: "105", ratio: "20", solids: "20" });
    expect(valuesFromBlock(parseBlock('monomers:\n  "[[A]]": 0.7\n  "[[B]]": 0.3')).monomers).toBe("A: 0.7, B: 0.3");
  });
  it("typing a used: value writes that one line only", () => {
    const empty = full.replace("  DAAm: 2.5012 g", "  DAAm:");
    expect(writeUsed(empty, fence(empty), "DAAm", "2.5012 g")).toBe(full);
    const out = writeUsed(full, fence(full), "VA-044", "2.31 mg")!;
    expect(out).toBe(full.replace("  VA-044:", "  VA-044: 2.31 mg"));
    const after = out.split("\n"), was = full.split("\n");
    expect(after.filter((l, i) => l !== was[i]).length).toBe(1);   // nothing else, # lines included
  });
  it("a used: line that is missing is added inside used:, above the # lines", () => {
    const gone = full.replace("  VA-044:\n", "");
    expect(writeUsed(gone, fence(gone), "VA-044", "2.31 mg")).toBe(full.replace("  VA-044:", "  VA-044: 2.31 mg"));
  });
  it("a newer format is refused and left alone", () => {
    const newer = full.replace("format: 1", "format: 2");
    expect(writeUsed(newer, fence(newer), "DAAm", "1 g")).toBeNull();
  });
  it("a block with no format line reads as version 1", () => {
    expect(parseBlock(src.replace("format: 1\n", "")).version).toBe(1);
  });
});

describe("Edit set-up changes only what changed", () => {
  const full = note("raft-0005.md");
  const block = parseBlock(blockRange(full, fence(full))!.source);
  const before = valuesFromBlock(block);
  const edit = (after: RaftValues): string => inBlock(full, fence(full), s => applyOps(s, raftChanges(before, after)))!;
  it("DP 105 → 120 rewrites DP only", () => {
    const out = edit({ ...before, dp: "120" });
    expect(out).toBe(full.replace("DP: 105", "DP: 120"));
  });
  it("nothing changed, nothing written", () => {
    expect(raftChanges(before, before)).toEqual([]);
    expect(edit(before)).toBe(full);
  });
  it("adding a monomer adds one line in monomers: and leaves the rest alone", () => {
    const out = edit({ ...before, monomers: "DAAm, DMAm" });
    expect(out).toBe(full.replace('  "[[DAAm]]": 1\n', '  "[[DAAm]]": 1\n  "[[DMAm]]": 1\n'));
  });
  it("removing one takes only its line; its used: line stays (typed data is not dropped)", () => {
    const two = edit({ ...before, monomers: "DAAm, DMAm" });
    const b2 = parseBlock(blockRange(two, fence(two))!.source);
    const out = inBlock(two, fence(two), s => applyOps(s, raftChanges(valuesFromBlock(b2), { ...valuesFromBlock(b2), monomers: "DAAm" })))!;
    expect(out).toBe(full);
  });
  it("a co-solvent is added and taken away again", () => {
    const withCo = edit({ ...before, cosolvent: "Ethanol", cosolventPct: "25" });
    expect(withCo).toContain('solids: 20 %\ncosolvent: "[[Ethanol]]"\ncosolvent-pct: 25 %\nused:');   // new set-up lines go after the last set-up line
    const b2 = parseBlock(blockRange(withCo, fence(withCo))!.source);
    const out = inBlock(withCo, fence(withCo), s => applyOps(s, raftChanges(valuesFromBlock(b2), { ...valuesFromBlock(b2), cosolvent: "" })))!;
    expect(out).toBe(full);
  });
  it("removeLine of a missing line changes nothing", () => {
    expect(removeLine("a: 1", null, "b")).toBe("a: 1");
  });
});

describe("the worked-out lines are replaced as a group", () => {
  const full = note("raft-0005.md");
  const src = blockRange(full, fence(full))!.source;
  it("replacing with the same lines is a no-op, a hand comment above stays", () => {
    const units = note("raft-0005-units.md");
    const unitsSrc = blockRange(units, fence(units))!.source;
    expect(replaceWorkedOut(unitsSrc, workedFor(lines(picture), mwOf))).toBe(unitsSrc);
  });
  it("a block saved before the units were added keeps its # lines until its set-up changes (owner board 9, C4-Q3 b)", () => {
    const before = valuesFromBlock(parseBlock(src));
    expect(src).toContain("# PDMA 76  14.773 ÷ 105 = 0.1407 mmol × 2220.99 = 0.3125 g");
    expect(applyOps(src, raftChanges(before, before))).toBe(src);                       // nothing changed: nothing written
    expect(applyOps(src, raftChanges(before, { ...before, dp: "120" }))).toContain("# PDMA 76  14.773 ÷ 105 = 0.1407");   // a changed DP writes the DP line only
    expect(replaceWorkedOut(src, workedFor(lines(picture), mwOf))).toContain("# PDMA 76  14.773 mmol ÷ 105 = 0.1407 mmol × 2220.99 g/mol = 0.3125 g");   // Edit set-up's rewrite uses the new text
  });
  it("new lines replace the old group only", () => {
    const out = replaceWorkedOut(src, ["# worked out by Lab Kit, rewritten when the set-up changes", "# Mn  1"]);
    expect(out).toContain("# kept by hand: degas for 30 min\n# worked out by Lab Kit");
    expect(out.endsWith("# Mn  1")).toBe(true);
    expect(out).not.toContain("14.773");
  });
  it("a block with none gets them at the end", () => {
    const bare = src.split("\n").filter(l => !l.startsWith("# ")).join("\n");
    expect(replaceWorkedOut(bare, ["# worked out by Lab Kit, rewritten when the set-up changes"])).toBe(bare + "\n# worked out by Lab Kit, rewritten when the set-up changes");
  });
});
