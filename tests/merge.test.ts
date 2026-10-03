import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
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

describe("frontmatter merge (key by key)", () => {
  const fm = (keys: string, body = "body\n"): string => `---\n${keys}---\n${body}`;
  const baseFm = fm("Type:\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n");

  it("keeps a key you added and takes a key the kit changed", () => {
    const mine = fm("Type:\nStatus:\n  - Planned\nObjective:\nMy key: x\ncssclasses:\n  - academia\n");
    const kit = fm("Type:\nStatus:\n  - Planned\n  - Done\nObjective:\ncssclasses:\n  - academia\n");
    const r = merge3(baseFm, mine, kit);
    expect(r.clean).toBe(true);
    expect(r.text).toBe(fm("Type:\nStatus:\n  - Planned\n  - Done\nObjective:\nMy key: x\ncssclasses:\n  - academia\n"));
  });

  it("adds a key the kit added, after the kit key before it, and keeps your order", () => {
    const mine = fm("Objective:\nType:\nStatus:\n  - Planned\ncssclasses:\n  - academia\n");
    const kit = fm("Type:\nStatus:\n  - Planned\nOutcome:\nObjective:\ncssclasses:\n  - academia\n");
    const r = merge3(baseFm, mine, kit);
    expect(r.clean).toBe(true);
    expect(r.text).toBe(fm("Objective:\nType:\nStatus:\n  - Planned\nOutcome:\ncssclasses:\n  - academia\n"));
  });

  it("keeps your change to a key the kit left alone, even beside a body change by the kit", () => {
    const mine = fm("Type: Lab\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n");
    const kit = fm("Type:\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n", "body kit\n");
    expect(merge3(baseFm, mine, kit).text).toBe(fm("Type: Lab\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n", "body kit\n"));
  });

  it("is one conflict hunk when you and the kit changed the same key differently", () => {
    const mine = fm("Type: mine\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n");
    const kit = fm("Type: kit\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n");
    const r = mergeRegions(baseFm, mine, kit);
    expect(r.filter(p => "conflict" in p)).toEqual([{ conflict: { ours: ["Type: mine"], base: ["Type:"], theirs: ["Type: kit"] } }]);
    expect(resolveRegions(r, ["kit"], mine)).toBe(fm("Type: kit\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n"));
    expect(merge3(baseFm, mine, kit).clean).toBe(false);
  });

  it("drops a key the kit removed if you left it, and keeps a deleted key deleted", () => {
    const kitGone = fm("Type:\nStatus:\n  - Planned\ncssclasses:\n  - academia\n");
    expect(merge3(baseFm, baseFm, kitGone).text).toBe(kitGone);
    const mineGone = fm("Type:\nStatus:\n  - Planned\ncssclasses:\n  - academia\n");
    expect(merge3(baseFm, mineGone, baseFm).text).toBe(mineGone);
    const edited = fm("Type:\nStatus:\n  - Planned\nObjective: edited\ncssclasses:\n  - academia\n");
    expect(merge3(baseFm, edited, kitGone).clean).toBe(false);   // you edited what the kit removed
  });

  it("falls back to the line merge without frontmatter or with odd frontmatter", () => {
    expect(merge3("a\nm\nb\n", "a mine\nm\nb\n", "a\nm\nb kit\n").text).toBe("a mine\nm\nb kit\n");
    const odd = "---\nnot a key\n---\nbody\n";
    expect(merge3(odd, odd.replace("body", "mine"), odd.replace("not a key", "not a key kit")).text).toBe("---\nnot a key kit\n---\nmine\n");
    const open = "---\nType:\nbody never closes\n";
    expect(merge3(open, open + "mine\n", open.replace("Type:", "Type: kit")).clean).toBe(true);
  });

  it("keeps Windows line endings", () => {
    const mine = fm("Type:\nStatus:\n  - Planned\nObjective:\nMy key: x\ncssclasses:\n  - academia\n").replace(/\n/g, "\r\n");
    const kit = fm("Type: kit\nStatus:\n  - Planned\nObjective:\ncssclasses:\n  - academia\n");
    const r = merge3(baseFm, mine, kit);
    expect(r.clean).toBe(true);
    expect(r.text).toBe(fm("Type: kit\nStatus:\n  - Planned\nObjective:\nMy key: x\ncssclasses:\n  - academia\n").replace(/\n/g, "\r\n"));
  });

  it("merges the real Lab Book Template with a key you added", () => {
    const real = readFileSync("kit/Templates/Lab Book Template.md", "utf8").replace(/\r\n/g, "\n");
    const mine = real.replace("Objective:\n", "Objective:\nMy key: x\n");
    const kit = real.replace("Outcome:\n", "Outcome: from kit\n");
    expect(mine).not.toBe(real);
    expect(kit).not.toBe(real);
    const r = merge3(real, mine, kit);
    expect(r.clean).toBe(true);
    expect(r.text).toContain("My key: x\n");
    expect(r.text).toContain("Outcome: from kit\n");
  });
});
