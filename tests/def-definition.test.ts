// Block definitions (Phase C3): the limits, the reader, one bad fixture per check, the good RAFT definition.
import { describe, it, expect } from "vitest";
import { LIMITS, definitionsProblem, itemsProblem, rowsProblem, sizeProblem } from "../src/blocks/def/limits";

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
