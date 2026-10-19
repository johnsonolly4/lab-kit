// The card map layout (src/planning/plan-map.ts): steps, places, arrows, unlinked, start step, chains.
import { describe, it, expect } from "vitest";
import { CARD_H, CARD_W, GAP_X, GAP_Y, PAD, chainOf, layoutPlan, mapGeometry, openSubs, setDone, subsLabel } from "../src/planning/plan-map";
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

describe("short arrows", () => {
  it("a card with nothing before it sits just before its earliest child", () => {
    // Late has a long chain before its child J; Lone has nothing before it and its only child is J
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("J", { after: ["[[C]]", "[[Lone]]"] }), td("Lone")]);
    expect(at(m)).toEqual(["A:0.0", "B:1.0", "C:2.0", "Lone:2.1", "J:3.0"]);
  });
  it("a source with a child in the next step stays at step 0; a source with children at different steps goes by the earliest", () => {
    const a = map([td("S"), td("T", { after: "[[S]]" })]);
    expect(at(a)).toEqual(["S:0.0", "T:1.0"]);
    const b = map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("S"), td("T1", { after: ["[[S]]", "[[C]]"] }), td("T2", { after: "[[S]]" })]);
    expect(b.cards.find(c => c.row.name === "S")!.step).toBe(0);   // T2 is at step 1
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
  it("ticks; unticks; an old card on day: Done loses day, keeps scheduled", () => {
    const a: Record<string, unknown> = { day: "Mon", done: false };
    setDone(a, true);
    expect(a).toEqual({ day: "Mon", done: true });
    setDone(a, false);
    expect(a).toEqual({ day: "Mon", done: false });
    const b: Record<string, unknown> = { day: "Done", done: true, scheduled: "2026-10-21" };
    setDone(b, false);
    expect(b).toEqual({ done: false, scheduled: "2026-10-21" });
  });
});

describe("subtasks on the map", () => {
  it("subtasks are not cards, arrows or Not linked rows", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("S", { sub: "[[B]]" }), td("Lone"), td("LoneSub", { sub: "[[Lone]]" })]);
    expect(m.cards.map(c => c.row.name)).toEqual(["A", "B"]);
    expect(m.arrows).toHaveLength(1);
    expect(m.unlinked.map(r => r.name)).toEqual(["Lone"]);
  });
  it("an after that points at a subtask counts as an after on its parent card: a dashed arrow `via` the subtask, no cycle", () => {
    const m = map([td("P"), td("S", { sub: "[[P]]" }), td("N", { after: "[[S]]" }), td("M", { after: "[[P]]" })]);
    expect(m.cyclic.size).toBe(0);
    expect(at(m)).toEqual(["P:0.0", "M:1.0", "N:1.1"]);
    expect(m.arrows).toEqual([{ from: T + "P.md", to: T + "M.md" }, { from: T + "P.md", to: T + "N.md", via: T + "S.md" }]);
    expect(m.unlinked).toEqual([]);
  });
  it("nesting a middle card keeps the chain: A, B, C with B nested under A leaves A and C joined", () => {
    const m = map([td("A"), td("B", { after: "[[A]]", sub: "[[A]]" }), td("C", { after: "[[B]]" })]);
    expect(at(m)).toEqual(["A:0.0", "C:1.0"]);
    expect(m.arrows).toEqual([{ from: T + "A.md", to: T + "C.md", via: T + "B.md" }]);
    expect(m.unlinked).toEqual([]);
  });
  it("a direct link wins over the same one through a subtask; a to-do never comes after itself through its own subtask; a link through a subtask of an unrelated card is kept", () => {
    const direct = map([td("P"), td("S", { sub: "[[P]]" }), td("N", { after: ["[[P]]", "[[S]]"] })]);
    expect(direct.arrows).toEqual([{ from: T + "P.md", to: T + "N.md" }]);
    const own = map([td("P", { after: "[[S]]" }), td("S", { sub: "[[P]]" }), td("Z")]);
    expect(own.arrows).toEqual([]);
    expect(own.cards).toEqual([]);
  });
  it("mapGeometry carries `via` onto the curve", () => {
    const m = map([td("A"), td("B", { sub: "[[A]]" }), td("C", { after: "[[B]]" })]);
    expect(mapGeometry(m).curves.map(c => c.via)).toEqual([T + "B.md"]);
  });
  it("openSubs lists the subtasks that are not done", () => {
    expect(openSubs({ subs: [{ path: "a", name: "A", done: true }, { path: "b", name: "B", done: false }] })).toEqual([{ path: "b", name: "B" }]);
    expect(openSubs({ subs: [] })).toEqual([]);
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
  it("an open subtask list pushes the rows below it down, so no list covers a card (3 parents of 4 subtasks)", () => {
    const m = map([td("R"), ...["A", "B", "C"].map(p => td(p, { after: "[[R]]" })), ...["A", "B", "C"].flatMap(p => [1, 2, 3, 4].map(i => td(p + i, { sub: `[[${p}]]` })))]);
    const rowOf = (c: { place: number }) => c.place;
    expect(new Set(m.cards.map(rowOf)).size).toBe(3);   // the three parents sit in three rows of one step (R beside A)
    const parents = m.cards.filter(c => c.path !== T + "R.md");
    const room = new Map(parents.map(c => [c.path, 4 * 26 + 12] as const));
    const g = mapGeometry(m, 0, "across", room), flat = mapGeometry(m);
    const ys = parents.sort((a, b) => a.place - b.place).map(c => g.pos.get(c.path)!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBe(CARD_H + GAP_Y + 4 * 26 + 12);   // list (margin 4 + 4 lines + padding) ends above the next card
    expect(g.height - flat.height).toBe(3 * (4 * 26 + 12));
  });
  it("the room is the most any card of a row needs; down moves the steps instead", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" })]);
    const [a, b] = ["A", "B"].map(n => T + n + ".md");
    const g = mapGeometry(m, 0, "down", new Map([[a, 60]]));
    expect(g.pos.get(b)!.y - g.pos.get(a)!.y).toBe(CARD_H + GAP_X + 60);
  });
});

describe("arrows routed around cards", () => {
  // A -> B -> C in one row, and A -> C skipping B: the straight line would run behind B
  const skip = () => map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: ["[[B]]", "[[A]]"] })]);
  const inside = (p: { x: number; y: number }, r: { x: number; y: number }) => p.x > r.x && p.x < r.x + CARD_W && p.y > r.y && p.y < r.y + CARD_H;
  it("a skip arrow behind a middle card is routed and never enters a card", () => {
    const g = mapGeometry(skip());
    const long = g.curves.find(c => c.from === T + "A.md" && c.to === T + "C.md")!;
    expect(long.routed).toBe(true);
    for (const c of g.pos.values()) expect(long.samples.some(s => inside(s, c))).toBe(false);
  });
  it("neighbouring-step arrows are not routed; the same arrows come out as before", () => {
    const g = mapGeometry(skip());
    expect(g.curves.filter(c => c.routed)).toHaveLength(1);
    expect(g.curves.find(c => c.from === T + "A.md" && c.to === T + "B.md")!.d.startsWith(`M${PAD + CARD_W} ${PAD + CARD_H / 2} C`)).toBe(true);
  });
  it("a skip arrow with a free straight line stays straight", () => {
    // A (row 0) -> C (row 1), with B in row 0 in between: the line from A's right edge down to C does not touch B
    const m = map([td("A"), td("X", { after: "[[A]]" }), td("B", { after: "[[X]]", order: 1 }), td("C", { after: ["[[A]]", "[[B]]"] }), td("Y", { after: "[[X]]", order: 2 })]);
    for (const c of mapGeometry(m).curves.filter(c => !c.routed)) expect(c.samples.length).toBe(25);
  });
  it("the lane is above the first row or below the last when that is nearest", () => {
    const g = mapGeometry(skip());
    const long = g.curves.find(c => c.routed)!;
    const ys = long.samples.map(s => s.y);
    // one row only: the lane is above (5px) or below (row bottom + 7px) the cards
    const below = PAD + CARD_H + GAP_Y / 2, above = PAD - GAP_Y / 2;
    expect(ys.some(y => Math.abs(y - below) < 0.5 || Math.abs(y - above) < 0.5)).toBe(true);
  });
});

describe("vertical layout", () => {
  const chain = () => map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" }), td("D", { after: "[[A]]" })]);
  it("steps go down and places go across; the canvas swaps its sides", () => {
    const g = mapGeometry(chain(), 0, "down");
    expect(g.pos.get(T + "A.md")).toEqual({ x: PAD, y: PAD });
    expect(g.pos.get(T + "B.md")).toEqual({ x: PAD, y: PAD + CARD_H + GAP_X });
    expect(g.pos.get(T + "D.md")).toEqual({ x: PAD + CARD_W + GAP_Y, y: PAD + CARD_H + GAP_X });
    expect(g.width).toBe(2 * PAD + 2 * CARD_W + GAP_Y);
    expect(g.height).toBe(2 * PAD + 3 * CARD_H + 2 * GAP_X);
  });
  it("arrows leave the bottom centre and enter the top centre", () => {
    const g = mapGeometry(chain(), 0, "down");
    expect(g.curves.find(c => c.from === T + "A.md" && c.to === T + "B.md")!.d.startsWith(`M${PAD + CARD_W / 2} ${PAD + CARD_H} C`)).toBe(true);
  });
  it("a skip arrow is routed down a lane between columns and never enters a card", () => {
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: ["[[B]]", "[[A]]"] })]);
    const g = mapGeometry(m, 0, "down");
    const long = g.curves.find(c => c.routed)!;
    expect(long).toBeTruthy();
    for (const c of g.pos.values()) expect(long.samples.some(s => s.x > c.x && s.x < c.x + CARD_W && s.y > c.y && s.y < c.y + CARD_H)).toBe(false);
  });
  it("the scroll is on the step axis only; across stays as it was", () => {
    const m = map([td("A", { done: true }), td("B", { after: "[[A]]" })]);
    expect(mapGeometry(m, 0, "down")).toMatchObject({ scrollLeft: 0, scrollTop: CARD_H + GAP_X });
    expect(mapGeometry(m)).toMatchObject({ scrollLeft: CARD_W + GAP_X, scrollTop: 0 });
  });
});

describe("routed arrows that share a gap", () => {
  it("one leaving and one arriving in the same gap use different places, and a shared lane gets separate lines", () => {
    // A → B → C → D → E; A → C and C → E are both routed over a card; B, D sit in one row so the lane is shared
    const m = map([td("A"), td("B", { after: "[[A]]" }), td("C", { after: ["[[B]]", "[[A]]"] }), td("D", { after: "[[C]]" }), td("E", { after: ["[[D]]", "[[C]]"] })]);
    const routed = mapGeometry(m).curves.filter(c => c.routed);
    expect(routed.length).toBe(2);
    const laneY = (c: (typeof routed)[number]): number => Math.min(...c.samples.map(s => s.y));
    expect(laneY(routed[0])).not.toBe(laneY(routed[1]));
    const xs = (c: (typeof routed)[number]): number[] => c.samples.map(s => s.x);
    // the first arrow arrives in the gap before C; the second leaves from the gap after C: not the same x
    const lastOfFirst = Math.max(...xs(routed[0])), firstOfSecond = Math.min(...xs(routed[1]));
    expect(lastOfFirst).toBeLessThan(CARD_W * 3);   // arrives in a gap, not on the card
    expect(firstOfSecond).toBeGreaterThan(lastOfFirst - 1);
  });
});

describe("zoom arithmetic", () => {
  it("clamps and rounds to a tenth", async () => {
    const { clampZoom, ZOOM_MIN, ZOOM_MAX } = await import("../src/planning/plan-map");
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(0.8 - 0.1)).toBe(0.7);
    expect(clampZoom(NaN)).toBe(1);
  });
  it("fits to the width, never above 1 or below the minimum", async () => {
    const { fitZoom } = await import("../src/planning/plan-map");
    expect(fitZoom(500, 1000)).toBe(0.5);
    expect(fitZoom(2000, 1000)).toBe(1);
    expect(fitZoom(100, 1000)).toBe(0.4);
    expect(fitZoom(0, 1000)).toBe(1);
  });
});

describe("layoutPlan with memory: cards stay where they were", () => {
  const todos = [td("A"), td("B"), td("C", { after: "[[A]]" }), td("D", { after: "[[B]]" }), td("E", { after: ["[[C]]", "[[D]]"] }), td("F", { after: "[[C]]" })];
  const remember = (m: ReturnType<typeof layoutPlan>) => new Map(m.cards.map(c => [c.path, { step: c.step, place: c.place }]));
  const col = (m: ReturnType<typeof layoutPlan>, step: number) => m.cards.filter(c => c.step === step).map(c => c.row.name);
  it("without memory the first layout is the automatic one", () => {
    const m = layoutPlan(readPlan(todos, hub));
    expect(col(m, 0)).toEqual(["A", "B"]);
    expect(col(m, 1)).toEqual(["C", "D"]);
    expect(col(m, 2)).toEqual(["F", "E"]);   // F is level with C (row 0), E sits between its two parents
  });
  it("adding a to-do does not reorder the others in a column", () => {
    const first = layoutPlan(readPlan(todos, hub));
    const next = layoutPlan(readPlan([...todos, td("G", { after: "[[B]]" })], hub), remember(first));   // a new leaf after B, next to D
    expect(col(next, 1).filter(n => n !== "G")).toEqual(col(first, 1));
    expect(col(next, 2)).toEqual(col(first, 2));
    expect(col(next, 1)).toContain("G");
  });
  it("a new card goes next to its parent; one with no parent on the map goes to the bottom of its column", () => {
    const mem = remember(layoutPlan(readPlan(todos, hub)));
    const next = layoutPlan(readPlan([...todos, td("G", { after: "[[A]]" }), td("H"), td("I", { after: "[[H]]" })], hub), mem);
    const step1 = col(next, 1);
    expect(step1.indexOf("G")).toBeLessThan(step1.indexOf("D"));   // after A: up with C, above D's row
    expect(col(next, 0).at(-1)).toBe("H");
  });
});

describe("short arrows come before fewer rows", () => {
  const rows = (m: ReturnType<typeof layoutPlan>) => Object.fromEntries(m.cards.map(c => [c.row.name, c.place]));
  it("a card sits level with its parent when that row is free, even if that leaves an empty row above it", () => {
    // P is on row 0, Q on row 1; X comes after Q only: X goes level with Q (row 1) and the arrow is straight
    const r = rows(map([td("P"), td("Q"), td("Y", { after: "[[P]]" }), td("X", { after: "[[Q]]" })]));
    expect(r).toEqual({ P: 0, Q: 1, Y: 0, X: 1 });
  });
  it("a card with two parents wants the average row; when another card already has that row it goes just below", () => {
    const r = rows(map([td("P"), td("Q"), td("R"), td("J", { after: ["[[P]]", "[[R]]"] }), td("K", { after: "[[Q]]" })]));
    expect(r.K).toBe(1);   // level with Q (row 1): a straight arrow
    expect(r.J).toBe(2);   // wanted row 1 (between P on row 0 and R on row 2), K has it, so just below
  });
  it("a card with two parents sits at the average row when it is free", () => {
    const r = rows(map([td("P"), td("Q"), td("R"), td("J", { after: ["[[P]]", "[[R]]"] }), td("K", { after: "[[Q]]" }), td("L", { after: "[[Q]]" })]));
    expect(r.J).toBeGreaterThanOrEqual(1);
    expect(r.K).toBeGreaterThanOrEqual(r.L - 1);   // two children of Q stay together
  });
  it("two children of one parent share the rows below it without overlapping", () => {
    const r = rows(map([td("P"), td("A", { after: "[[P]]" }), td("B", { after: "[[P]]" })]));
    expect(r).toEqual({ P: 0, A: 0, B: 1 });
  });
});
