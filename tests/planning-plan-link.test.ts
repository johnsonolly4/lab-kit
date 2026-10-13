// Making and removing `after` links on the plan map (src/planning/plan-link.ts).
import { describe, it, expect } from "vitest";
import { addAfter, bridgeAfter, canLink, removeAfter } from "../src/planning/plan-link";
import { readPlan } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });

describe("addAfter", () => {
  it("nothing becomes the link; one value becomes a list; a list gets it at the end", () => {
    expect(addAfter(undefined, "[[A]]")).toBe("[[A]]");
    expect(addAfter("", "[[A]]")).toBe("[[A]]");
    expect(addAfter("[[A]]", "[[B]]")).toEqual(["[[A]]", "[[B]]"]);
    expect(addAfter(["[[A]]", "[[B]]"], "[[C]]")).toEqual(["[[A]]", "[[B]]", "[[C]]"]);
  });
  it("a link that is already there (by name, path or alias) changes nothing", () => {
    expect(addAfter("[[A]]", "[[A]]")).toBe("[[A]]");
    expect(addAfter(["[[X/A|first]]", "[[B]]"], "[[X/A]]")).toEqual(["[[X/A|first]]", "[[B]]"]);
  });
});

describe("removeAfter", () => {
  const names = [T + "A", "A"];
  it("from a list leaves a single value; the last one removes the property", () => {
    expect(removeAfter(["[[A]]", "[[B]]"], names)).toBe("[[B]]");
    expect(removeAfter(["[[A]]", "[[B]]", "[[C]]"], names)).toEqual(["[[B]]", "[[C]]"]);
    expect(removeAfter("[[A]]", names)).toBeUndefined();
  });
  it("matches by name, by path and by alias; no match changes nothing", () => {
    expect(removeAfter("[[00 Planning/To-dos/A|first]]", names)).toBeUndefined();
    expect(removeAfter("[[Other]]", names)).toBe("[[Other]]");
    expect(removeAfter(undefined, names)).toBeUndefined();
  });
});

describe("undo pairs", () => {
  it("add then remove gives the old value back; a single value stays single", () => {
    expect(removeAfter(addAfter(undefined, "[[A]]"), [T + "A", "A"])).toBeUndefined();
    expect(removeAfter(addAfter("[[B]]", "[[A]]"), [T + "A", "A"])).toBe("[[B]]");
  });
  it("remove then add gives the same set back", () => {
    const back = addAfter(removeAfter(["[[A]]", "[[B]]"], [T + "A", "A"]), "[[A]]");
    expect(new Set(back as string[])).toEqual(new Set(["[[A]]", "[[B]]"]));
    expect(addAfter(removeAfter("[[A]]", [T + "A", "A"]), "[[A]]")).toBe("[[A]]");
  });
});

describe("canLink", () => {
  const plan = readPlan([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("D"), td("J", { after: ["[[A]]", "[[D]]"] })], hub);
  const p = (n: string) => T + n + ".md";
  it("itself, twice, and a loop are refused", () => {
    expect(canLink(plan, p("A"), p("A"))).toBe("self");
    expect(canLink(plan, p("A"), p("B"))).toBe("already");
    expect(canLink(plan, p("B"), p("A"))).toBe("loop");   // A is already before B
    expect(canLink(plan, p("C"), p("A"))).toBe("loop");   // through a chain
  });
  it("a join and an unrelated pair are fine", () => {
    expect(canLink(plan, p("D"), p("C"))).toBe("ok");
    expect(canLink(plan, p("C"), p("D"))).toBe("ok");
    expect(canLink(plan, p("B"), p("J"))).toBe("ok");
  });
});

describe("bridgeAfter", () => {
  const B = [T + "B", "B"], C = [T + "C", "C"];
  it("A → B → C becomes A → C", () => {
    expect(bridgeAfter("[[B]]", B, "[[A]]", C)).toBe("[[A]]");
  });
  it("a deleted to-do with two parents gives both; the child's other links stay first", () => {
    expect(bridgeAfter(["[[X]]", "[[B]]"], B, ["[[A]]", "[[A2]]"], C)).toEqual(["[[X]]", "[[A]]", "[[A2]]"]);
  });
  it("a deleted to-do with no `after` just drops the dead link; the last one removes the property", () => {
    expect(bridgeAfter("[[B]]", B, undefined, C)).toBeUndefined();
    expect(bridgeAfter(["[[X]]", "[[B]]"], B, undefined, C)).toBe("[[X]]");
  });
  it("a parent the child already has is not added twice, and the child never comes after itself", () => {
    expect(bridgeAfter(["[[A]]", "[[B]]"], B, ["[[A|first]]", "[[C]]"], C)).toBe("[[A]]");
  });
  it("matches by path as well as name", () => {
    expect(bridgeAfter("[[00 Planning/To-dos/B|b]]", B, "[[A]]", C)).toBe("[[A]]");
  });
});
