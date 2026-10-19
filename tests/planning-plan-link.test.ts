// Making and removing `after` links on the plan map (src/planning/plan-link.ts).
import { describe, it, expect } from "vitest";
import { addAfter, bridgeAfter, canLink, canNest, nestAction, planInsert, removeAfter, removeItem } from "../src/planning/plan-link";
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

describe("canNest", () => {
  const plan = readPlan([td("A"), td("B", { after: "[[A]]" }), td("C", { sub: "[[A]]" }), td("D"), td("E", { sub: "[[D]]", after: "[[B]]" })], hub);
  const p = (n: string) => T + n + ".md";
  it("itself, the same parent again, a card with subtasks and a subtask as parent are refused", () => {
    expect(canNest(plan, p("B"), p("B"))).toBe("self");
    expect(canNest(plan, p("C"), p("A"))).toBe("already");
    expect(canNest(plan, p("A"), p("D"))).toBe("has-subs");     // A has subtask C
    expect(canNest(plan, p("B"), p("C"))).toBe("parent-is-sub"); // C is a subtask of A
  });
  it("a to-do whose own `sub` is refused cannot take subtasks (it would be written, then ignored)", () => {
    const bad = readPlan([td("P"), td("S", { sub: "[[P]]" }), td("X", { sub: "[[S]]" }), td("Y")], hub);   // X names S, which is a subtask: X's `sub` is refused
    expect(bad.rows.find(r => r.name === "X")?.subOf).toBe(T + "S.md");
    expect(bad.rows.find(r => r.name === "X")?.parent).toBeNull();
    expect(canNest(bad, T + "Y.md", T + "X.md")).toBe("parent-bad-sub");
    expect(nestAction(bad, T + "Y.md", T + "X.md", false)).toEqual({ do: "refuse", verdict: "parent-bad-sub" });
    const missing = readPlan([td("Y"), td("W", { sub: "[[Ghost]]" })], hub);   // a `sub` naming nothing found does not block it
    expect(canNest(missing, T + "Y.md", T + "W.md")).toBe("ok");
  });
  it("a plain card, a re-parent and a card that has `after` links are fine", () => {
    expect(canNest(plan, p("B"), p("D"))).toBe("ok");
    expect(canNest(plan, p("C"), p("D"))).toBe("ok");   // C moves from A to D
    expect(canNest(plan, p("E"), p("A"))).toBe("ok");   // E keeps `after: B`
  });
});

describe("nestAction", () => {
  const plan = readPlan([td("A"), td("B"), td("C", { sub: "[[A]]" })], hub);
  const p = (n: string) => T + n + ".md";
  it("a drop on a card nests, or is refused with the reason", () => {
    expect(nestAction(plan, p("B"), p("A"), false)).toEqual({ do: "nest", to: p("A") });
    expect(nestAction(plan, p("C"), p("B"), false)).toEqual({ do: "nest", to: p("B") });   // re-parent
    expect(nestAction(plan, p("C"), p("A"), false)).toEqual({ do: "refuse", verdict: "already" });
    expect(nestAction(plan, p("A"), p("B"), false)).toEqual({ do: "refuse", verdict: "has-subs" });
  });
  it("a drop on the background clears a subtask and does nothing for a plain to-do", () => {
    expect(nestAction(plan, p("C"), null, true)).toEqual({ do: "clear" });
    expect(nestAction(plan, p("B"), null, true)).toEqual({ do: "none" });
  });
  it("a drop outside the map does nothing", () => {
    expect(nestAction(plan, p("C"), null, false)).toEqual({ do: "none" });
  });
});

describe("`sub` round trip through readPlan", () => {
  it("a written link is read back as the parent; clearing it (no property) makes the card a plain one again", () => {
    const nested = readPlan([td("A"), td("B", { sub: "[[A]]" })], hub);
    expect(nested.rows.find(r => r.name === "B")?.parent).toBe(T + "A.md");
    expect(nested.rows.find(r => r.name === "A")?.subs.map(s => s.name)).toEqual(["B"]);
    expect(nested.problems).toEqual([]);
    const cleared = readPlan([td("A"), td("B")], hub);
    expect(cleared.rows.find(r => r.name === "B")?.parent).toBeNull();
    expect(cleared.rows.find(r => r.name === "A")?.subs).toEqual([]);
  });
  it("a re-parent replaces the single link, and `after` is untouched", () => {
    const moved = readPlan([td("A"), td("D"), td("B", { sub: "[[D]]", after: "[[A]]" })], hub);
    const b = moved.rows.find(r => r.name === "B")!;
    expect(b.parent).toBe(T + "D.md");
    expect(b.afterPaths).toEqual([T + "A.md"]);
    expect(moved.rows.find(r => r.name === "A")?.subs).toEqual([]);
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

describe("removeItem", () => {
  it("drops the one item that names the target; one left becomes a single value; none left removes the property", () => {
    expect(removeItem(["[[Ghost]]", "[[B]]"], "Ghost")).toBe("[[B]]");
    expect(removeItem(["[[Ghost]]", "[[B]]", "[[C]]"], "Ghost")).toEqual(["[[B]]", "[[C]]"]);
    expect(removeItem("[[Ghost|alias]]", "Ghost")).toBeUndefined();
    expect(removeItem("[[B]]", "Ghost")).toBe("[[B]]");
    expect(removeItem(undefined, "Ghost")).toBeUndefined();
  });
});

describe("planInsert (a to-do between the two ends of an arrow)", () => {
  const plan = readPlan([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("X"), td("Y", { after: "[[X]]" }), td("Z", { after: "[[A]]" })], hub);
  const p = (n: string) => T + n + ".md";
  it("an unrelated to-do goes between: both links are to be written", () => {
    expect(planInsert(plan, p("A"), p("B"), p("X"))).toEqual({ verdict: "ok", nAfterA: true, bAfterN: true });
  });
  it("the arrow must exist, and the to-do is neither end", () => {
    expect(planInsert(plan, p("A"), p("C"), p("X")).verdict).toBe("not-linked");   // C comes after B, not after A
    expect(planInsert(plan, p("A"), p("B"), p("A")).verdict).toBe("self");
    expect(planInsert(plan, p("A"), p("B"), p("B")).verdict).toBe("self");
  });
  it("a loop is refused: the to-do already comes after the end or before the start", () => {
    expect(planInsert(plan, p("A"), p("B"), p("C")).verdict).toBe("loop");   // C comes after B: B would come after C
    expect(planInsert(plan, p("B"), p("C"), p("A")).verdict).toBe("loop");   // A comes before B: A would come after B
  });
  it("a link that is already there is not written again", () => {
    expect(planInsert(plan, p("A"), p("B"), p("Z"))).toEqual({ verdict: "ok", nAfterA: false, bAfterN: true });   // Z already comes after A
    expect(planInsert(plan, p("X"), p("Y"), p("Z"))).toEqual({ verdict: "ok", nAfterA: true, bAfterN: true });
  });
});
