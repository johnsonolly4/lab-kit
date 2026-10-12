// The project plan engine (src/planning/plan.ts): order, blocked, problems.
import { describe, it, expect } from "vitest";
import { hasPlan, planLines, readPlan } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const names = (todos: NoteRec[]) => readPlan(todos, hub).rows.map(r => r.name);

describe("readPlan", () => {
  it("a chain: parents first, children blocked until the parent is done", () => {
    const todos = [td("C", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("A")];
    const p = readPlan(todos, hub);
    expect(p.rows.map(r => r.name)).toEqual(["A", "B", "C"]);
    expect(p.rows.map(r => r.blocked)).toEqual([false, true, true]);
    expect(p.rows[1].after).toEqual(["A"]);
    expect(p.problems).toEqual([]);
  });

  it("a done parent unblocks its child; finished rows stay in the plan with their result", () => {
    const p = readPlan([td("A", { done: true, result: "  Mn 20 kDa " }), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]", day: "Done" })], hub);
    expect(p.rows.map(r => [r.name, r.done, r.blocked])).toEqual([["A", true, false], ["B", false, false], ["C", true, false]]);
    expect(p.rows[0].result).toBe("Mn 20 kDa");
  });

  it("a join: blocked while either parent is open; after as a list", () => {
    const todos = [td("J", { after: ["[[P1]]", "[[P2|second]]"] }), td("P1", { done: true }), td("P2")];
    const p = readPlan(todos, hub);
    expect(p.rows.map(r => r.name)).toEqual(["P1", "P2", "J"]);
    expect(p.rows[2]).toMatchObject({ blocked: true, after: ["P1", "P2"] });
    expect(readPlan([td("J", { after: ["[[P1]]", "[[P2]]"] }), td("P1", { done: true }), td("P2", { done: true })], hub).rows[2].blocked).toBe(false);
  });

  it("order breaks ties (a number or text; empty last); then the path", () => {
    expect(names([td("z", { order: 1 }), td("a"), td("m", { order: "2" }), td("b", { order: 1 })])).toEqual(["b", "z", "m", "a"]);
    expect(names([td("Late", { order: 1, after: "[[Early]]" }), td("Early", { order: 9 })])).toEqual(["Early", "Late"]);   // parents beat order
  });

  it("a missing link is a problem and is ignored; a self link too", () => {
    const p = readPlan([td("A", { after: ["[[Ghost]]", "[[A]]"] })], hub);
    expect(p.rows[0]).toMatchObject({ blocked: false, after: [] });
    expect(p.problems).toEqual(['"A" comes after "Ghost", which is not a to-do of this project.', '"A" comes after itself.']);
  });

  it("a cycle: reported, every row still listed", () => {
    const p = readPlan([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("C")], hub);
    expect(p.rows.map(r => r.name)).toEqual(["C", "A", "B"]);
    expect(p.problems).toEqual(['These to-dos wait on each other in a circle: "A", "B".']);
  });

  it("only this project's to-dos; a link to another project's to-do is missing", () => {
    const other = note(T + "Other.md", { kind: "todo", project: "[[Beta]]" });
    const p = readPlan([td("A", { after: "[[Other]]" }), other, note(T + "Note.md", { project: "[[Alpha]]" })], hub);
    expect(p.rows.map(r => r.name)).toEqual(["A"]);
    expect(p.problems).toHaveLength(1);
  });

  it("a link with a path resolves", () => {
    expect(names([td("B", { after: "[[00 Planning/To-dos/A]]" }), td("A")])).toEqual(["A", "B"]);
  });
});

describe("hasPlan / planLines (the Plan tile)", () => {
  it("no plan: to-dos with no after and no order, and no problems", () => {
    expect(hasPlan(readPlan([td("A"), td("B")], hub))).toBe(false);
    expect(hasPlan(readPlan([], hub))).toBe(false);
  });
  it("a plan: after, order, or a wrong link (so its message shows)", () => {
    expect(hasPlan(readPlan([td("A"), td("B", { after: "[[A]]" })], hub))).toBe(true);
    expect(hasPlan(readPlan([td("A", { order: 1 })], hub))).toBe(true);
    expect(hasPlan(readPlan([td("A", { after: "[[Ghost]]" })], hub))).toBe(true);
  });
  it("lines: ready, then blocked with after X, then finished with the result; the finished count", () => {
    const p = readPlan([td("Done1", { done: true, result: "Mn 20 kDa" }), td("Next", { after: "[[Done1]]" }), td("Later", { after: ["[[Next]]", "[[Done1]]"] }), td("Free")], hub);
    const { lines, finished } = planLines(p);
    expect(lines.map(l => l.text)).toEqual(["Free", "Next", "Later", "Done1"]);
    expect(lines.map(l => l.badges.map(b => b.text))).toEqual([[], [], ["after Next, Done1"], ["\u2192 Mn 20 kDa"]]);
    expect(finished).toBe(1);
    expect(lines[1].path).toBe(T + "Next.md");
  });
  it("a finished row without a result has no badge", () => {
    expect(planLines(readPlan([td("A", { done: true, order: 1 })], hub)).lines[0].badges).toEqual([]);
  });
});
