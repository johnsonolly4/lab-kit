// Phase 5a: the homepage / Projects overview lists (src/planning/lists.ts), each against the Dataview query it replaced (kit 0.5.2).
import { describe, it, expect } from "vitest";
import { blockOptions, deadlineBadge, experiments, folderIcon, goalOf, gotoTargets, hasPriority, linkTarget, meetingDone, meetingExperiments, meetingPapers, meetingWindow, pointsTo, projectCards, projectMeetings, projectNotes, projectTodos, PROJECT_TILE_ROWS, projects, recentlyRead, thisWeek, unnumbered, withExtras, type NoteRec } from "../src/planning/lists";

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
    note(T + "Mon task.md", { kind: "todo", scheduled: "2026-10-05" }),   // carried over: planned before today, open
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
    expect(b["Mon task"]).toEqual(["today", "carried over"]);
  });

  it("at the weekend no to-do is 'today'; carried cards stay listed with their own day", () => {
    expect(thisWeek(todos, SAT).flatMap(l => l.badges.map(x => x.text))).not.toContain("today");
    expect(thisWeek(todos, SAT).find(l => l.text === "Fri task")!.badges.map(x => x.text)).toEqual(["· Fri", "carried over"]);
  });

  it("reads `scheduled` as the board does: this week's Mon–Fri listed, Sat / Sun, next week and the Backlog not; old `day` read through dateOf", () => {
    const s = [
      note(T + "Thu date.md", { kind: "todo", scheduled: "2026-10-08" }),
      note(T + "Sat date.md", { kind: "todo", scheduled: "2026-10-10" }),
      note(T + "Next Mon.md", { kind: "todo", scheduled: "2026-10-12" }),
      note(T + "Last week.md", { kind: "todo", scheduled: "2026-09-30" }),
      note(T + "Old Thu.md", { kind: "todo", day: "Thu", planned: "2026-10-05" }),
      note(T + "Typo.md", { kind: "todo", scheduled: "next tue" }),
      note(T + "Ticked dated.md", { kind: "todo", scheduled: "2026-10-08", done: true }),
    ];
    const b = Object.fromEntries(thisWeek(s, WED).map(l => [l.text, l.badges.map(x => x.text)]));
    expect(Object.keys(b)).toEqual(["Last week", "Old Thu", "Thu date"]);
    expect(b["Last week"]).toEqual(["today", "carried over"]);
    expect(b["Thu date"]).toEqual(["· Thu"]);
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
    note(T + "t2.md", { kind: "todo", scheduled: "2026-10-08", project: "[[Alpha]]" }),
    note(T + "t3.md", { kind: "todo", day: "Fri", project: ["[[02 Projects/Alpha/Alpha|A]]"], due: "2026-10-01" }),
    note(T + "t4.md", { kind: "todo", scheduled: "2026-10-07", project: "[[Alpha]]" }),
    note(T + "t5.md", { kind: "todo", day: "Mon", project: "[[Alpha2]]" }),   // a different project
    note(T + "t6.md", { kind: "todo", day: "Mon", project: "[[Alpha]]", done: true }),
  ];
  const papers = [note("L/p1.md", { kind: "literature", Collections: ["Projects/Alpha"] }), note("L/p2.md", { kind: "literature" }, { links: [hub.path] }), note("L/p3.md", { kind: "literature" })];
  const notes = [hub, note("02 Projects/Alpha/Notes 1.md"), note("02 Projects/Alpha/Sub/Notes 2.md"), note("02 Projects/Other.md")];

  it("top 3 open to-dos (overdue, then by planned day, then Backlog), counts, goal", () => {
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
  it("shows nothing when off, finished, or without a valid date", () => {
    expect(deadlineBadge({ deadline: "2026-10-12" }, "off", WED)).toBeNull();
    expect(deadlineBadge({ Status: "Active", deadline: "2026-10-12" }, "marked", WED)).toEqual(deadlineBadge({ Status: "Active", deadline: "2026-10-12" }, "all", WED));
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
  it("Go to labels the planning folder's to-do board as To-do", () => {
    const files = [note("00 Planning/To-do board.base"), note("02 Projects/Projects overview.md", { kind: "hub" })];
    expect(gotoTargets(["00 Planning", "02 Projects"], files).map(l => l.text)).toEqual(["To-do", "Projects"]);
  });
});

describe("Project hub: meetings that name the project", () => {
  const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
  const m = (name: string, fm: Record<string, unknown>) => note(`08 Meetings/Group/${name}.md`, { kind: "meeting", series: "[[Group]]", ...fm });
  it("lists meeting notes whose project is the hub (a link or a list), newest first, with the series", () => {
    const rows = projectMeetings([
      m("2026-10-01 Group", { date: "2026-10-01", project: "[[Alpha]]" }),
      m("2026-10-15 Group", { date: "2026-10-15", project: ["[[Beta]]", "[[Alpha]]"] }),
      m("2026-10-08 Group", { date: "2026-10-08", project: "[[Beta]]" }),
      m("2026-10-09 Group", { date: "2026-10-09" }),
      note("08 Meetings/Group/x.md", { kind: "todo", project: "[[Alpha]]" }),
    ], hub);
    expect(rows.map(r => r.text)).toEqual(["2026-10-15 Group", "2026-10-01 Group"]);
    expect(rows[0].badges[0].text).toBe("Group");
  });
});

describe("Project hub tiles (To-dos and Notes, show all / collapse at 10)", () => {
  const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
  it("To-dos: this project's open to-dos only, overdue first, then Mon → Fri → Backlog", () => {
    const todos = [
      note(T + "Backlog one.md", { kind: "todo", day: "Backlog", project: "[[Alpha]]" }),
      note(T + "Mon one.md", { kind: "todo", day: "Mon", project: ["[[Alpha]]"] }),
      note(T + "Late one.md", { kind: "todo", day: "Fri", due: "2026-10-01", project: "[[Alpha]]" }),
      note(T + "Done one.md", { kind: "todo", day: "Done", project: "[[Alpha]]" }),
      note(T + "Ticked one.md", { kind: "todo", day: "Tue", done: true, project: "[[Alpha]]" }),
      note(T + "Other project.md", { kind: "todo", day: "Mon", project: "[[Beta]]" }),
    ];
    const lines = projectTodos(todos, hub, WED);
    expect(lines.map(l => l.text)).toEqual(["Late one", "Mon one", "Backlog one"]);
    expect(lines[0].badges[0].text).toBe("overdue 1 Oct");
    expect(lines[1].badges[0].text).toBe("· Mon");
    expect(lines[2].badges[0].text).toBe("· Backlog");
  });
  it("To-dos: the day badge is the weekday in this week, the date in another week", () => {
    const t = (name: string, scheduled: string) => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", scheduled });
    const lines = projectTodos([t("Next", "2026-10-13"), t("Thu", "2026-10-08"), t("Before", "2026-09-29")], hub, WED);
    expect(lines.map(l => `${l.text} ${l.badges[0].text}`)).toEqual(["Before · Tue 29 Sep", "Thu · Thu", "Next · Tue 13 Oct"]);
  });
  it("To-dos: overdue, then day, then priority (1 → 2 → 3 → none), then name", () => {
    const p = (name: string, fm: Record<string, unknown>) => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
    const todos = [
      p("Fri one", { day: "Fri", priority: 1 }),
      p("Mon none b", { day: "Mon" }),
      p("Mon three", { day: "Mon", priority: 3 }),
      p("Mon two", { day: "Mon", priority: "2" }),
      p("Mon one", { day: "Mon", priority: 1 }),
      p("Mon none a", { day: "Mon", priority: "" }),
      p("Late three", { day: "Fri", due: "2026-10-01", priority: 3 }),
      p("Backlog one", { day: "Backlog", priority: 1 }),
    ];
    expect(projectTodos(todos, hub, WED).map(l => l.text)).toEqual(
      ["Late three", "Mon one", "Mon two", "Mon three", "Mon none a", "Mon none b", "Fri one", "Backlog one"]);
    // anything but 1, 2, 3 (old text, 0, 4) counts as none
    const other = [p("x", { day: "Mon", priority: "high" }), p("y", { day: "Mon", priority: 0 }), p("z", { day: "Mon", priority: 4 }), p("a", { day: "Mon", priority: 3 })];
    expect(projectTodos(other, hub, WED).map(l => l.text)).toEqual(["a", "x", "y", "z"]);
  });
  it("Notes: everything else in the project's folder (sub-folders too), newest first, with the date", () => {
    const d = (m: number, day: number): number => new Date(2026, m, day).getTime();
    const notes = [
      hub,
      note("02 Projects/Alpha/Old.md", {}, { mtime: d(8, 1) }),
      note("02 Projects/Alpha/Sub/New.md", {}, { mtime: d(9, 5) }),
      note("02 Projects/Beta/Beta note.md", {}, { mtime: d(9, 6) }),
    ];
    const lines = projectNotes(notes, hub);
    expect(lines.map(l => l.text)).toEqual(["New", "Old"]);
    expect(lines[0].badges[0].text).toBe("· 5 Oct");
  });
  it("shows 10 rows before Show all", () => {
    expect(PROJECT_TILE_ROWS).toBe(10);
  });
});

describe("Meeting note tiles (the window is the note's since and date)", () => {
  const w = { since: "2026-10-01", date: "2026-10-08" };
  const at = (d: string): number => new Date(`${d}T12:00:00`).getTime();
  it("reads the window from the note's properties, none when either is missing or not a date", () => {
    expect(meetingWindow({ since: "2026-10-01", date: "2026-10-08" })).toEqual(w);
    expect(meetingWindow({ since: "2026-10-01" })).toBeNull();
    expect(meetingWindow({ since: "soon", date: "2026-10-08" })).toBeNull();
  });
  it("Experiments: lab notes changed after since, up to the end of the meeting day, by name", () => {
    const lab = "03 Lab Book/Notes/";
    const got = meetingExperiments([
      note(lab + "B.md", { Status: "Started" }, { mtime: at("2026-10-08") }),
      note(lab + "A.md", {}, { mtime: at("2026-10-02") }),
      note(lab + "Old.md", {}, { mtime: at("2026-09-30") }),
      note(lab + "Later.md", {}, { mtime: at("2026-10-09") }),
    ], w);
    expect(got.map(l => l.text)).toEqual(["A", "B"]);
    expect(got[1].badges).toEqual([{ text: "started", cls: "vt-badge vt-started" }]);
  });
  it("Done this week: finished after since up to the meeting day, with a priority, with the project", () => {
    const got = meetingDone([
      note(T + "On the day.md", { kind: "todo", done: true, done_on: "2026-10-08", project: "[[Alpha]]", priority: 1 }),
      note(T + "On since.md", { kind: "todo", done: true, done_on: "2026-10-01", priority: 1 }),   // since itself is before the window
      note(T + "Inside.md", { kind: "todo", done: true, done_on: "2026-10-03", priority: "3" }),
      note(T + "Open.md", { kind: "todo", day: "Mon", priority: 1 }),
    ], w);
    expect(got.lines.map(l => l.text)).toEqual(["Inside", "On the day"]);
    expect(got.lines[1].badges).toEqual([{ text: "· Alpha", cls: "vt-muted" }]);
    expect(got.hidden).toBe(0);
  });
  it("Done this week: a finished to-do with no priority (none, 0, 4, words) is left out and counted; a ticked subtask is neither listed nor counted", () => {
    const d = { kind: "todo", done: true, done_on: "2026-10-05" };
    const got = meetingDone([
      note(T + "P1.md", { ...d, priority: 1 }), note(T + "P2.md", { ...d, priority: 2 }), note(T + "P3.md", { ...d, priority: 3 }),
      note(T + "None.md", d), note(T + "Zero.md", { ...d, priority: 0 }), note(T + "Four.md", { ...d, priority: 4 }), note(T + "Words.md", { ...d, priority: "high" }),
      note(T + "Sub.md", { ...d, priority: 1, sub: "[[P1]]" }), note(T + "SubNone.md", { ...d, sub: "[[P1]]" }),
    ], w);
    expect(got.lines.map(l => l.text)).toEqual(["P1", "P2", "P3"]);
    expect(got.hidden).toBe(4);
  });
  it("hasPriority: 1, 2 or 3 as a number or text; nothing else", () => {
    expect([1, 2, 3, "1", " 2 ", "3"].every(hasPriority)).toBe(true);
    expect([undefined, null, "", 0, 4, "0", "high", NaN, true].some(hasPriority)).toBe(false);
  });
  it("Papers read: imported after since up to the meeting day (else created), shown by Title", () => {
    const lit = "04 Literature/";
    const got = meetingPapers([
      note(lit + "p1.md", { kind: "literature", Title: "Paper one", imported: "2026-10-05", takeaway: "works" }),
      note(lit + "p2.md", { kind: "literature", imported: "2026-09-20" }),
      note(lit + "p3.md", { kind: "literature" }, { ctime: at("2026-10-07") }),
    ], w);
    expect(got.map(l => l.text)).toEqual(["p3", "Paper one"]);
    expect(got[1].badges).toEqual([{ text: "· works", cls: "vt-muted" }]);
  });
});
