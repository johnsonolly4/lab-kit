// The card map layout (src/planning/plan-map.ts): steps, places, arrows, unlinked, start step, chains.
import { describe, it, expect } from "vitest";
import { CARD_H, CARD_W, GAP_X, GAP_Y, PAD, chainOf, layoutPlan, mapGeometry, setDone, subsLabel } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const map = (todos: NoteRec[]) => layoutPlan(readPlan(todos, hub));
const at = (m: ReturnType<typeof map>) => m.cards.map(c => `${c.row.name}:${c.step}.${c.place}`);
const nm = (s: Set<string>) => [...s].map(p => p.slice(T.length, -3)).sort();

describe("layoutPlan", () => {
  it("a chain: one step each, an arrow between neighbours", () => {
    const m = map([td("C", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("A")]);
    expect(at(m)).toEqual(["A:0.0", "B:1.0", "C:2.0"]);
    expect(m.arrows).toEqual([{ from: T + "A.md", to: T + "B.md" }, { from: T + "B.md", to: T + "C.md" }]);
    expect(m.unlinked).toEqual([]);
    expect(m.cyclic.size).toBe(0);
  });
  it("a join: the child is one step after its furthest parent", () => {
    const m = map([td("J", { after: ["[[P1]]", "[[Q]]"] }), td("P1"), td("P2", { after: "[[P1]]" }), td("Q", { after: "[[P2]]" })]);
    expect(at(m)).toEqual(["P1:0.0", "P2:1.0", "Q:2.0", "J:3.0"]);
    expect(m.arrows).toHaveLength(4);
  });
  it("two separate chains share steps; places follow plan order", () => {
    const m = map([td("A1"), td("A2", { after: "[[A1]]" }), td("B1"), td("B2", { after: "[[B1]]" })]);
    expect(at(m)).toEqual(["A1:0.0", "B1:0.1", "A2:1.0", "B2:1.1"]);
  });
  it("a place sits near its parent: children of the lower parent go lower", () => {
    const m = map([td("A", { order: 1 }), td("B", { order: 2 }), td("CB", { after: "[[B]]", order: 1 }), td("CA", { after: "[[A]]", order: 2 }), td("X", { after: ["[[A]]", "[[B]]"] })]);
    expect(at(m)).toEqual(["A:0.0", "B:0.1", "CA:1.0", "X:1.1", "CB:1.2"]);
  });
  it("a cycle: every to-do kept, the members flagged, no endless loop", () => {
    const m = map([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("C")]);
    expect(m.cards.map(c => c.row.name).sort()).toEqual(["A", "B"]);
    expect(m.unlinked.map(r => r.name)).toEqual(["C"]);
    expect(nm(m.cyclic)).toEqual(["A", "B"]);
  });
  it("unlinked to-dos are off the map and listed in plan order; nothing linked gives an empty map", () => {
    const m = map([td("Z", { order: 2 }), td("Y", { order: 1 })]);
    expect(m.cards).toEqual([]);
    expect(m.arrows).toEqual([]);
    expect(m.unlinked.map(r => r.name)).toEqual(["Y", "Z"]);
    expect(m.startStep).toBe(0);
    const n = map([td("A"), td("B", { after: "[[A]]" }), td("Lone")]);
    expect(n.unlinked.map(r => r.name)).toEqual(["Lone"]);
  });
  it("start step: the first ready open to-do's step; the last step when all are finished", () => {
    const chain = (flags: boolean[]) => map(flags.map((d, i) => td("T" + i, { ...(i ? { after: `[[T${i - 1}]]` } : {}), done: d })));
    expect(chain([true, true, false, false]).startStep).toBe(2);
    expect(chain([false, false, false]).startStep).toBe(0);
    expect(chain([true, true, true]).startStep).toBe(2);
  });
});

describe("chainOf", () => {
  const plan = (todos: NoteRec[]) => readPlan(todos, hub);
  it("a chain: everything before and after, not itself", () => {
    const p = plan([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("D", { after: "[[C]]" })]);
    expect(nm(chainOf(p, T + "B.md"))).toEqual(["A", "C", "D"]);
  });
  it("a join: both parents and the child; a sibling branch is not in it", () => {
    const p = plan([td("P1"), td("P2"), td("J", { after: ["[[P1]]", "[[P2]]"] }), td("Other", { after: "[[P2]]" })]);
    expect(nm(chainOf(p, T + "P1.md"))).toEqual(["J"]);
    expect(nm(chainOf(p, T + "J.md"))).toEqual(["P1", "P2"]);
  });
  it("a cycle: its members once, itself included, no endless loop", () => {
    const p = plan([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" })]);
    expect(nm(chainOf(p, T + "A.md"))).toEqual(["A", "B"]);
  });
});

describe("mapGeometry", () => {
  it("steps go right, places go down; the canvas fits them", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[A]]" })]);
    const g = mapGeometry(m);
    expect(g.pos.get(T + "A.md")).toEqual({ x: PAD, y: PAD });
    expect(g.pos.get(T + "B.md")).toEqual({ x: PAD + CARD_W + GAP_X, y: PAD });
    expect(g.pos.get(T + "C.md")).toEqual({ x: PAD + CARD_W + GAP_X, y: PAD + CARD_H + GAP_Y });
    expect(g.width).toBe(2 * PAD + 2 * CARD_W + GAP_X);
    expect(g.height).toBe(2 * PAD + 2 * CARD_H + GAP_Y);
  });
  it("one curve per arrow, from the first card's right edge to the second's left edge", () => {
    const g = mapGeometry(map([td("A"), td("B", { after: "[[A]]" })]));
    expect(g.curves).toHaveLength(1);
    expect(g.curves[0]).toMatchObject({ from: T + "A.md", to: T + "B.md" });
    expect(g.curves[0].d.startsWith(`M${PAD + CARD_W} ${PAD + CARD_H / 2} C`)).toBe(true);
    expect(g.curves[0].d.endsWith(` ${PAD + CARD_W + GAP_X} ${PAD + CARD_H / 2}`)).toBe(true);
  });
  it("scrolls so the start step is at the left edge; nothing for an empty map", () => {
    const chain = map([td("A", { done: true }), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" })]);
    expect(mapGeometry(chain).scrollLeft).toBe(1 * (CARD_W + GAP_X));
    const none = mapGeometry(map([td("Lone")]));
    expect(none).toMatchObject({ width: 0, height: 0, scrollLeft: 0 });
    expect(none.curves).toEqual([]);
  });
});

describe("setDone", () => {
  it("ticks; unticks; a to-do on the Done column goes back to Backlog", () => {
    const a: Record<string, unknown> = { day: "Mon", done: false };
    setDone(a, true);
    expect(a).toEqual({ day: "Mon", done: true });
    setDone(a, false);
    expect(a).toEqual({ day: "Mon", done: false });
    const b: Record<string, unknown> = { day: "Done", done: true };
    setDone(b, false);
    expect(b).toEqual({ day: "Backlog", done: false });
  });
});

describe("subtasks on the map", () => {
  it("subtasks are not cards, arrows or Not linked rows", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("S", { sub: "[[B]]" }), td("Lone"), td("LoneSub", { sub: "[[Lone]]" })]);
    expect(m.cards.map(c => c.row.name)).toEqual(["A", "B"]);
    expect(m.arrows).toHaveLength(1);
    expect(m.unlinked.map(r => r.name)).toEqual(["Lone"]);
  });
  it("an after that points at a subtask is dropped from the map and does not flag a cycle", () => {
    const m = map([td("P"), td("S", { sub: "[[P]]" }), td("N", { after: "[[S]]" }), td("M", { after: "[[P]]" })]);
    expect(m.cyclic.size).toBe(0);
    expect(m.cards.map(c => c.row.name)).toEqual(["P", "M"]);
  });
  it("subsLabel counts and says when all are done", () => {
    expect(subsLabel({ subs: [{ done: true }, { done: false }, { done: false }] })).toEqual({ text: "1/3", allDone: false });
    expect(subsLabel({ subs: [{ done: true }, { done: true }] })).toEqual({ text: "2/2", allDone: true });
    expect(subsLabel({ subs: [] })).toEqual({ text: "", allDone: false });
  });
  it("room under the map for an open list", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" })]);
    expect(mapGeometry(m, 50).height - mapGeometry(m).height).toBe(50);
  });
});
