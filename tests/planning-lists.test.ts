// Phase 5a: the homepage / Projects overview lists (src/planning/lists.ts), each against the Dataview query it replaced (kit 0.5.2).
import { describe, it, expect } from "vitest";
import { blockOptions, deadlineBadge, experiments, folderIcon, goalOf, gotoTargets, linkTarget, pointsTo, projectCards, projects, recentlyRead, thisWeek, unnumbered, withExtras, type NoteRec } from "../src/planning/lists";

const note = (path: string, fm: Record<string, unknown> = {}, o: Partial<NoteRec> = {}): NoteRec => {
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.(md|base)$/, "");
  return { path, name, folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "", fm, ctime: 0, mtime: 0, ...o };
};
const WED = new Date(2026, 9, 7);   // Wednesday 7 October 2026
const SAT = new Date(2026, 9, 10);
const T = "00 Planning/To-dos/";

describe("This week (00 Home, Dataview LIST over the to-dos)", () => {
  const todos = [
    note(T + "Fri task.md", { kind: "todo", day: "Fri" }),
    note(T + "Mon task.md", { kind: "todo", day: "Mon", rolled: true }),
    note(T + "Wed task.md", { kind: "todo", day: "Wed" }),
    note(T + "Late backlog.md", { kind: "todo", day: "Backlog", due: "2026-10-05" }),
    note(T + "Due today.md", { kind: "todo", day: "Backlog", due: "2026-10-07" }),   // not overdue: due < today only
    note(T + "Backlog.md", { kind: "todo", day: "Backlog" }),
    note(T + "Ticked.md", { kind: "todo", day: "Tue", done: true }),
    note(T + "Done column.md", { kind: "todo", day: "Done" }),
    note(T + "Not a todo.md", { day: "Mon" }),
  ];

  it("open Mon–Fri or overdue to-dos; overdue first, then Mon → Fri", () => {
    expect(thisWeek(todos, WED).map(l => l.text)).toEqual(["Late backlog", "Mon task", "Wed task", "Fri task"]);
  });

  it("badges: overdue with its date, today, the day; carried over", () => {
    const b = Object.fromEntries(thisWeek(todos, WED).map(l => [l.text, l.badges.map(x => x.text)]));
    expect(b["Late backlog"]).toEqual(["overdue 5 Oct"]);
    expect(b["Wed task"]).toEqual(["today"]);
    expect(b["Fri task"]).toEqual(["· Fri"]);
    expect(b["Mon task"]).toEqual(["· Mon", "carried over"]);
  });

  it("at the weekend no to-do is 'today'", () => {
    expect(thisWeek(todos, SAT).flatMap(l => l.badges.map(x => x.text))).not.toContain("today");
  });
});

describe("Experiments on the go (00 Home)", () => {
  const notes = [
    note("Lab/ABC0001 - A.md", { Status: "Closed" }),
    note("Lab/ABC0002 - B.md", { Status: "Planned" }),
    note("Lab/ABC0003 - C.md", { Status: "Processing results" }),
    note("Lab/ABC0004 - D.md", { Status: "Started" }),
    note("Lab/ABC0005 - E.md", { Status: "Started" }),
    note("Lab/No status.md", {}),
  ];
  it("Status set and not Closed: Started → Processing results → the rest, then name Z → A; status badge", () => {
    const l = experiments(notes);
    expect(l.map(x => x.text)).toEqual(["ABC0005 - E", "ABC0004 - D", "ABC0003 - C", "ABC0002 - B"]);
    expect(l[2].badges).toEqual([{ text: "processing results", cls: "vt-badge vt-processing-results" }]);
  });
  it("limit", () => { expect(experiments(notes, 2)).toHaveLength(2); });
  it("a Status kept as a one-item list (notes from before issue #32) counts like text", () => {
    expect(experiments([note("Lab/Old.md", { Status: ["Started"] }), note("Lab/Shut.md", { Status: ["Closed"] })]).map(l => l.text)).toEqual(["Old"]);
  });
});

describe("Projects and Recently read (00 Home)", () => {
  it("projects: Active → Paused → Done → other, then name", () => {
    const hubs = [note("P/Zed/Zed.md", { kind: "project", Status: "Active" }), note("P/Done/Done.md", { kind: "project", Status: "Done" }),
      note("P/Alpha/Alpha.md", { kind: "project", Status: "Active" }), note("P/Pause/Pause.md", { kind: "project", Status: "Paused" }), note("P/x.md", { kind: "hub" })];
    expect(projects(hubs).map(l => l.text)).toEqual(["Alpha", "Zed", "Pause", "Done"]);
  });

  it("recently read: newest import first (else created), by Title, processed / to process, 5 at most", () => {
    const lit = [
      note("L/a.md", { kind: "literature", Title: "Old paper", imported: "2026-01-01" }),
      note("L/b.md", { kind: "literature", Title: "New paper", imported: "2026-10-01T09:00", takeaway: "RAFT works" }),
      note("L/c.md", { kind: "literature" }, { ctime: Date.parse("2026-06-01") }),
      note("L/hub.md", { kind: "hub" }),
    ];
    const l = recentlyRead(lit);
    expect(l.map(x => x.text)).toEqual(["New paper", "c", "Old paper"]);
    expect(l[0].badges[0].text).toBe("processed");
    expect(l[1].badges[0].text).toBe("to process");
    expect(recentlyRead(Array.from({ length: 8 }, (_, i) => note(`L/${i}.md`, { kind: "literature" })))).toHaveLength(5);
  });
});

describe("Project cards (Projects overview, DataviewJS)", () => {
  const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project", Status: "Active" });
  const todos = [
    note(T + "t1.md", { kind: "todo", day: "Backlog", project: "[[Alpha]]" }),
    note(T + "t2.md", { kind: "todo", day: "Tue", project: "[[Alpha]]" }),
    note(T + "t3.md", { kind: "todo", day: "Fri", project: ["[[02 Projects/Alpha/Alpha|A]]"], due: "2026-10-01" }),
    note(T + "t4.md", { kind: "todo", day: "Mon", project: "[[Alpha]]" }),
    note(T + "t5.md", { kind: "todo", day: "Mon", project: "[[Alpha2]]" }),   // a different project
    note(T + "t6.md", { kind: "todo", day: "Mon", project: "[[Alpha]]", done: true }),
  ];
  const papers = [note("L/p1.md", { kind: "literature", Collections: ["Projects/Alpha"] }), note("L/p2.md", { kind: "literature" }, { links: [hub.path] }), note("L/p3.md", { kind: "literature" })];
  const notes = [hub, note("02 Projects/Alpha/Notes 1.md"), note("02 Projects/Alpha/Sub/Notes 2.md"), note("02 Projects/Other.md")];

  it("top 3 open to-dos (overdue, then Mon → Fri → Backlog), counts, goal", () => {
    const [c] = projectCards([hub], todos, papers, notes, { [hub.path]: "Make polymers" }, WED);
    expect(c.todos.map(t => t.text)).toEqual(["t3", "t4", "t2"]);
    expect(c.todos[0].badges[0].text).toBe("overdue 1 Oct");
    expect(c).toMatchObject({ more: 1, open: 4, papers: 2, notes: 2, goal: "Make polymers", folder: "02 Projects/Alpha" });
  });

  it("links: exact note, not a prefix (Alpha2 is not Alpha)", () => {
    expect(linkTarget("[[Projects/Alpha|A]]")).toBe("Projects/Alpha");
    expect(pointsTo("[[Alpha2]]", hub)).toBe(false);
    expect(pointsTo(["x", "[[Alpha#Goal]]"], hub)).toBe(true);
  });

  it("goal inline field", () => {
    expect(goalOf("> [!focus] Goal\n> [goal:: Make polymers ]\n")).toBe("Make polymers");
    expect(goalOf("> [goal:: ]")).toBe("");
    expect(goalOf("no goal")).toBe("");
  });
});

describe("Go to and block options", () => {
  const files = [
    note("02 Projects/Projects overview.md", { kind: "hub" }), note("02 Projects/Alpha/Alpha.md", { kind: "project" }),
    note("04 Literature/Literature.md", {}), note("04 Literature/Some paper.md", {}),
    note("05 Chemicals/Chemical database.base"),
    note("06 Knowledge/Random.md"),
    note("00 Planning/To-do board.base"), note("00 Planning/Weekly review.md", { kind: "hub" }),
  ];
  it("an extra line that opens a note an automatic link opens is dropped; others and commands stay", () => {
    const auto = [{ text: "Meetings", path: "08 Meetings/Meetings.md", icon: "users" }];
    const extras = [{ text: "Meetings", path: "08 Meetings/Meetings.md", icon: "users" }, { text: "Weekly review", path: "00 Planning/Weekly review.md" }, { text: "Go", command: "a:b" }];
    expect(withExtras(auto, extras).map(l => l.text)).toEqual(["Meetings", "Weekly review", "Go"]);
  });
  it("hub by kind, then by name without number, then a base; number order; folders without one left out; hide", () => {
    const top = ["06 Knowledge", "05 Chemicals", "04 Literature", "02 Projects", "00 Planning", "99 Archive"];
    expect(gotoTargets(top, files)).toEqual([
      { text: "Planning", path: "00 Planning/Weekly review.md", icon: "kanban" },
      { text: "Projects", path: "02 Projects/Projects overview.md", icon: "folder-kanban" },
      { text: "Literature", path: "04 Literature/Literature.md", icon: "library" },
      { text: "Chemicals", path: "05 Chemicals/Chemical database.base", icon: "atom" },
    ]);
    expect(folderIcon("03 Lab Book")).toBe("notebook-pen");
    expect(folderIcon("06 Knowledge")).toBe("lightbulb");
    expect(folderIcon("12 Something else")).toBe("folder");
    expect(gotoTargets(top, files, ["Literature", "00 Planning"]).map(l => l.text)).toEqual(["Projects", "Chemicals"]);
    expect(unnumbered("10 - Work")).toBe("Work");
  });

  it("options: show, limit, hide lists, repeated extra", () => {
    expect(blockOptions("show: This-week\nlimit: 3\nhide: 99 Archive, Extras\nextra: To-do board\nextra: Deck | lab-kit:open-deck\nnonsense"))
      .toEqual({ show: "this-week", limit: 3, hide: ["99 Archive", "Extras"], extra: ["To-do board", "Deck | lab-kit:open-deck"] });
  });
});

describe("Project deadline countdown", () => {
  it("counts a hub's deadline like a to-do's due, under the same setting", () => {
    expect(deadlineBadge({ Status: "Active", deadline: "2026-10-12" }, "all", WED)).toEqual({ text: "deadline 5d", cls: "vt-badge vt-planned" });
    expect(deadlineBadge({ Status: "Active", deadline: "2026-10-08" }, "all", WED)).toEqual({ text: "deadline Tomorrow", cls: "vt-badge vt-today" });
    expect(deadlineBadge({ Status: "Active", deadline: "2026-10-05" }, "all", WED)).toEqual({ text: "deadline 2d late", cls: "vt-badge vt-overdue" });
  });
  it("shows nothing when off, not marked, finished, or without a valid date", () => {
    expect(deadlineBadge({ deadline: "2026-10-12" }, "off", WED)).toBeNull();
    expect(deadlineBadge({ deadline: "2026-10-12" }, "marked", WED)).toBeNull();
    expect(deadlineBadge({ deadline: "2026-10-12", countdown: true }, "marked", WED)).not.toBeNull();
    expect(deadlineBadge({ Status: "Done", deadline: "2026-10-12" }, "all", WED)).toBeNull();
    expect(deadlineBadge({ Status: "Active", deadline: "" }, "all", WED)).toBeNull();
    expect(deadlineBadge({ Status: "Active", deadline: "soon" }, "all", WED)).toBeNull();
  });
  it("projects() and project cards carry the badge after the status badge", () => {
    const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project", Status: "Active", deadline: "2026-10-12" });
    expect(projects([hub]).map(l => l.badges.length)).toEqual([1]);   // setting off: status only
    expect(projects([hub], Infinity, "all", WED)[0].badges.map(b => b.text)).toEqual(["active", "deadline 5d"]);
    expect(projectCards([hub], [], [], [], {}, WED, "all")[0].hub.badges.map(b => b.text)).toEqual(["active", "deadline 5d"]);
  });
});
