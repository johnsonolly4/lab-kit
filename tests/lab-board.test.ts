// The lab notes board model (src/lab/lab-board.ts) on the made-up notes in tests/fixtures/lab-board.ts.
import { describe, it, expect } from "vitest";
import { chemText, chipValues, completedRows, COMPLETED_START, isCompleted, labRow, nextSort, openTodosByNote, OTHER, pickColumn, progress, runningColumns, splitName, summary } from "../src/lab/lab-board";
import { LAB_NOTES, TODOS } from "./fixtures/lab-board";

const todos = openTodosByNote(TODOS);
const rows = LAB_NOTES.map(n => labRow({ ...n, todos: todos.get(n.name) ?? 0 }));
const row = (code: string) => rows.find(r => r.code === code)!;

describe("rows", () => {
  it("splits code and name at the first ' - '", () => {
    expect(splitName("ABC0014-A - RAFT - second try")).toEqual({ code: "ABC0014-A", title: "RAFT - second try" });
    expect(splitName("Scratch")).toEqual({ code: "Scratch", title: "" });
  });
  it("reads the card fields, only what the note has", () => {
    const r = row("ABC0005-A");
    expect(r).toMatchObject({ status: "Started", cls: "RAFT", start: "2026-10-01", chems: ["Styrene", "AIBN", "CPDB", "Toluene", "MMA"], boxes: 10, ticked: 7, todos: 2 });
    expect(row("ABC0003-A")).toMatchObject({ cls: "", start: "", chems: ["DCM"], todos: 0 });
    expect(row("ABC0007-A").chems).toEqual(["THF"]);   // one link, not a list
    expect(row("ABC0031-A").start).toBe("2026-11-03");   // a Date value
    expect(row("ABC0002-A").todos).toBe(1);   // linked by path
  });
  it("counts open to-dos only (done ones and to-dos with no experiment are left out)", () => {
    expect(Object.fromEntries(todos)).toEqual({ "ABC0005-A - Chain extension": 2, "ABC0002-A - Flow reactor calibration": 1 });
  });
  it("chemicals: three, then +N", () => {
    expect(chemText(row("ABC0005-A").chems)).toBe("Styrene, AIBN, CPDB +2");
    expect(chemText(["DCM"])).toBe("DCM");
  });
  it("progress only with check boxes", () => {
    expect(progress(row("ABC0005-A"))).toBe(70);
    expect(progress(row("ABC0007-A"))).toBeNull();
  });
});

describe("running board", () => {
  const cols = runningColumns(rows);
  it("three running columns, Other only for a Status of the user's own; completed notes are not on it", () => {
    expect(cols.map(c => [c.key, c.rows.map(r => r.code)])).toEqual([
      ["Planned", ["ABC0031-A", "ABC0002-A"]],
      ["Started", ["ABC0005-A", "ABC0003-A"]],
      ["Processing results", ["ABC0007-A"]],
      [OTHER, ["ABC0010-A"]],
    ]);
  });
  it("an ended note (closed_on only) counts as completed", () => {
    expect(isCompleted(row("ABC0008-A"))).toBe(true);
  });
  it("no Other column when every running note has a running Status", () => {
    expect(runningColumns(rows.filter(r => r.code !== "ABC0010-A")).map(c => c.key)).toEqual(["Planned", "Started", "Processing results"]);
  });
  it("the narrow pane keeps its column, else shows Started", () => {
    expect(pickColumn(cols, "Planned")).toBe("Planned");
    expect(pickColumn(cols, "Gone")).toBe("Started");
  });
});

describe("summary", () => {
  it("counts all, running, completed, and by status, class and result", () => {
    const s = Object.fromEntries(summary(rows).map(g => [g.title, Object.fromEntries(g.tiles)]));
    expect(s.Overview).toEqual({ All: 9, Running: 6, Completed: 3 });
    expect(s["By Exp. Class"]).toEqual({ RAFT: 4, Flow: 2, "in silico": 2, "(none)": 1 });
    expect(s["By result (completed only)"]).toEqual({ Worked: 1, Failed: 1, "(none)": 1 });
  });
});

describe("completed table", () => {
  const codes = (st = COMPLETED_START, body?: (p: string) => string | undefined) => completedRows(rows, st, body).map(r => r.code);
  it("Ended newest first by default", () => {
    expect(codes()).toEqual(["ABC0009-A", "ABC0001-A", "ABC0008-A"]);
  });
  it("filter chips from the values present", () => {
    expect(chipValues(rows, "cls")).toEqual(["Flow", "RAFT"]);
    expect(chipValues(rows, "result")).toEqual(["Failed", "Worked"]);
    expect(codes({ ...COMPLETED_START, cls: "RAFT" })).toEqual(["ABC0009-A", "ABC0001-A"]);
    expect(codes({ ...COMPLETED_START, cls: "RAFT", result: "Worked" })).toEqual(["ABC0001-A"]);
  });
  it("search: every word, any case, in shown fields or the note text", () => {
    expect(codes({ ...COMPLETED_START, q: "styrene WORKED" })).toEqual(["ABC0001-A"]);
    expect(codes({ ...COMPLETED_START, q: "gelled" })).toEqual(["ABC0009-A"]);
    expect(codes({ ...COMPLETED_START, q: "quokka" })).toEqual([]);
    expect(codes({ ...COMPLETED_START, q: "quokka" }, p => (p.includes("ABC0008") ? "the quokka run" : undefined))).toEqual(["ABC0008-A"]);
  });
  it("header click sorts and flips", () => {
    const byName = { ...COMPLETED_START, ...nextSort(COMPLETED_START, "name") };
    expect(byName.sortDir).toBe(1);
    expect(codes(byName)).toEqual(["ABC0001-A", "ABC0008-A", "ABC0009-A"]);
    expect(nextSort(byName, "name").sortDir).toBe(-1);
    expect(nextSort(byName, "closedOn")).toEqual({ sortKey: "closedOn", sortDir: -1 });
  });
});
