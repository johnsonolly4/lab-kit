// Quick capture: highlighted text → a title and the fields its @ % ! marks set (src/planning/quick-todo.ts).
import { describe, it, expect } from "vitest";
import { parseQuickTodo } from "../src/planning/quick-todo";

const NOW = new Date(2026, 9, 7, 15, 30);   // Wed 2026-10-07
const projects = ["Polymer A", "Polymer", "Flow reactor", "Thesis"];
const q = (t: string) => parseQuickTodo(t, projects, NOW);

describe("parseQuickTodo", () => {
  it("the user's two examples (2026-10-14): spaces after the marks, a word priority, a leading list dash", () => {
    const pr = ["plan map example", "feature test round 2"];
    const now = new Date(2026, 9, 14);   // Wed
    expect(parseQuickTodo("- Testing how the planning kit works + plan map example ! high % next week", pr, now))
      .toEqual({ title: "Testing how the planning kit works", project: "plan map example", priority: 1, due: "2026-10-19" });
    expect(parseQuickTodo("Testing how the project selection works +feature test round 2 !1 %fri", pr, now))
      .toEqual({ title: "Testing how the project selection works", project: "feature test round 2", priority: 1, due: "2026-10-16" });
  });
  it("@ is not a mark (ZotLit uses it for citations)", () => {
    expect(q("cite @Thesis")).toEqual({ title: "cite @Thesis" });
  });
  it("priority words, any case; a list marker is dropped, a + bullet is not one", () => {
    expect(q("a !Medium")).toEqual({ title: "a", priority: 2 });
    expect(q("a !low.")).toEqual({ title: "a", priority: 3 });
    expect(q("- [ ] a !high")).toEqual({ title: "a", priority: 1 });
    expect(q("1. a")).toEqual({ title: "a" });
    expect(q("+ Thesis a")).toEqual({ title: "a", project: "Thesis" });
  });
  it("text without marks is just a title", () => {
    expect(q("  Book   NMR time ")).toEqual({ title: "Book NMR time" });
  });
  it("+project, %date and !priority anywhere in the text", () => {
    expect(q("Book NMR time +Thesis %fri !1")).toEqual({ title: "Book NMR time", project: "Thesis", due: "2026-10-09", priority: 1 });
    expect(q("%fri +Thesis !2 Book NMR time")).toEqual({ title: "Book NMR time", project: "Thesis", due: "2026-10-09", priority: 2 });
    expect(q("Book +Thesis NMR time")).toEqual({ title: "Book NMR time", project: "Thesis" });
  });
  it("a project name with spaces, longest name first, any case; quotes work too", () => {
    expect(q("order solvent +flow reactor")).toEqual({ title: "order solvent", project: "Flow reactor" });
    expect(q("order solvent +Polymer A today").project).toBe("Polymer A");
    expect(q("order solvent +Polymer B").project).toBe("Polymer");   // "Polymer" matches, "B" stays
    expect(q('x +"Flow reactor" y')).toEqual({ title: "x y", project: "Flow reactor" });
  });
  it("an unknown project, and a plus inside a word, stay in the title", () => {
    expect(q("ask +Nobody about it")).toEqual({ title: "ask +Nobody about it", projectGuess: "Nobody" });
    expect(q("mail a+Thesis.org")).toEqual({ title: "mail a+Thesis.org" });
    expect(q("a +Thesisx b").project).toBeUndefined();
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
    expect(q("a +Thesis +Polymer")).toEqual({ title: "a +Polymer", project: "Thesis" });
  });
  it("marks only: the title is empty (the caller decides)", () => {
    expect(q("+Thesis !1").title).toBe("");
  });
});

import { readFileSync } from "node:fs";
import { isBlankBoardNote } from "../src/planning/todo";

describe("isBlankBoardNote (Esc in the board's New trashes the empty note)", () => {
  it("empty, only a day, or only blank lines count as blank", () => {
    expect(isBlankBoardNote("")).toBe(true);
    expect(isBlankBoardNote("---\nday: Wed\n---\n")).toBe(true);
    expect(isBlankBoardNote("---\r\nday: Backlog\r\n---\r\n\r\n")).toBe(true);
    expect(isBlankBoardNote("---\nday: Wed\n---\n\n   \n")).toBe(true);
  });
  it("any text, or any other property, is kept", () => {
    expect(isBlankBoardNote("---\nday: Wed\n---\nbuy tubing\n")).toBe(false);
    expect(isBlankBoardNote("---\nday: Wed\nproject: \"[[A]]\"\n---\n")).toBe(false);
    expect(isBlankBoardNote("just text")).toBe(false);
    expect(isBlankBoardNote("---\nkind: todo\n---\n")).toBe(false);
  });
  it("the template carries the same rule and only trashes inside the to-dos folder", () => {
    const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
    expect(tpl).toContain("fm.split(/\\r?\\n/).every(l => !l.trim() || /^day:/.test(l.trim()))");
    expect(tpl).toContain("f.path.startsWith(`${folder}/`) && rest.trim() === \"\"");
    expect(tpl).toContain("app.fileManager.trashFile(f)");
  });
  it("near match (2026-10-14): a run of words that starts exactly one name", () => {
    const pr = ["Plan map example", "Plan b", "Flow reactor"];
    const r = (t: string) => parseQuickTodo(t, pr, NOW);
    expect(r("Book NMR +plan map %fri")).toEqual({ title: "Book NMR", project: "Plan map example", due: "2026-10-09" });
    expect(r("+flow Book NMR")).toEqual({ title: "Book NMR", project: "Flow reactor" });
    expect(r("Book +plan map example now")).toEqual({ title: "Book now", project: "Plan map example" });
    expect(r('Book +"plan map"')).toEqual({ title: "Book", project: "Plan map example" });
    expect(r("Book +plan map Book")).toEqual({ title: "Book Book", project: "Plan map example" });
  });
  it("an ambiguous or unknown name stays in the title and is the guess for the Project search", () => {
    const pr = ["Plan map example", "Plan b"];
    expect(parseQuickTodo("Book +plan now", pr, NOW)).toEqual({ title: "Book +plan now", projectGuess: "plan" });
    expect(parseQuickTodo("Book +Nobody", pr, NOW)).toEqual({ title: "Book +Nobody", projectGuess: "Nobody" });
    expect(parseQuickTodo('Book +"No body"', pr, NOW)).toEqual({ title: 'Book +"No body"', projectGuess: "No body" });
    expect(parseQuickTodo("Book + ", pr, NOW).projectGuess).toBeUndefined();
  });
});
