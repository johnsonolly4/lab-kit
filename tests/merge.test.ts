import { describe, it, expect } from "vitest";
import { merge3, mergeRegions, resolveRegions, type Region } from "../src/kit/merge";

const base = "top\nmiddle\nbottom\n";

describe("merge3", () => {
  it("keeps your edit at the top and the kit's edit at the bottom", () => {
    const r = merge3(base, "top mine\nmiddle\nbottom\n", "top\nmiddle\nbottom kit\n");
    expect(r).toEqual({ clean: true, text: "top mine\nmiddle\nbottom kit\n", conflicts: 0 });
  });

  it("reports a conflict when both change the same line, and never writes markers", () => {
    const r = merge3(base, "top\nmiddle mine\nbottom\n", "top\nmiddle kit\nbottom\n");
    expect(r.clean).toBe(false);
    expect(r.conflicts).toBe(1);
    expect(r.text).toBe("");
  });

  it("is clean when you and the kit made the same edit", () => {
    const r = merge3(base, "top\nmiddle same\nbottom\n", "top\nmiddle same\nbottom\n");
    expect(r).toEqual({ clean: true, text: "top\nmiddle same\nbottom\n", conflicts: 0 });
  });

  it("keeps Windows line endings when your file has them", () => {
    const r = merge3(base, "top mine\r\nmiddle\r\nbottom\r\n", "top\nmiddle\nbottom kit\n");
    expect(r.clean).toBe(true);
    expect(r.text).toBe("top mine\r\nmiddle\r\nbottom kit\r\n");
  });

  it("ignores a BOM at the start of your file", () => {
    const r = merge3(base, String.fromCharCode(0xfeff) + "top\nmiddle\nbottom\n", "top\nmiddle\nbottom kit\n");
    expect(r).toEqual({ clean: true, text: "top\nmiddle\nbottom kit\n", conflicts: 0 });
  });

  it("merges into an empty base (both added different text) as a conflict", () => {
    const r = merge3("", "mine\n", "kit\n");
    expect(r.clean).toBe(false);
  });
});

describe("mergeRegions / resolveRegions", () => {
  const two = (mine: string, kit: string): { regions: Region[]; ours: string } => ({
    regions: mergeRegions("a\nb\nc\nd\ne\n", mine, kit), ours: mine
  });
  // lines 2 and 4 are changed differently by both sides, line 3 is shared
  const { regions, ours } = two("a\nb mine\nc\nd mine\ne\n", "a\nb kit\nc\nd kit\ne\n");

  it("returns each conflict with your lines, the kit's lines and the original", () => {
    const hunks = regions.flatMap(r => "conflict" in r ? [r.conflict] : []);
    expect(hunks).toEqual([
      { ours: ["b mine"], theirs: ["b kit"], base: ["b"] },
      { ours: ["d mine"], theirs: ["d kit"], base: ["d"] }
    ]);
  });

  it("builds the file from the choice for each conflict", () => {
    expect(resolveRegions(regions, ["mine", "mine"], ours)).toBe("a\nb mine\nc\nd mine\ne\n");
    expect(resolveRegions(regions, ["kit", "kit"], ours)).toBe("a\nb kit\nc\nd kit\ne\n");
    expect(resolveRegions(regions, ["both", "kit"], ours)).toBe("a\nb mine\nb kit\nc\nd kit\ne\n");
    expect(resolveRegions(regions, [{ edit: "b one\nb two" }, "mine"], ours)).toBe("a\nb one\nb two\nc\nd mine\ne\n");
    expect(resolveRegions(regions, [{ edit: "" }, "kit"], ours)).toBe("a\nc\nd kit\ne\n");
  });

  it("gives null while any conflict is undecided", () => {
    expect(resolveRegions(regions, ["mine", null], ours)).toBeNull();
    expect(resolveRegions(regions, ["mine"], ours)).toBeNull();
  });

  it("keeps Windows line endings when your file has them", () => {
    const crlf = "a\r\nb mine\r\nc\r\nd mine\r\ne\r\n";
    const r = mergeRegions("a\nb\nc\nd\ne\n", crlf, "a\nb kit\nc\nd kit\ne\n");
    expect(resolveRegions(r, ["kit", "mine"], crlf)).toBe("a\r\nb kit\r\nc\r\nd mine\r\ne\r\n");
  });

  it("has no conflicts when the edits don't overlap, and merge3 agrees", () => {
    const [base, mine, kit] = ["x\nm\ny\n", "x mine\nm\ny\n", "x\nm\ny kit\n"];
    const r = mergeRegions(base, mine, kit);
    expect(r.some(p => "conflict" in p)).toBe(false);
    expect(resolveRegions(r, [], mine)).toBe("x mine\nm\ny kit\n");
    expect(resolveRegions(r, [], mine)).toBe(merge3(base, mine, kit).text);
  });
});
