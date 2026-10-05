import { describe, it, expect } from "vitest";
import { formulaRefs } from "../src/calc/refs";

const box = (qual: string | null, r1: number, c1: number, r2 = r1, c2 = c1) => ({ qual, r1, c1, r2, c2 });

describe("formulaRefs (live highlight)", () => {
  it("finds single cells, absolutes and ranges in this table", () => {
    expect(formulaRefs("=B2*$C$3+D4:E6")).toEqual([box(null, 1, 1), box(null, 2, 2), box(null, 3, 3, 5, 4)]);
  });

  it("puts a range's corners in order", () => {
    expect(formulaRefs("=SUM(C5:A2)")).toEqual([box(null, 1, 0, 4, 2)]);
  });

  it("names the other table, in lower case, also with quotes", () => {
    expect(formulaRefs("=Sol1!B2/'My Table'!A1:A3")).toEqual([box("sol1", 1, 1), box("my table", 0, 0, 2, 0)]);
  });

  it("copes with a half-typed formula", () => {
    expect(formulaRefs("=SUM(B2:")).toEqual([box(null, 1, 1)]);
    expect(formulaRefs("=IF(D")).toEqual([]);
    expect(formulaRefs("=")).toEqual([]);
  });

  it("ignores text in strings and function names", () => {
    expect(formulaRefs('=IF(A1="B2", LOG10(C3), "x")')).toEqual([box(null, 0, 0), box(null, 2, 2)]);
  });

  it("resolves relative (-1c-0r) references against the cell being edited", () => {
    expect(formulaRefs("=(-1c0r)*(0c-1r)", { r: 3, c: 2 })).toEqual([box(null, 3, 1), box(null, 2, 2)]);
    expect(formulaRefs("=(-1c0r)")).toEqual([]);                     // no cell given: nothing to resolve against
    expect(formulaRefs("=(-5c0r)", { r: 3, c: 2 })).toEqual([]);     // off the left edge
  });
});
