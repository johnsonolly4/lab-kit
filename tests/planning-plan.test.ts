// The project plan engine (src/planning/plan.ts): order, blocked, problems.
import { describe, it, expect } from "vitest";
import { hasPlan, planLines, projectExperiments, readPlan, statusClass } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const names = (todos: NoteRec[]) => readPlan(todos, hub).rows.map(r => r.name);

describe("readPlan", () => {
  it("a chain: parents first, children blocked until the parent is done", () => {
    const todos = [td("C", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("A")];
    const p = readPlan(todos, hub);
    expect(p.rows.map(r => r.name)).toEqual(["A", "B", "C"]);
    expect(p.rows.map(r => r.blocked)).toEqual([false, true, true]);
    expect(p.rows[1].after).toEqual(["A"]);
    expect(p.problems).toEqual([]);
  });

  it("a done parent unblocks its child; finished rows stay in the plan with their result", () => {
    const p = readPlan([td("A", { done: true, result: "  Mn 20 kDa " }), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]", day: "Done" })], hub);
    expect(p.rows.map(r => [r.name, r.done, r.blocked])).toEqual([["A", true, false], ["B", false, false], ["C", true, false]]);
    expect(p.rows[0].result).toBe("Mn 20 kDa");
  });

  it("a join: blocked while either parent is open; after as a list", () => {
    const todos = [td("J", { after: ["[[P1]]", "[[P2|second]]"] }), td("P1", { done: true }), td("P2")];
    const p = readPlan(todos, hub);
    expect(p.rows.map(r => r.name)).toEqual(["P1", "P2", "J"]);
    expect(p.rows[2]).toMatchObject({ blocked: true, after: ["P1", "P2"] });
    expect(readPlan([td("J", { after: ["[[P1]]", "[[P2]]"] }), td("P1", { done: true }), td("P2", { done: true })], hub).rows[2].blocked).toBe(false);
  });

  it("order breaks ties (a number or text; empty last); then the path", () => {
    expect(names([td("z", { order: 1 }), td("a"), td("m", { order: "2" }), td("b", { order: 1 })])).toEqual(["b", "z", "m", "a"]);
    expect(names([td("Late", { order: 1, after: "[[Early]]" }), td("Early", { order: 9 })])).toEqual(["Early", "Late"]);   // parents beat order
  });

  it("a missing link is a problem and is ignored; a self link too", () => {
    const p = readPlan([td("A", { after: ["[[Ghost]]", "[[A]]"] })], hub);
    expect(p.rows[0]).toMatchObject({ blocked: false, after: [] });
    expect(p.problems).toEqual(['"A" comes after "Ghost", which isn\'t in this project.', '"A" comes after itself.']);
  });

  it("a cycle: reported, every row still listed", () => {
    const p = readPlan([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" }), td("C")], hub);
    expect(p.rows.map(r => r.name)).toEqual(["C", "A", "B"]);
    expect(p.problems).toEqual(['These wait on each other, so none can start: "A", "B". Remove one "comes after" link.']);
  });

  it("only this project's to-dos; a link to another project's to-do is missing", () => {
    const other = note(T + "Other.md", { kind: "todo", project: "[[Beta]]" });
    const p = readPlan([td("A", { after: "[[Other]]" }), other, note(T + "Note.md", { project: "[[Alpha]]" })], hub);
    expect(p.rows.map(r => r.name)).toEqual(["A"]);
    expect(p.problems).toHaveLength(1);
  });

  it("a link with a path resolves", () => {
    expect(names([td("B", { after: "[[00 Planning/To-dos/A]]" }), td("A")])).toEqual(["A", "B"]);
  });
});

describe("date warning", () => {
  const warn = (todos: NoteRec[]) => readPlan(todos, hub).problems;
  it("an open to-do due before the open to-do it comes after", () => {
    expect(warn([td("A", { due: "2026-10-05" }), td("B", { after: "[[A]]", due: "2026-10-01" })]))
      .toEqual(['"B" is due 2026-10-01, before "A" (2026-10-05), which it comes after.']);
  });
  it("equal dates, a later date, a missing or unreadable date give no line", () => {
    expect(warn([td("A", { due: "2026-10-05" }), td("B", { after: "[[A]]", due: "2026-10-05" })])).toEqual([]);
    expect(warn([td("A", { due: "2026-10-05" }), td("B", { after: "[[A]]", due: "2026-10-09" })])).toEqual([]);
    expect(warn([td("A", { due: "2026-10-05" }), td("B", { after: "[[A]]" })])).toEqual([]);
    expect(warn([td("A", { due: "soon" }), td("B", { after: "[[A]]", due: "2026-10-01" })])).toEqual([]);
  });
  it("a finished parent or child gives no line", () => {
    expect(warn([td("A", { due: "2026-10-05", done: true }), td("B", { after: "[[A]]", due: "2026-10-01" })])).toEqual([]);
    expect(warn([td("A", { due: "2026-10-05" }), td("B", { after: "[[A]]", due: "2026-10-01", done: true })])).toEqual([]);
  });
});

describe("hasPlan / planLines (the Plan tile)", () => {
  it("no plan: to-dos with no after and no order, and no problems", () => {
    expect(hasPlan(readPlan([td("A"), td("B")], hub))).toBe(false);
    expect(hasPlan(readPlan([], hub))).toBe(false);
  });
  it("a plan: after, order, or a wrong link (so its message shows)", () => {
    expect(hasPlan(readPlan([td("A"), td("B", { after: "[[A]]" })], hub))).toBe(true);
    expect(hasPlan(readPlan([td("A", { order: 1 })], hub))).toBe(true);
    expect(hasPlan(readPlan([td("A", { after: "[[Ghost]]" })], hub))).toBe(true);
  });
  it("lines: ready, then blocked with after X, then finished with the result; the finished count", () => {
    const p = readPlan([td("Done1", { done: true, result: "Mn 20 kDa" }), td("Next", { after: "[[Done1]]" }), td("Later", { after: ["[[Next]]", "[[Done1]]"] }), td("Free")], hub);
    const { lines, finished } = planLines(p);
    expect(lines.map(l => l.text)).toEqual(["Free", "Next", "Later", "Done1"]);
    expect(lines.map(l => l.badges.map(b => b.text))).toEqual([[], [], ["after Next, Done1"], ["\u2192 Mn 20 kDa"]]);
    expect(finished).toBe(1);
    expect(lines[1].path).toBe(T + "Next.md");
  });
  it("a finished row without a result has no badge", () => {
    expect(planLines(readPlan([td("A", { done: true, order: 1 })], hub)).lines[0].badges).toEqual([]);
  });
});

describe("experiment", () => {
  const lab = (name: string, fm: Record<string, unknown> = {}): NoteRec => note("03 Lab Book/Notes/" + name + ".md", { Status: "Started", ...fm });
  const rowOf = (todos: NoteRec[], labs?: NoteRec[]) => readPlan(todos, hub, labs);
  it("reads the lab note's Status; by name or by path; the Status as written", () => {
    const labs = [lab("ABC0014-A"), lab("ABC0015-A", { Status: " Processing results " })];
    expect(rowOf([td("A", { experiment: "[[ABC0014-A]]" })], labs).rows[0].experiment).toEqual({ name: "ABC0014-A", path: "03 Lab Book/Notes/ABC0014-A.md", status: "Started" });
    expect(rowOf([td("A", { experiment: "[[03 Lab Book/Notes/ABC0015-A|run]]" })], labs).rows[0].experiment?.status).toBe("Processing results");
  });
  it("an empty Status gives an empty status; a to-do without experiment gives none", () => {
    const labs = [lab("X1", { Status: "" })];
    expect(rowOf([td("A", { experiment: "[[X1]]" })], labs).rows[0].experiment).toMatchObject({ name: "X1", status: "" });
    expect(rowOf([td("A")], labs).rows[0].experiment).toBeNull();
  });
  it("a link to something that is not a lab note: no status and a message", () => {
    const p = rowOf([td("A", { experiment: "[[Ghost]]" })], [lab("X1")]);
    expect(p.rows[0].experiment).toEqual({ name: "Ghost", path: "", status: "" });
    expect(p.problems).toEqual(['"A" links to the experiment "Ghost", which wasn\'t found.']);
  });
  it("no lab notes given (lab folder not set): nothing looked up, no message", () => {
    const p = rowOf([td("A", { experiment: "[[X1]]" })]);
    expect(p.rows[0].experiment).toBeNull();
    expect(p.problems).toEqual([]);
  });
  it("an experiment alone is not a plan", () => {
    expect(hasPlan(rowOf([td("A", { experiment: "[[X1]]" })], [lab("X1")]))).toBe(false);
  });
  it("the Plan tile line gets the status as a badge (ready, blocked and finished rows)", () => {
    const labs = [lab("X1"), lab("X2", { Status: "Closed" })];
    const p = rowOf([td("A", { experiment: "[[X1]]" }), td("B", { after: "[[A]]", experiment: "[[X2]]" }), td("C", { done: true, experiment: "[[X1]]" })], labs);
    const { lines } = planLines(p);
    expect(lines.map(l => [l.text, l.badges.map(b => b.text)])).toEqual([["A", ["Started"]], ["B", ["after A", "Closed"]], ["C", ["Started"]]]);
  });
});

describe("statusClass", () => {
  it("the four lab statuses have their own class; anything else is neutral", () => {
    expect(["Planned", "Started", "Processing results", "Closed"].map(statusClass)).toEqual(["vt-planned", "vt-started", "vt-processing-results", "vt-closed"]);
    expect(statusClass(" started ")).toBe("vt-started");
    expect(statusClass("On hold")).toBe("vt-planned");
    expect(statusClass("")).toBe("vt-planned");
  });
  it("the Plan tile badge carries the class", () => {
    const labs = [note("03 Lab Book/Notes/X1.md", { Status: "Closed" })];
    const { lines } = planLines(readPlan([td("A", { experiment: "[[X1]]" })], hub, labs));
    expect(lines[0].badges[0]).toEqual({ text: "Closed", cls: "vt-badge vt-closed" });
  });
});

describe("projectExperiments", () => {
  const lab = (name: string, status: string): NoteRec => note("03 Lab Book/Notes/" + name + ".md", { Status: status });
  const labs = [lab("E1", "Planned"), lab("E2", "Closed"), lab("E3", "Started"), lab("E4", "Weird")];
  const tile = (todos: NoteRec[], l?: NoteRec[]) => projectExperiments(readPlan(todos, hub, l));
  it("one line per experiment, open ones first, Closed last; status and the to-do that names it", () => {
    const lines = tile([td("A", { experiment: "[[E1]]" }), td("B", { experiment: "[[E2]]" }), td("C", { experiment: "[[E3]]" }), td("D", { experiment: "[[E4]]" })], labs);
    expect(lines.map(l => l.text)).toEqual(["E3", "E1", "E4", "E2"]);
    expect(lines[0]).toEqual({ path: "03 Lab Book/Notes/E3.md", text: "E3", badges: [{ text: "Started", cls: "vt-badge vt-started" }, { text: "\u00b7 C", cls: "vt-muted" }] });
  });
  it("two to-dos naming one experiment give one line with a count", () => {
    const lines = tile([td("A", { experiment: "[[E1]]" }), td("B", { experiment: "[[E1]]" })], labs);
    expect(lines).toHaveLength(1);
    expect(lines[0].badges.map(b => b.text)).toEqual(["Planned", "\u00b7 2 to-dos"]);
  });
  it("a broken link, no experiment, or no lab notes give no line", () => {
    expect(tile([td("A", { experiment: "[[Ghost]]" })], labs)).toEqual([]);
    expect(tile([td("A")], labs)).toEqual([]);
    expect(tile([td("A", { experiment: "[[E1]]" })])).toEqual([]);
  });
  it("an empty Status shows only the to-do", () => {
    expect(tile([td("A", { experiment: "[[E5]]" })], [lab("E5", "")])[0].badges).toEqual([{ text: "\u00b7 A", cls: "vt-muted" }]);
  });
});

describe("blocked through the whole chain", () => {
  const blocked = (todos: NoteRec[]) => Object.fromEntries(readPlan(todos, hub).rows.map(r => [r.name, r.blocked]));
  it("a to-do ticked out of order does not unblock what comes after it", () => {
    expect(blocked([td("A"), td("B", { after: "[[A]]", done: true }), td("C", { after: "[[B]]" })])).toEqual({ A: false, B: false, C: true });
  });
  it("once everything before is finished it is ready", () => {
    expect(blocked([td("A", { done: true }), td("B", { after: "[[A]]", done: true }), td("C", { after: "[[B]]" })])).toEqual({ A: false, B: false, C: false });
  });
  it("a long chain through finished middle to-dos, and a join with one open branch", () => {
    expect(blocked([td("A"), td("B", { after: "[[A]]", day: "Done" }), td("C", { after: "[[B]]", done: true }), td("D", { after: "[[C]]" })]).D).toBe(true);
    expect(blocked([td("P", { done: true }), td("Q"), td("J", { after: ["[[P]]", "[[Q]]"] })]).J).toBe(true);
  });
  it("a cycle ends", () => {
    expect(blocked([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" })])).toEqual({ A: true, B: true });
  });
});

describe("subtasks (sub)", () => {
  it("a parent lists its subtasks in plan order; the child names its parent", () => {
    const p = readPlan([td("P"), td("S1", { sub: "[[P]]", done: true }), td("S2", { sub: "[[P]]" }), td("Other")], hub);
    const row = (n: string) => p.rows.find(r => r.name === n)!;
    expect(row("P").subs).toEqual([{ path: T + "S1.md", name: "S1", done: true }, { path: T + "S2.md", name: "S2", done: false }]);
    expect(row("S1").parent).toBe(T + "P.md");
    expect(row("P").parent).toBeNull();
    expect(row("Other").subs).toEqual([]);
    expect(p.problems).toEqual([]);
  });
  it("a project with only subtasks has a plan", () => {
    expect(hasPlan(readPlan([td("P"), td("S", { sub: "[[P]]" })], hub))).toBe(true);
    expect(hasPlan(readPlan([td("P"), td("S")], hub))).toBe(false);
  });
  it("a missing parent, itself, a loop and a subtask of a subtask are problems and are ignored", () => {
    const p = readPlan([td("A", { sub: "[[Ghost]]" }), td("B", { sub: "[[B]]" }), td("C", { sub: "[[D]]" }), td("D", { sub: "[[C]]" }),
      td("P"), td("S", { sub: "[[P]]" }), td("X", { sub: "[[S]]" })], hub);
    expect(p.problems).toEqual([
      '"A" is a subtask of "Ghost", which isn\'t in this project.',
      '"B" is a subtask of itself.',
      '"C" and "D" are subtasks of each other.',
      '"X" is a subtask of "S", which is itself a subtask (one level only).']);
    const row = (n: string) => p.rows.find(r => r.name === n)!;
    expect([row("A").parent, row("B").parent, row("C").parent, row("D").parent, row("X").parent]).toEqual([null, null, null, null, null]);
    expect(row("P").subs.map(s => s.name)).toEqual(["S"]);
  });
  it("a subtask's own after still blocks what comes after it", () => {
    const p = readPlan([td("P"), td("S", { sub: "[[P]]" }), td("N", { after: "[[S]]" })], hub);
    expect(p.rows.find(r => r.name === "N")!.blocked).toBe(true);
  });
});

describe("a finished parent with open subtasks", () => {
  it("is reported, so a drag to Done on the board or a tick in the note does not hide it", () => {
    const one = readPlan([td("P", { done: true }), td("S", { sub: "[[P]]" })], hub);
    expect(one.problems).toEqual(['"P" is ticked, but its subtask isn\'t.']);
    const some = readPlan([td("P", { day: "Done" }), td("S1", { sub: "[[P]]" }), td("S2", { sub: "[[P]]" }), td("S3", { sub: "[[P]]", done: true })], hub);
    expect(some.problems).toEqual(['"P" is ticked, but 2 of its subtasks aren\'t.']);
    const mixed = readPlan([td("P", { done: true }), td("S1", { sub: "[[P]]" }), td("S2", { sub: "[[P]]", done: true })], hub);
    expect(mixed.problems).toEqual(['"P" is ticked, but 1 of its subtasks isn\'t.']);
  });
  it("is not reported when the parent is open, or when every subtask is done", () => {
    expect(readPlan([td("P"), td("S", { sub: "[[P]]" })], hub).problems).toEqual([]);
    expect(readPlan([td("P", { done: true }), td("S", { sub: "[[P]]", done: true })], hub).problems).toEqual([]);
  });
});

describe("issues: what is wrong, where, and what the map can fix", () => {
  const P = (n: string) => T + n + ".md";
  it("a link to something not found: marks the to-do and offers to clear just that link, saying what that does", () => {
    const p = readPlan([td("A", { after: ["[[Ghost]]", "[[B]]"] }), td("B"), td("E", { experiment: "[[Nope]]" })], hub, []);
    expect(p.issues).toEqual([
      { paths: [P("A")], text: '"A" comes after "Ghost", which isn\'t in this project.', fixes: [{ path: P("A"), key: "after", target: "Ghost", label: 'Remove the link to "Ghost"', does: 'Removes "Ghost" from the "comes after" list of "A"; its other links stay.', done: 'Removed the link to "Ghost".' }] },
      { paths: [P("E")], text: '"E" links to the experiment "Nope", which wasn\'t found.', fixes: [{ path: P("E"), key: "experiment", label: "Remove the experiment link", does: 'Removes the experiment link from "E".', done: 'Removed the experiment link from "E".' }] },
    ]);
    expect(p.problems).toEqual(p.issues.map(i => i.text));
  });
  it("a refused sub: the fix removes the subtask setting of the to-do named; two that name each other get one button each, naming the to-do", () => {
    const p = readPlan([td("A", { sub: "[[Ghost]]" }), td("C", { sub: "[[D]]" }), td("D", { sub: "[[C]]" }), td("S", { sub: "[[P]]" }), td("P"), td("X", { sub: "[[S]]" })], hub);
    const by = (name: string) => p.issues.find(i => i.text.startsWith(`"${name}"`));
    expect(by("A")?.fixes).toEqual([{ path: P("A"), key: "sub", label: "Make it a normal to-do", does: 'Removes the subtask setting from "A"; its other settings stay.', done: '"A" is a normal to-do now.' }]);
    expect(by("C")?.paths).toEqual([P("C"), P("D")]);
    expect(by("C")?.fixes.map(f => f.label)).toEqual(['Make "C" a normal to-do', 'Make "D" a normal to-do']);
    expect(by("X")?.fixes.map(f => f.label)).toEqual(["Make it a normal to-do"]);
  });
  it("a circle and an open subtask of a finished parent are marked but have no button", () => {
    const circle = readPlan([td("A", { after: "[[B]]" }), td("B", { after: "[[A]]" })], hub);
    expect(circle.issues[0].paths).toHaveLength(2);
    expect(circle.issues[0].fixes).toEqual([]);
    const fin = readPlan([td("P", { done: true }), td("S", { sub: "[[P]]" })], hub);
    expect(fin.issues).toEqual([{ paths: [P("P")], text: '"P" is ticked, but its subtask isn\'t.', fixes: [] }]);
  });
});
