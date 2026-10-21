// The open-work model of a big project (src/planning/plan-open.ts): open chips in steps, loose row, counts. Known answers: docs/plans/plan-map-export.md "Big projects".
import { describe, it, expect } from "vitest";
import { readPlan } from "../src/planning/plan";
import { SECOND_LINE_MAX, openModel } from "../src/planning/plan-open";
import type { NoteRec } from "../src/planning/lists";
import { BIG_HUB, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const lab = (name: string, Status: string): NoteRec => note(`05 Lab/${name}.md`, { Status });
const model = (todos: NoteRec[], today = "2026-10-20", labs?: NoteRec[]) => openModel(readPlan(todos, hub, labs), today);
const chipOf = (m: ReturnType<typeof openModel>, name: string) => [...m.chips, ...m.loose].find(c => c.name === name);

const big = openModel(readPlan(BIG_TODOS, BIG_HUB), BIG_TODAY);

describe("openModel: the made-up 59 to-do project (known answers)", () => {
  it("24 open, 21 linked in 9 steps by 6 places, 3 loose", () => {
    expect(big.counts.open).toBe(24);
    expect(big.chips).toHaveLength(21);
    expect(big.counts.steps).toBe(9);
    expect(big.counts.places).toBe(6);   // columns: places 0-5 are used (step 1 has 5 chips in places 1-5)
    expect(Math.max(...big.chips.map(c => c.place))).toBe(5);
    expect(big.loose).toHaveLength(3);
  });
  it("late 2, waiting 2, can start 5, later 15", () => {
    const { late, waiting, canStart, later } = big.counts;
    expect([late, waiting, canStart, later]).toEqual([2, 2, 5, 15]);
  });
  it("35 of 59 done", () => {
    expect(big.counts.done).toBe(35);
    expect(big.counts.total).toBe(59);
  });
  it("late and waiting shows as late", () => expect(chipOf(big, "Book GPC time for diblocks")?.status).toBe("late"));
  it("drawn + counted = open, and the statuses add up to open", () => {
    const { open, drawn, late, waiting, canStart, later } = big.counts;
    expect(big.chips.length + big.loose.length).toBe(drawn);
    expect(drawn + (open - drawn)).toBe(open);
    expect(drawn).toBe(open);
    expect(late + waiting + canStart + later).toBe(open);
  });
  it("no subtask becomes a chip, and no finished to-do", () => {
    const subs = new Set(readPlan(BIG_TODOS, BIG_HUB).rows.filter(r => r.parent).map(r => r.path));
    const done = new Set(readPlan(BIG_TODOS, BIG_HUB).rows.filter(r => r.done).map(r => r.path));
    for (const c of [...big.chips, ...big.loose]) { expect(subs.has(c.path)).toBe(false); expect(done.has(c.path)).toBe(false); }
  });
  it("a finished blocker never makes a chip later: Run kinetics at 70 C can start", () => expect(chipOf(big, "Run kinetics at 70 C")?.status).toBe("ready"));
  it("arrows join chips only", () => {
    const paths = new Set(big.chips.map(c => c.path));
    for (const a of big.arrows) { expect(paths.has(a.from)).toBe(true); expect(paths.has(a.to)).toBe(true); }
  });
});

describe("openModel: rules", () => {
  it("a to-do whose only blocker is finished can start", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[B]]"] })]);
    expect(chipOf(m, "B")?.status).toBe("ready");
    expect(chipOf(m, "C")?.status).toBe("later");
  });
  it("steps count open work: B and C are steps 0 and 1, A is not drawn", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[B]]"] })]);
    expect(m.chips.map(c => [c.name, c.step])).toEqual([["B", 0], ["C", 1]]);
    expect(chipOf(m, "A")).toBeUndefined();
  });
  it("a to-do linked only to finished work is loose", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] })]);
    expect(m.chips).toHaveLength(0);
    expect(m.loose.map(c => c.name)).toEqual(["B"]);
  });
  it("late wins over waiting", () => expect(chipOf(model([td("A", { due: "2026-10-15", waiting: "facility" })]), "A")?.status).toBe("late"));
  it("loose sorted by urgency, then name", () => {
    const m = model([td("Zed"), td("Late", { due: "2026-10-01" }), td("Wait", { waiting: "x" }), td("Alpha")]);
    expect(m.loose.map(c => c.name)).toEqual(["Late", "Wait", "Alpha", "Zed"]);
  });
  it("subtasks hang under their parent, never as chips; a link through a subtask joins the parents", () => {
    const m = model([td("P"), td("S", { sub: "[[P]]" }), td("Q", { after: ["[[S]]"] })]);
    expect(m.chips.map(c => c.name)).toEqual(["P", "Q"]);
    expect(chipOf(m, "P")?.subs.map(s => s.name)).toEqual(["S"]);
    expect(m.arrows).toEqual([{ from: T + "P.md", to: T + "Q.md", via: T + "S.md" }]);
    expect(m.counts.open).toBe(2);
  });
  it("second line only on late, waiting and can-start chips, cut with …", () => {
    const labs = [lab("ABC0014", "Started"), lab("ABC0015-A long name", "Processing results")];
    const m = model([
      td("A", { experiment: "[[ABC0014]]" }),
      td("B", { experiment: "[[ABC0014]]", after: ["[[A]]"] }),
      td("C", { experiment: "[[ABC0015-A long name]]", due: "2026-10-01" }),
      td("D"),
    ], "2026-10-20", labs);
    expect(chipOf(m, "A")?.line).toBe("ABC0014 · Started");
    expect(chipOf(m, "B")?.line).toBe("");
    const c = chipOf(m, "C")!.line;
    expect(c.length).toBe(SECOND_LINE_MAX);
    expect(c.endsWith("…")).toBe(true);
    expect(chipOf(m, "D")?.line).toBe("");
  });
  it("an empty plan gives zero counts", () => {
    const m = model([]);
    expect(m.counts).toMatchObject({ open: 0, drawn: 0, steps: 0, places: 0, done: 0, total: 0 });
  });
});
