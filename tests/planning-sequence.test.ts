// Link to-dos in order (src/planning/sequence.ts): the links in a text, and which pairs can be linked.
import { describe, it, expect } from "vitest";
import { linksIn, sequencePatches } from "../src/planning/sequence";
import { readPlan } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const p = (n: string) => T + n + ".md";
const seq = (todos: NoteRec[], names: string[]) => sequencePatches(readPlan(todos, hub), names.map(p));

describe("linksIn", () => {
  it("the targets in order: bullets, aliases, headings, paths", () => {
    expect(linksIn("- [[A]]\n- [[B|second]]\n1. [[C#part]] and [[00 Planning/To-dos/D]]")).toEqual(["A", "B", "C", "00 Planning/To-dos/D"]);
  });
  it("the same one twice in a row counts once; no links gives none", () => {
    expect(linksIn("[[A]] [[A]] [[B]] [[A]]")).toEqual(["A", "B", "A"]);
    expect(linksIn("nothing here, [a](a.md)")).toEqual([]);
  });
});

describe("sequencePatches", () => {
  it("three to-dos: the second after the first, the third after the second", () => {
    const r = seq([td("A"), td("B"), td("C")], ["A", "B", "C"]);
    expect(r.links).toEqual([{ from: p("A"), to: p("B") }, { from: p("B"), to: p("C") }]);
    expect(r.skipped).toEqual([]);
  });
  it("a pair that is already linked is left out and the rest still goes ahead", () => {
    const r = seq([td("A"), td("B", { after: "[[A]]" }), td("C")], ["A", "B", "C"]);
    expect(r.links).toEqual([{ from: p("B"), to: p("C") }]);
    expect(r.skipped).toEqual([{ from: p("A"), to: p("B"), why: "already" }]);
  });
  it("a pair that would make a loop is left out", () => {
    const r = seq([td("A", { after: "[[B]]" }), td("B")], ["A", "B"]);
    expect(r.links).toEqual([]);
    expect(r.skipped).toEqual([{ from: p("A"), to: p("B"), why: "loop" }]);
  });
  it("a later pair that only loops through a link accepted earlier is left out", () => {
    // A -> B accepted; then B -> C accepted; then C -> A would close the circle
    const r = seq([td("A"), td("B"), td("C")], ["A", "B", "C", "A"]);
    expect(r.links).toEqual([{ from: p("A"), to: p("B") }, { from: p("B"), to: p("C") }]);
    expect(r.skipped).toEqual([{ from: p("C"), to: p("A"), why: "loop" }]);
  });
  it("fewer than two to-dos gives nothing", () => {
    expect(seq([td("A")], ["A"])).toEqual({ links: [], skipped: [] });
  });
});
