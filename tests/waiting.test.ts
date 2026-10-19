// Waiting (I7): a to-do with `waiting: <who or what>` is shown as such in the lists, is not blocked, and the board look exists.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectCards, noNextStep, projects, projectTodos, thisWeek, waitingOn, type NoteRec } from "../src/planning/lists";
import { readPlan } from "../src/planning/plan";
import { waitingOf } from "../src/planning/todo";

const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const T = "00 Planning/To-dos/";
const WED = new Date(2026, 9, 7);
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project", Status: "Active" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", scheduled: "2026-10-08", ...fm });
const texts = (badges: { text: string }[]): string[] => badges.map(b => b.text);

describe("waitingOf", () => {
  it("is the trimmed text; absent, empty, a number or a list is not waiting", () => {
    expect(waitingOf({ waiting: "  NMR booking " })).toBe("NMR booking");
    expect([waitingOf({}), waitingOf({ waiting: "" }), waitingOf({ waiting: "  " }), waitingOf({ waiting: 4 }), waitingOf({ waiting: ["a"] }), waitingOf({ waiting: null })]).toEqual(["", "", "", "", "", ""]);
  });
});

describe("the waiting badge", () => {
  it("This week and the hub To-dos tile show 'waiting: <text>' after the day; a to-do not waiting has none", () => {
    const todos = [td("Run NMR", { waiting: "NMR booking" }), td("Plain")];
    const week = Object.fromEntries(thisWeek(todos, WED).map(l => [l.text, texts(l.badges)]));
    expect(week["Run NMR"]).toEqual(["· Thu 8 Oct", "waiting: NMR booking"]);
    expect(week["Plain"]).toEqual(["· Thu 8 Oct"]);
    const tile = projectTodos(todos, hub, WED).find(l => l.text === "Run NMR")!;
    expect(tile.badges.map(b => b.text)).toEqual(["· Thu 8 Oct", "waiting: NMR booking"]);
    expect(tile.badges[1].cls).toBe("vt-badge vt-waiting");
  });
  it("the project card's to-do rows show it too", () => {
    const card = projectCards([hub], [td("Run NMR", { waiting: "samples" })], [], [], {}, WED)[0];
    expect(texts(card.todos[0].badges)).toContain("waiting: samples");
  });
});

describe("a waiting to-do is not blocked", () => {
  it("blocked while an earlier to-do is open, unless it waits on something", () => {
    const todos = [td("A"), td("B", { after: "[[A]]" }), td("C", { after: "[[A]]", waiting: "reagent delivery" })];
    const rows = Object.fromEntries(readPlan(todos, hub).rows.map(r => [r.name, r.blocked]));
    expect(rows).toEqual({ A: false, B: true, C: false });
  });
});

describe("the board look", () => {
  it("the vault theme greys a card with data-vt-waiting and colours the badge", () => {
    const css = readFileSync("kits/planning/.obsidian/snippets/vault-theme.css", "utf8");
    expect(css).toMatch(/\.bases-kanban-card\[data-vt-waiting\]\s*\{[^}]*--vt-waiting/);
    expect(css).toContain(".vt-badge:is(.vt-paused, .vt-processing-results, .vt-rolled, .vt-waiting, .vt-nonext)");
  });
  it("the engine sets and clears data-vt-waiting", () => {
    const src = readFileSync("src/planning/engine.ts", "utf8");
    expect(src).toContain("el.dataset.vtWaiting = waiting");
    expect(src).toContain('delete el.dataset.vtWaiting');
    expect(src).toContain('querySelectorAll<HTMLElement>("[data-vt-waiting]")');
  });
});

describe("the Waiting on list", () => {
  const other = note("02 Projects/Beta/Beta.md", { kind: "project", Status: "Active" });
  const todos = [
    td("NMR run", { waiting: "nmr booking", priority: 2 }),
    td("NMR prep", { waiting: "NMR booking", priority: 1 }),
    td("Order solvent", { waiting: "Supplier" }),
    td("Ticked", { waiting: "Supplier", done: true }),
    td("In Done", { waiting: "Supplier", day: "Done" }),
    td("Not waiting"),
    note(T + "Beta job.md", { kind: "todo", project: "[[Beta]]", day: "Tue", waiting: "Supplier", due: "2026-10-01" }),
  ];
  it("groups open waiting to-dos by what they wait on (any case is one group, named as the first note by name spells it), A to Z, priority first inside", () => {
    const g = waitingOn(todos, WED);
    expect(g.map(x => x.who)).toEqual(["NMR booking", "Supplier"]);
    expect(g[0].lines.map(l => l.text)).toEqual(["NMR prep", "NMR run"]);
    expect(g[1].lines.map(l => l.text)).toEqual(["Beta job", "Order solvent"]);
    expect(texts(g[1].lines[0].badges)).toEqual(["overdue 1 Oct"]);
    expect(texts(g[0].lines[0].badges)).toEqual(["· Thu 8 Oct"]);
  });
  it("on a project hub: only that project's to-dos", () => {
    expect(waitingOn(todos, WED, hub).flatMap(x => x.lines.map(l => l.text)).sort()).toEqual(["NMR prep", "NMR run", "Order solvent"]);
    expect(waitingOn(todos, WED, other).flatMap(x => x.lines.map(l => l.text))).toEqual(["Beta job"]);
    expect(waitingOn([td("Plain")], WED)).toEqual([]);
  });
  it("the block is in the Meeting and Project hub templates and the unknown-card text names it", () => {
    const meeting = readFileSync("kits/planning/Extras/Templates/Meeting.md", "utf8");
    expect(meeting.indexOf("show: waiting")).toBeGreaterThan(meeting.indexOf("Flagged for this meeting"));
    expect(readFileSync("kits/planning/Extras/Templates/Project hub.md", "utf8")).toContain("> [!question] Waiting on\n> ```vault-card\n> show: waiting\n> ```");
    expect(readFileSync("src/planning/blocks.ts", "utf8")).toContain('case "waiting"');
  });
});

describe("no next step (I13)", () => {
  const proj = (name: string, Status?: string) => note(`02 Projects/${name}/${name}.md`, { kind: "project", ...(Status ? { Status } : {}) });
  const open = [td("Do it")];   // points at Alpha
  const line = (h: NoteRec, todos: NoteRec[]) => projects([h], Infinity, "off", WED, todos)[0].badges.map(b => b.text);
  it("Active with no open to-do gets the badge", () => {
    expect(noNextStep(proj("Alpha", "Active"), [])).toBe(true);
    expect(line(proj("Alpha", "Active"), [])).toContain("no next step");
    expect(noNextStep(proj("Alpha"), [])).toBe(true);   // no Status counts as Active
  });
  it("Active with one open to-do has none; ticked and Done-column to-dos and other projects' to-dos do not count", () => {
    expect(noNextStep(proj("Alpha", "Active"), open)).toBe(false);
    expect(line(proj("Alpha", "Active"), open)).not.toContain("no next step");
    expect(noNextStep(proj("Alpha", "Active"), [td("T", { done: true }), td("D", { day: "Done" }), td("Other", { project: "[[Beta]]" })])).toBe(true);
  });
  it("Paused and Done projects with none have no badge; without a to-do list the tile is as before", () => {
    expect(noNextStep(proj("Alpha", "Paused"), [])).toBe(false);
    expect(noNextStep(proj("Alpha", "Done"), [])).toBe(false);
    expect(projects([proj("Alpha", "Active")]).flatMap(l => l.badges.map(b => b.text))).toEqual(["active"]);
  });
});
