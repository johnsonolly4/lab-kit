// Solution block text: parse, change one line, format version. Fixtures in tests/fixtures/solution/ are saved notes, never regenerated.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { FORMAT_VERSION, balanceDecimals, blockRange, formatQuantity, gramsToUnit, massToGrams, parseQuantity, parseSolution, setLine, writeActual, writeSetup } from "../src/solution/block";

const note = readFileSync("tests/fixtures/solution/acid-ph4.md", "utf8");
const fenceLine = note.split("\n").findIndex(l => l.startsWith("```solution"));
const source = blockRange(note, fenceLine)!.source;

describe("quantities", () => {
  it("parse and format", () => {
    expect(parseQuantity("1.30 mg")).toEqual({ value: 1.3, unit: "mg" });
    expect(parseQuantity("18.0012g")).toEqual({ value: 18.0012, unit: "g" });
    expect(parseQuantity("60 %")).toEqual({ value: 60, unit: "%" });
    expect(parseQuantity("4.00")).toEqual({ value: 4, unit: "" });
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc mg")).toBeNull();
    expect(massToGrams({ value: 1.3, unit: "mg" })).toBeCloseTo(0.0013, 12);
    expect(massToGrams({ value: 5, unit: "mL" })).toBeNull();
    expect(gramsToUnit(0.0012205, "mg")).toBeCloseTo(1.2205, 10);
    expect(formatQuantity(1.2205, "mg", 2)).toBe("1.22 mg");
    expect(formatQuantity(4, "", 2)).toBe("4.00");
    expect(balanceDecimals(0.0001, "g")).toBe(4);
    expect(balanceDecimals(0.0001, "mg")).toBe(1);
  });
});

describe("parse the saved format-1 note", () => {
  const s = parseSolution(source);
  it("reads set-up, steps and the version", () => {
    expect(FORMAT_VERSION).toBe(1);
    expect(s.version).toBe(1);
    expect(s.newer).toBe(false);
    expect(s.problems).toEqual([]);
    expect(s.setup["target-pH"]).toBe("4.00");
    expect(s.setup.reagent).toBe("[[Acetic acid]]");
    expect(s.steps.map(x => x.name)).toEqual(["step 1", "step 2"]);
    expect(s.steps[0].values).toEqual({ acid: "1.30 mg", "water-to": "18.0012 g" });
    expect(s.steps[1].values.water).toBe("6.00 g");
  });
  it("a block with no format line is version 1; empty actuals are empty strings", () => {
    const old = parseSolution(blockRange(readFileSync("tests/fixtures/solution/acid-ph4-no-format.md", "utf8"), 2)!.source);
    expect(old.version).toBe(1);
    expect(old.newer).toBe(false);
    expect(old.steps[0].values).toEqual({ acid: "", "water-to": "" });
  });
  it("a newer version is flagged; a bad one is NaN; junk lines are listed", () => {
    expect(parseSolution("format: 2\nx: 1").newer).toBe(true);
    expect(Number.isNaN(parseSolution("format: one").version)).toBe(true);
    expect(parseSolution("a: 1\nnot a line\n  orphan: 2").problems).toEqual([2, 3]);
  });
});

describe("change one line", () => {
  it("writes the actuals exactly as typed; nothing else changes", () => {
    const empty = note.replace("  acid: 1.30 mg", "  acid:").replace("  water-to: 18.0012 g", "  water-to:");
    const a = writeActual(empty, fenceLine, "step 1", "acid", "1.30 mg")!;
    const b = writeActual(a, fenceLine, "step 1", "water-to", "18.0012 g")!;
    expect(b).toBe(note);
  });
  it("set-up edit changes only that line; the hand comment survives", () => {
    const out = writeSetup(note, fenceLine, "target-pH", "4.50")!;
    const diff = out.split("\n").map((l, i) => [l, note.split("\n")[i]]).filter(([x, y]) => x !== y);
    expect(diff).toEqual([["target-pH: 4.50", "target-pH: 4.00"]]);
    expect(out).toContain("# kept by hand: weigh in the fume hood");
    expect(writeSetup(out, fenceLine, "target-pH", "4.00")).toBe(note);
  });
  it("the format line is written like any other set-up line", () => {
    expect(writeSetup(note, fenceLine, "format", "1")).toBe(note);
  });
  it("a missing line is added in its place; a missing step is added at the end", () => {
    expect(setLine("a: 1\nstep 1:\n  x: 2", null, "b", "3")).toBe("a: 1\nb: 3\nstep 1:\n  x: 2");
    expect(setLine("a: 1\nstep 1:\n  x: 2\nstep 2:\n  y: 1", "step 1", "z", "9")).toBe("a: 1\nstep 1:\n  x: 2\n  z: 9\nstep 2:\n  y: 1");
    expect(setLine("a: 1", "step 1", "acid", "1 mg")).toBe("a: 1\nstep 1:\n  acid: 1 mg");
  });
  it("CRLF stays CRLF", () => {
    expect(setLine("a: 1\r\nb: 2\r\n", null, "a", "5")).toBe("a: 5\r\nb: 2\r\n");
  });
  it("a newer block or a wrong line is left alone (null)", () => {
    const newer = note.replace("format: 1", "format: 2");
    expect(writeSetup(newer, fenceLine, "target-pH", "4.50")).toBeNull();
    expect(writeSetup(note, 0, "target-pH", "4.50")).toBeNull();
  });
});
