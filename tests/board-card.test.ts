import { describe, it, expect } from "vitest";
import { cardOf, deadlineMarkers, filterTray, meetingMarkers, projectName, readyPaths, shownDays, trayProjects, type BoardCard, type HeaderSrc, type BoardOptions } from "../src/planning/board-card";
import { buildBoard } from "./helpers/old-todo";
import type { NoteRec } from "../src/planning/lists";
import type { Series } from "../src/planning/meetings";

const WED = new Date(2026, 9, 21);   // Wednesday 2026-10-21; Monday is 2026-10-19
const opts = (o: Partial<BoardOptions> = {}): BoardOptions => ({ weekend: false, busyFrom: 6, countdown: "all", now: WED, ...o });
const note = (path: string, fm: Record<string, unknown>): NoteRec => ({ path, name: path.split("/").pop()!.replace(/\.md$/, ""), folder: path.split("/").slice(0, -1).join("/"), fm, ctime: 0, mtime: 0 });
const card = (title: string, fm: Record<string, unknown> = {}): BoardCard => cardOf({ path: `T/${title}.md`, title, fm: { kind: "todo", ...fm } }, "all", WED);
const series = (name: string, day: number, over: Partial<Series> = {}): Series => ({ name, path: `M/${name}.md`, folder: "M", interval: "weekly", day, start: new Date(2026, 9, 7), ...over });
const head = (h: Partial<HeaderSrc> = {}): HeaderSrc => ({ series: [], todos: [], hubs: [], ...h });

describe("board card pieces", () => {
  it("reads title, tag, countdown, project, waiting, carried over", () => {
    const c = card("Book NMR", { day: "Mon", priority: 1, project: "[[Projects/Polymers]]", due: "2026-10-21", rolled: true, waiting: " GPC slot " });
    expect(c).toMatchObject({ title: "Book NMR", day: "Mon", project: "Polymers", waiting: "GPC slot", rolled: true, due: "2026-10-21" });
    expect(c.tag?.text).toBe("↑ Polymers");
    expect(c.countdown).toEqual({ text: "Today", level: "soon" });
  });
  it("a finished card has no countdown, waiting or carried-over mark", () => {
    const c = card("X", { done: true, rolled: true, waiting: "y", due: "2026-10-21" });
    expect(c).toMatchObject({ done: true, rolled: false, waiting: "", countdown: null });
  });
  it("project name from a list, a link with alias, or nothing", () => {
    expect(projectName({ project: ["[[A/Beta|b]]", "[[C]]"] })).toBe("Beta");
    expect(projectName({})).toBe("");
  });
});

describe("day / tray split", () => {
  const cards = [card("a", { day: "Mon" }), card("b", { day: "Mon", done: true }), card("c", { day: "Mon", done: true }), card("d", { day: "Backlog" }),
    card("e", { day: "Sat" }), card("f", { day: "Backlog", done: true }), card("g")];
  it("five columns Mon-Fri, finished collapse to a count, others in the tray (Sat too when the weekend is off)", () => {
    const b = buildBoard(cards, head(), opts());
    expect(b.days.map(d => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(b.days[0]).toMatchObject({ count: 1, done: 2 });
    expect(b.days[0].open.map(c => c.title)).toEqual(["a"]);
    expect(b.tray.map(c => c.title)).toEqual(["d", "e", "g"]);
  });
  it("weekend on adds Sat and Sun and takes the Sat card out of the tray", () => {
    expect(shownDays(true)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const b = buildBoard(cards, head(), opts({ weekend: true }));
    expect(b.days.map(d => d.day).slice(5)).toEqual(["Sat", "Sun"]);
    expect(b.days[5].open.map(c => c.title)).toEqual(["e"]);
    expect(b.tray.map(c => c.title)).toEqual(["d", "g"]);
  });
  it("today is the column of the weekday; none at a weekend unless shown", () => {
    expect(buildBoard([], head(), opts()).days.map(d => d.today)).toEqual([false, false, true, false, false]);
    const sun = new Date(2026, 9, 25);
    expect(buildBoard([], head(), opts({ now: sun })).days.some(d => d.today)).toBe(false);
    expect(buildBoard([], head(), opts({ now: sun, weekend: true })).days[6].today).toBe(true);
  });
  it("column dates run from this week's Monday", () => {
    expect(buildBoard([], head(), opts()).days.map(d => d.date.getDate())).toEqual([19, 20, 21, 22, 23]);
  });
});

describe("busy day", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => card(`t${i}`, { day: "Tue" }));
  it("amber from the threshold, not below; finished cards do not count", () => {
    expect(buildBoard(many(5), head(), opts()).days[1].busy).toBe(false);
    expect(buildBoard(many(6), head(), opts()).days[1].busy).toBe(true);
    expect(buildBoard([...many(5), card("z", { day: "Tue", done: true })], head(), opts()).days[1]).toMatchObject({ busy: false, count: 5, done: 1 });
    expect(buildBoard(many(3), head(), opts({ busyFrom: 3 })).days[1].busy).toBe(true);
  });
});

describe("day header markers", () => {
  const wedHub = note("M/Group meeting.md", { kind: "meeting-series" });
  it("a weekly Wednesday series marks Wednesday only, with the open flagged count", () => {
    const s = series("Group meeting", 3);
    const todos = [note("T/a.md", { kind: "todo", meeting: "[[Group meeting]]" }), note("T/b.md", { kind: "todo", meeting: "[[Group meeting]]" }), note("T/c.md", { kind: "todo", meeting: "[[Group meeting]]", done: true })];
    const h = head({ series: [s], hubs: [wedHub], todos });
    const b = buildBoard([], h, opts());
    expect(b.days.map(d => d.markers.map(m => m.text))).toEqual([[], [], ["Group meeting · 2 flagged"], [], []]);
    expect(b.days[2].markers[0].kind).toBe("meeting");
  });
  it("no count when nothing is flagged; a one-off hub gives no marker", () => {
    const h = head({ series: [series("Group meeting", 3), series("Once", 3, { interval: "once" })], hubs: [wedHub] });
    expect(meetingMarkers(h, new Date(2026, 9, 21)).map(m => m.text)).toEqual(["Group meeting"]);
  });
  it("a series that has not started yet gives no marker before its first meeting", () => {
    const h = head({ series: [series("Late", 3, { start: new Date(2026, 10, 4) })], hubs: [] });
    expect(meetingMarkers(h, new Date(2026, 9, 21))).toEqual([]);
  });
  it("hub deadlines on their date; a Done project gives none", () => {
    const hubs = [note("P/Polymers.md", { kind: "project", Status: "Active", deadline: "2026-10-22" }), note("P/Old.md", { kind: "project", Status: "Done", deadline: "2026-10-22" })];
    const b = buildBoard([], head({ hubs }), opts());
    expect(b.days[3].markers).toEqual([{ kind: "deadline", text: "Polymers: deadline" }]);
    expect(b.days.filter((_, i) => i !== 3).every(d => d.markers.length === 0)).toBe(true);
  });
  it("a to-do due on another day or in the Backlog marks its due day; on its own day it does not", () => {
    const cards = [card("Abstract", { day: "Backlog", due: "2026-10-23" }), card("Slides", { day: "Fri", due: "2026-10-23" }), card("Plan", { day: "Mon", due: "2026-10-23" }), card("Finished", { day: "Mon", due: "2026-10-23", done: true })];
    const fri = buildBoard(cards, head(), opts()).days[4].markers.map(m => m.text);
    expect(fri).toEqual(["Due: Abstract", "Due: Plan"]);
  });
  it("more than two deadline marks collapse to a count", () => {
    const hubs = [note("P/A.md", { kind: "project", deadline: "2026-10-20" })];
    const cards = [card("x", { day: "Mon", due: "2026-10-20" }), card("y", { day: "Mon", due: "2026-10-20" })];
    expect(deadlineMarkers(head({ hubs }), cards, "Tue", new Date(2026, 9, 20))).toEqual([{ kind: "deadline", text: "3 due" }]);
  });
});

describe("tray filter", () => {
  const tray = [card("a", { project: "[[Polymers]]" }), card("b", { project: "[[Flow rig]]" }), card("c"), card("d", { project: "[[Polymers]]" })];
  it("chips list each project once; All, project and No project filter", () => {
    expect(trayProjects(tray)).toEqual(["Flow rig", "Polymers"]);
    const ready = new Set<string>();
    expect(filterTray(tray, { kind: "all" }, ready)).toHaveLength(4);
    expect(filterTray(tray, { kind: "project", name: "Polymers" }, ready).map(c => c.title)).toEqual(["a", "d"]);
    expect(filterTray(tray, { kind: "none" }, ready).map(c => c.title)).toEqual(["c"]);
  });
  it("Ready keeps the cards whose path is ready", () => {
    expect(filterTray(tray, { kind: "ready" }, new Set([tray[1].path])).map(c => c.title)).toEqual(["b"]);
  });
});

describe("Ready (plan.ts blocked = false)", () => {
  const hub = note("P/Polymers.md", { kind: "project", Status: "Active" });
  const todo = (n: string, fm: Record<string, unknown> = {}) => note(`T/${n}.md`, { kind: "todo", project: "[[Polymers]]", ...fm });
  it("the first step is ready, the one after it is not, until the first is done", () => {
    const todos = [todo("one"), todo("two", { after: ["[[one]]"] }), note("T/loose.md", { kind: "todo" })];
    expect([...readyPaths(todos, [hub])].sort()).toEqual(["T/one.md"]);
    const doneOne = [todo("one", { done: true }), todo("two", { after: ["[[one]]"] })];
    expect([...readyPaths(doneOne, [hub])]).toEqual(["T/two.md"]);
  });
  it("a waiting to-do and a finished one are not ready; a to-do with no project never is", () => {
    const todos = [todo("w", { waiting: "slot" }), todo("f", { done: true }), todo("ok")];
    expect([...readyPaths(todos, [hub])]).toEqual(["T/ok.md"]);
  });
});
