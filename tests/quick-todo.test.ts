// Quick capture: highlighted text → a title and the fields its @ % ! marks set (src/planning/quick-todo.ts).
import { describe, it, expect } from "vitest";
import { parseQuickTodo } from "../src/planning/quick-todo";

const NOW = new Date(2026, 9, 7, 15, 30);   // Wed 2026-10-07
const projects = ["Polymer A", "Polymer", "Flow reactor", "Thesis"];
const q = (t: string) => parseQuickTodo(t, projects, NOW);

describe("parseQuickTodo", () => {
  it("text without marks is just a title", () => {
    expect(q("  Book   NMR time ")).toEqual({ title: "Book NMR time" });
  });
  it("@project, %date and !priority anywhere in the text", () => {
    expect(q("Book NMR time @Thesis %fri !1")).toEqual({ title: "Book NMR time", project: "Thesis", due: "2026-10-09", priority: 1 });
    expect(q("%fri @Thesis !2 Book NMR time")).toEqual({ title: "Book NMR time", project: "Thesis", due: "2026-10-09", priority: 2 });
    expect(q("Book @Thesis NMR time")).toEqual({ title: "Book NMR time", project: "Thesis" });
  });
  it("a project name with spaces, longest name first, any case; quotes work too", () => {
    expect(q("order solvent @flow reactor")).toEqual({ title: "order solvent", project: "Flow reactor" });
    expect(q("order solvent @Polymer A today").project).toBe("Polymer A");
    expect(q("order solvent @Polymer B").project).toBe("Polymer");   // "Polymer" matches, "B" stays
    expect(q('x @"Flow reactor" y')).toEqual({ title: "x y", project: "Flow reactor" });
  });
  it("an unknown project, and an @ inside a word (an email), stay in the title", () => {
    expect(q("ask @Nobody about it")).toEqual({ title: "ask @Nobody about it" });
    expect(q("mail me@Thesis.org")).toEqual({ title: "mail me@Thesis.org" });
    expect(q("a @Thesisx b").project).toBeUndefined();
  });
  it("dates after % take one to three words: the longest run that reads", () => {
    expect(q("call %15 nov about it")).toEqual({ title: "call about it", due: "2026-11-15" });
    expect(q("call %in 3 days")).toEqual({ title: "call", due: "2026-10-10" });
    expect(q("call %next mon ok")).toEqual({ title: "call ok", due: "2026-10-12" });
    expect(q("call %3/11.")).toEqual({ title: "call", due: "2026-11-03" });
    expect(q('call %"next week" ok')).toEqual({ title: "call ok", due: "2026-10-12" });
    expect(q("call %fri book").title).toBe("call book");
  });
  it("a % that is not a date stays in the title; 50% is not a mark", () => {
    expect(q("call %soon")).toEqual({ title: "call %soon" });
    expect(q("yield is 50% of target")).toEqual({ title: "yield is 50% of target" });
  });
  it("priority is 1, 2 or 3 only", () => {
    expect(q("a !3")).toEqual({ title: "a", priority: 3 });
    expect(q("a !4")).toEqual({ title: "a !4" });
    expect(q("a !12")).toEqual({ title: "a !12" });
    expect(q("wow!1")).toEqual({ title: "wow!1" });
  });
  it("only the first mark of each kind counts; the next stays in the title", () => {
    expect(q("a @Thesis @Polymer")).toEqual({ title: "a @Polymer", project: "Thesis" });
  });
  it("marks only: the title is empty (the caller decides)", () => {
    expect(q("@Thesis !1").title).toBe("");
  });
});
