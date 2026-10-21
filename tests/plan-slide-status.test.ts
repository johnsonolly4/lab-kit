// Status marks, header, progress and key on the slide picture (src/planning/plan-slide.ts): late, waiting, "after X", due soon, "as of", "N of M done".
import { describe, it, expect } from "vitest";
import { layoutPlan } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import { MIN_READABLE, daysUntil, openBefore, slideModel, slideSvg, statusLines, statusOf } from "../src/planning/plan-slide";
import type { NoteRec } from "../src/planning/lists";
import { RAFT_HUB, RAFT_TODAY, RAFT_TODOS } from "./fixtures/plan-raft";
import { BIG_HUB, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const rowsOf = (todos: NoteRec[]) => readPlan(todos, hub).rows;
const row = (todos: NoteRec[], name: string) => rowsOf(todos).find(r => r.name === name)!;
const count = (s: string, part: string): number => s.split(part).length - 1;
const LATE = "#b3124f", WAIT = "#c77700";

const raft = readPlan(RAFT_TODOS, RAFT_HUB);
const raftRow = (name: string) => raft.rows.find(r => r.name === name)!;
const raftLines = (name: string) => statusLines(raftRow(name), raft.rows, RAFT_TODAY).map(l => l.text);

describe("PlanRow.waiting", () => {
  it("holds the trimmed waiting text, empty when none", () => {
    const todos = [td("A", { waiting: "  panel decision " }), td("B")];
    expect(row(todos, "A").waiting).toBe("panel decision");
    expect(row(todos, "B").waiting).toBe("");
  });
});

describe("statusOf", () => {
  const S = (todos: NoteRec[], name: string, today?: string) => statusOf(row(todos, name), today);
  it("open with a past due date is late; done with a past due date is not", () => {
    const todos = [td("A", { due: "2026-10-15" }), td("B", { due: "2026-10-15", done: true })];
    expect(S(todos, "A", "2026-10-20")).toBe("late");
    expect(S(todos, "B", "2026-10-20")).toBe("done");
  });
  it("due today is not late", () => expect(S([td("A", { due: "2026-10-20" })], "A", "2026-10-20")).toBe("ready"));
  it("no today: nothing is late", () => expect(S([td("A", { due: "2000-01-01" })], "A")).toBe("ready"));
  it("waiting shows when open; late wins over waiting", () => {
    const todos = [td("A", { waiting: "x" }), td("B", { waiting: "x", due: "2026-10-01" }), td("C", { waiting: "x", done: true })];
    expect(S(todos, "A", "2026-10-20")).toBe("waiting");
    expect(S(todos, "B", "2026-10-20")).toBe("late");
    expect(S(todos, "C", "2026-10-20")).toBe("done");
  });
  it("a to-do after an open one is blocked; after a finished one it can start", () => {
    const todos = [td("A"), td("B", { after: "[[A]]" }), td("C", { done: true }), td("D", { after: "[[C]]" })];
    expect(S(todos, "B", "2026-10-20")).toBe("blocked");
    expect(S(todos, "D", "2026-10-20")).toBe("ready");
  });
  it("known answers on the made-up 59 to-do project: 35 done, 2 late, 2 waiting, 5 can start, 15 wait for an earlier step", () => {
    const top = readPlan(BIG_TODOS, BIG_HUB).rows.filter(r => r.parent === null);
    const n: Record<string, number> = {};
    for (const r of top) n[statusOf(r, BIG_TODAY)] = (n[statusOf(r, BIG_TODAY)] ?? 0) + 1;
    expect(top).toHaveLength(59);
    expect(n).toEqual({ done: 35, late: 2, waiting: 2, ready: 5, blocked: 15 });
    expect(statusOf(top.find(r => r.name === "Book GPC time for diblocks")!, BIG_TODAY)).toBe("late");   // late and waiting
  });
  it("a finished blocker never marks anything blocked, even when the picture shows fewer to-dos", () => {
    const m = slideModel(layoutPlan(readPlan(BIG_TODOS, BIG_HUB)), { kind: "compact", ahead: 2 });
    for (const c of m.map.cards) expect(statusOf(c.row, BIG_TODAY) === "blocked", c.row.name).toBe(c.row.afterPaths.some(p => !m.all.find(r => r.path === p)!.done) || c.row.blocked);
    const diblock = m.all.find(r => r.name === "Synthesise macro-CTA 1")!;
    expect(diblock.done).toBe(true);
    expect(m.all.find(r => r.name === "Chain extend with monomer B")!.blocked).toBe(false);
  });
});

describe("daysUntil", () => {
  it("counts whole days and gives null for unreadable dates", () => {
    expect(daysUntil("2026-10-23", "2026-10-20")).toBe(3);
    expect(daysUntil("2026-10-15", "2026-10-20")).toBe(-5);
    expect(daysUntil("2026-11-01", "2026-10-30")).toBe(2);
    expect(daysUntil("", "2026-10-20")).toBeNull();
    expect(daysUntil("2026-10-20", undefined)).toBeNull();
  });
});

describe("statusLines on the made-up RAFT project (today 2026-10-20)", () => {
  it("Book GPC time is late and waiting", () => expect(raftLines("Book GPC time")).toEqual(["late: due 15 Oct", "waiting: facility reply"]));
  it("Run RAFT screen can start, due in 3 days", () => {
    expect(statusOf(raftRow("Run RAFT screen"), RAFT_TODAY)).toBe("ready");
    expect(raftLines("Run RAFT screen")).toEqual(["due 23 Oct (in 3 d)"]);
    expect(statusLines(raftRow("Run RAFT screen"), raft.rows, RAFT_TODAY)[0].tone).toBe("soon");
    expect(raftRow("Run RAFT screen").subs.filter(s => s.done)).toHaveLength(2);
    expect(raftRow("Run RAFT screen").subs).toHaveLength(4);
  });
  it("due today and tomorrow say (today) / (tomorrow); 2 days is still (in 2 d); a past due date is late (owner board 6)", () => {
    const T0 = "2026-10-21";
    const line = (due: string) => statusLines(row([td("A", { due })], "A"), rowsOf([td("A", { due })]), T0).map(l => l.text);
    expect(line("2026-10-21")).toEqual(["due 21 Oct (today)"]);
    expect(line("2026-10-22")).toEqual(["due 22 Oct (tomorrow)"]);
    expect(line("2026-10-23")).toEqual(["due 23 Oct (in 2 d)"]);
    expect(line("2026-10-20")).toEqual(["late: due 20 Oct"]);
  });
  it("GPC analysis comes after the two open to-dos, not the finished ones", () => expect(raftLines("GPC analysis")).toEqual(["after Run RAFT screen, Book GPC time"]));
  it("a due date more than 3 days away is muted", () => {
    const l = statusLines(raftRow("NMR end groups"), raft.rows, RAFT_TODAY);
    expect(l.map(x => x.text)).toEqual(["after Run RAFT screen", "due 28 Oct"]);
    expect(l[1].tone).toBe("muted");
  });
  it("done cards have no status lines", () => expect(raftLines("Purify monomer")).toEqual([]));
  it("without today there is no late mark and no soon colour", () => {
    expect(statusLines(raftRow("Book GPC time"), raft.rows, undefined).map(l => l.text)).toEqual(["waiting: facility reply", "due 15 Oct"]);
  });
  it("openBefore walks through finished to-dos to the open ones", () => {
    const todos = [td("A"), td("B", { done: true, after: "[[A]]" }), td("C", { after: "[[B]]" })];
    expect(openBefore(row(todos, "C"), rowsOf(todos))).toEqual(["A"]);
    expect(row(todos, "C").blocked).toBe(true);
  });
});

describe("cards in the SVG", () => {
  const model = slideModel(layoutPlan(raft), { kind: "whole" });
  const pic = slideSvg(model, { title: "RAFT kinetics", today: RAFT_TODAY });
  it("show late in red, waiting text in amber, after-lines and the due-soon line", () => {
    expect(pic.svg).toContain(">late: due 15 Oct<");
    expect(pic.svg).toContain(">waiting: facility rep…<");   // lines are cut to the card width (22 characters)
    expect(pic.svg).toContain(">due 23 Oct (in 3 d)<");
    expect(pic.svg).toContain(">after Run RAFT screen…<");
    expect(pic.svg).toContain(`stroke="${LATE}" stroke-width="3"`);
    expect(pic.svg).toContain(`fill="${WAIT}" font-weight="700">waiting`);
  });
  it("the card says 2/4 subtasks", () => expect(pic.svg).toContain("2/4 subtasks"));
  it("a due-tomorrow line shows whole (21 characters); a longer line is cut to 22 with …", () => {
    const tomorrow = slideSvg(slideModel(layoutPlan(readPlan([td("A", { due: "2026-10-22", waiting: "facility reply expected next week" }), td("B", { after: "[[A]]" })], hub)), { kind: "whole" }), { title: "P", today: "2026-10-21" }).svg;
    expect(tomorrow).toContain(">due 22 Oct (tomorrow)<");
    expect(/>([^<]*…)</.exec(tomorrow)![1].length).toBe(22);
  });
  it("without today there is no late line, no as-of line and no red border", () => {
    const s = slideSvg(model, { title: "RAFT kinetics" }).svg;
    expect(s).not.toContain("late: due");
    expect(s).not.toContain("as of");
    expect(s).not.toContain(`stroke="${LATE}"`);
  });
  it("escapes the waiting text", () => {
    const evil = readPlan([td("A", { waiting: 'x & <b> "q"' }), td("B", { after: "[[A]]" })], hub);
    const s = slideSvg(slideModel(layoutPlan(evil), { kind: "whole" }), { title: "P", today: "2026-10-20" }).svg;
    expect(s).toContain("waiting: x &amp; &lt;b&gt; &quot;q&quot;");
    expect(s).not.toContain("<b>");
  });
});

describe("header, progress and key", () => {
  const model = slideModel(layoutPlan(raft), { kind: "compact", ahead: 3 });
  const pic = slideSvg(model, { title: "RAFT kinetics", today: RAFT_TODAY });
  it("says 'as of' with the weekday and the year", () => expect(pic.svg).toContain(">as of Tue 20 Oct 2026<"));
  it("counts top-level to-dos only: 4 of 12 done, whichever layout", () => {
    expect(pic.svg).toContain(">4 of 12 done<");
    expect(slideSvg(slideModel(layoutPlan(raft), { kind: "whole" }), { title: "R", today: RAFT_TODAY }).svg).toContain(">4 of 12 done<");
  });
  it("the progress bar is a third of the way for 4 of 12", () => expect(pic.svg).toContain('width="120" height="14" rx="7" fill="#2e7d32"'));
  it("the made-up 59 to-do project: 35 of 59 done", () => {
    const m = slideModel(layoutPlan(readPlan(BIG_TODOS, BIG_HUB)), { kind: "compact", ahead: 5 });
    expect(slideSvg(m, { title: "Big", today: BIG_TODAY }).svg).toContain(">35 of 59 done<");
  });
  it("the key lists only the marks that appear", () => {
    for (const w of ["done", "can start", "waits for an earlier step", "late", "waiting on someone"]) expect(count(pic.svg, `>${w}<`), w).toBe(1);
    const small = slideModel(layoutPlan(readPlan([td("A"), td("B", { after: "[[A]]" })], hub)), { kind: "whole" });
    const s = slideSvg(small, { title: "P", today: "2026-10-20" }).svg;
    expect(count(s, ">can start<")).toBe(1);
    expect(count(s, ">waits for an earlier step<")).toBe(1);
    for (const w of ["done", "late", "waiting on someone"]) expect(count(s, `>${w}<`), w).toBe(0);
  });
  it("no key when nothing to explain", () => expect(slideSvg(slideModel(layoutPlan(readPlan([], hub)), { kind: "whole" }), { title: "E", today: "2026-10-20" }).svg).not.toContain(">can start<"));
  it("text stays at the minimum or more, and tiles and the key do not overlap", () => {
    expect(pic.minText).toBeGreaterThanOrEqual(MIN_READABLE);
    const keyY = Number(/<g transform="translate\(48 (\d+)\)"><rect width="34"/.exec(pic.svg)![1]);
    const tiles = [...pic.svg.matchAll(/<rect x="\d+" y="(\d+)" width="340" height="48"/g)].map(m => Number(m[1]) + 48);
    expect(tiles.length).toBeGreaterThan(0);
    expect(Math.max(...tiles)).toBeLessThanOrEqual(keyY);
  });
  it("a long title is cut so it does not run under the progress", () => {
    const s = slideSvg(model, { title: "x".repeat(200), today: RAFT_TODAY }).svg;
    expect(/>(x+…?)</.exec(s)![1].length).toBeLessThan(60);
  });
  it("minText still falls as columns grow", () => {
    const m = layoutPlan(readPlan(Array.from({ length: 14 }, (_, i) => td(`S${i + 1}`, i ? { after: `[[S${i}]]` } : {})), hub));
    const few = slideSvg(slideModel(m, { kind: "compact", ahead: 3 }), { title: "A", today: "2026-10-20" });
    const lots = slideSvg(slideModel(m, { kind: "compact", ahead: 14 }), { title: "A", today: "2026-10-20" });
    expect(lots.minText).toBeLessThan(few.minText);
    expect(few.tooSmall).toBe(false);
  });
});

describe("tiles", () => {
  const todos = [td("Spine"), td("Next", { after: "[[Spine]]" }),
    td("Late loose", { due: "2026-10-01" }), td("Waiting loose", { waiting: "x" }), td("Both", { due: "2026-10-01", waiting: "x" }),
    td("With subs"), td("S1", { sub: "[[With subs]]", done: true }), td("S2", { sub: "[[With subs]]" })];
  const s = slideSvg(slideModel(layoutPlan(readPlan(todos, hub)), { kind: "compact", ahead: 5 }), { title: "P", today: "2026-10-20" }).svg;
  it("Not linked tiles get late, waiting and 2/4 tags (late wins)", () => {
    expect(s).toContain(">Late loose  late<");
    expect(s).toContain(">Waiting loose  waiting<");
    expect(s).toContain(">Both  late<");
    expect(s).toContain(">With subs  1/2<");
  });
  it("a late tile has a red outline", () => expect(count(s, `rx="10" fill="#eef0f3" stroke="${LATE}" stroke-width="2"`)).toBe(2));
  it("the tag survives a long name", () => {
    const long = slideSvg(slideModel(layoutPlan(readPlan([td("A very long loose to-do name indeed", { due: "2026-10-01" })], hub)), { kind: "compact", ahead: 5 }), { title: "P", today: "2026-10-20" }).svg;
    expect(long).toMatch(/…  late</);
  });
});
