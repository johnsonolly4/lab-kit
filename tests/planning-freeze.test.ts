// I19 / I20: freezing a meeting note (src/planning/freeze.ts), against a fixture note.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { flaggedLines, freezeBody, freezeMeeting, frozenOn, dueToFreeze, lineMarkdown, meetingDay, meetingFreezeLists, pictureFreezeLines, raisedStamp, type FreezeData, type FreezeLists } from "../src/planning/freeze";
import { readPlan } from "../src/planning/plan";
import { BIG_HUB, BIG_TITLE, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";
import { scan, selectChanges, wantsText, type TidyContext } from "../src/kit/tidy";
import { applyTidy } from "../src/kit/tidy-apply";
import type { NoteRec } from "../src/planning/lists";

const rec = (path: string, fm: Record<string, unknown>, mtime = 0): NoteRec => ({ path, name: path.split("/").pop()!.replace(/\.md$/, ""), folder: path.split("/").slice(0, -1).join("/"), fm, ctime: 0, mtime });
const day = (s: string): number => new Date(`${s}T12:00:00`).getTime();
const before = readFileSync("tests/fixtures/meeting-before.md", "utf8");
const hub = rec("08 Meetings/Weekly meetings/Weekly meetings.md", { kind: "meeting-series" });
const lists: FreezeLists = {
  "meeting-experiments": ["- [[0005 RAFT]] · in progress"],
  "meeting-done": ["No to-dos finished since the last meeting."],
  "meeting-papers": ["- [[smith2026|A paper]] · good"],
  waiting: ["**Supplier**", "- [[Order column]] · Thu"],
  "meeting-flagged": ["- [[Fix pump]] · raised 8 Oct"],
};

describe("freezeMeeting", () => {
  const after = freezeMeeting(before, lists, "2026-10-22")!;

  it("replaces every generated block, keeping the callout prefixes", () => {
    expect(after).toContain("> > - [[0005 RAFT]] · in progress");
    expect(after).toContain("> > No to-dos finished since the last meeting.");
    expect(after).toContain("> > - [[smith2026|A paper]] · good");
    expect(after).toContain("> > - [[Fix pump]] · raised 8 Oct");
    expect(after).toContain("> > **Supplier**\n> > - [[Order column]] · Thu");
    expect(after).not.toContain("show: meeting-experiments");
    expect(after).not.toContain("show: waiting");
    expect(after).not.toContain("dataview");
  });

  it("sets frozen at the end of the properties and leaves the rest of them alone", () => {
    expect(after.startsWith('---\nkind: meeting\nseries: "[[Weekly meetings]]"\ndate: 2026-10-15\nsince: 2026-10-08\nproject:\ncssclasses:\n  - vt\nfrozen: 2026-10-22\n---\n')).toBe(true);
    expect(frozenOn(after)).toBe("2026-10-22");
  });

  it("keeps the user's text and the other blocks exactly", () => {
    for (const keep of ["show: meeting-bar", "> - my own question about the **RAFT** run", "## Notes from the meeting\n- agreed to repeat 0005\n- ```not a block```", "> [!tip] Actions"]) expect(after).toContain(keep);
    // everything outside the five blocks is the same lines
    const strip = (t: string): string[] => t.split("\n").filter(l => !/^>( >)? ?(-|\*\*|No |LIST|FROM|WHERE|```|show: (meeting-[edp]|waiting))/.test(l));
    expect(strip(after).filter(l => !/^(---|frozen:)/.test(l))).toEqual(strip(before).filter(l => !/^---/.test(l)));
  });

  it("never freezes a note twice, and only freezes meeting notes", () => {
    expect(freezeMeeting(after, lists, "2026-11-01")).toBeNull();
    expect(freezeMeeting("---\nkind: todo\n---\n\n```vault-card\nshow: waiting\n```\n", lists, "2026-10-22")).toBeNull();
    expect(freezeMeeting("no properties", lists, "2026-10-22")).toBeNull();
  });

  it("leaves a block alone when its list is not given", () => {
    const { "meeting-papers": _p, ...some } = lists;
    expect(freezeBody(before.split("---\n")[2], some)).toContain("show: meeting-papers");
  });

  it("keeps Windows line endings", () => {
    const win = freezeMeeting(before.replace(/\n/g, "\r\n"), lists, "2026-10-22")!;
    expect(win.includes("\r\n")).toBe(true);
    expect(win.replace(/\r\n/g, "\n")).toBe(after);
  });
});

describe("lineMarkdown", () => {
  it("uses the note name, an alias when the shown text differs, and the badges after a dot", () => {
    expect(lineMarkdown({ path: "a/B.md", text: "B", badges: [] })).toBe("- [[B]]");
    expect(lineMarkdown({ path: "a/b.md", text: "Title", badges: [{ text: "· proj", cls: "" }, { text: "done", cls: "" }] })).toBe("- [[b|Title]] · proj · done");
  });
});

describe("meetingFreezeLists", () => {
  const todos = [
    rec("00 Planning/To-dos/Fix pump.md", { kind: "todo", done: false, day: "Mon", meeting: "[[Weekly meetings]]", raised_on: "2026-10-08" }),
    rec("00 Planning/To-dos/Old flag.md", { kind: "todo", done: true, day: "Done", meeting: "[[Weekly meetings]]" }),
    rec("00 Planning/To-dos/Other.md", { kind: "todo", done: false, day: "Tue", meeting: "[[Group meeting]]" }),
    rec("00 Planning/To-dos/Waits.md", { kind: "todo", done: false, day: "Wed", waiting: "Supplier" }),
  ];
  const fm = { kind: "meeting", date: "2026-10-15", since: "2026-10-08" };
  const lab = [rec("03 Lab/0005 RAFT.md", { Status: "In progress" }, day("2026-10-12")), rec("03 Lab/0001 old.md", {}, day("2026-09-01"))];

  it("lists what the blocks list, in full", () => {
    const d = meetingFreezeLists({ fm, lab, todos, hub, isFirst: false }, new Date(2026, 9, 15))!;
    expect(d.lists["meeting-experiments"]).toEqual(["- [[0005 RAFT]] · in progress"]);
    expect(d.lists["meeting-done"]).toEqual(["No to-dos finished since the last meeting."]);
    expect(d.lists["meeting-flagged"]).toEqual(["- [[Fix pump]] · raised 8 Oct"]);
    expect(d.lists.waiting[0]).toBe("**Supplier**");
    expect(d.flagged.map(f => f.name)).toEqual(["Fix pump"]);
    expect("meeting-papers" in d.lists).toBe(false);   // no literature folder: that block stays
  });

  it("is null without since and date", () => {
    expect(meetingFreezeLists({ fm: { kind: "meeting" }, todos, hub, isFirst: false }, new Date())).toBeNull();
  });
});

describe("raised flags (I20)", () => {
  it("raisedStamp keeps the earliest date", () => {
    expect(raisedStamp(undefined, "2026-10-15")).toBe("2026-10-15");
    expect(raisedStamp("", "2026-10-15")).toBe("2026-10-15");
    expect(raisedStamp("2026-10-08", "2026-10-15")).toBeNull();
    expect(raisedStamp("2026-10-15", "2026-10-15")).toBeNull();
    expect(raisedStamp("2026-10-22", "2026-10-15")).toBe("2026-10-15");
    expect(raisedStamp("rubbish", "2026-10-15")).toBe("2026-10-15");
  });

  it("flaggedLines shows raised only for an earlier meeting, and the old meeting: true for the first series", () => {
    const t = [rec("T/A.md", { kind: "todo", done: false, day: "Mon", meeting: "[[Weekly meetings]]", raised_on: "2026-10-08" }),
      rec("T/B.md", { kind: "todo", done: false, day: "Mon", meeting: "[[Weekly meetings]]", raised_on: "2026-10-15" }),
      rec("T/C.md", { kind: "todo", done: false, day: "Mon", meeting: true })];
    const lines = flaggedLines(t, hub, true, "2026-10-15");
    expect(lines.map(l => l.text)).toEqual(["A", "B", "C"]);
    expect(lines.map(l => l.badges.map(b => b.text))).toEqual([["raised 8 Oct"], [], []]);
    expect(flaggedLines(t, hub, false, "2026-10-15").map(l => l.text)).toEqual(["A", "B"]);
  });
});

describe("dueToFreeze (the day after the meeting, owner 2026-10-20)", () => {
  const fm = (date: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ kind: "meeting", date, ...extra });
  it("is not due on the day of the meeting, is due the day after and on later days", () => {
    expect(dueToFreeze(fm("2026-10-15"), "2026-10-14")).toBe(false);
    expect(dueToFreeze(fm("2026-10-15"), "2026-10-15")).toBe(false);
    expect(dueToFreeze(fm("2026-10-15"), "2026-10-16")).toBe(true);
    expect(dueToFreeze(fm("2026-10-15"), "2026-12-01")).toBe(true);
    expect(dueToFreeze(fm("2026-12-31"), "2027-01-01")).toBe(true);
  });
  it("is not due without a readable date", () => {
    for (const d of [undefined, "", "soon", "15/10/2026", "2026-02-30", 20261015]) expect(dueToFreeze(fm(d), "2027-01-01")).toBe(false);
    expect(meetingDay(fm("2026-10-15T09:00"))).toBe("2026-10-15");
  });
  it("is not due for a frozen note (also when its date was edited later) or a note that is not a meeting", () => {
    expect(dueToFreeze(fm("2026-10-15", { frozen: "2026-10-16" }), "2026-10-20")).toBe(false);
    expect(dueToFreeze(fm("2026-12-01", { frozen: "2026-10-16" }), "2026-10-20")).toBe(false);
    expect(dueToFreeze({ kind: "todo", date: "2026-10-15" }, "2026-10-20")).toBe(false);
  });
});

describe("Tidy rule: Meetings: freeze old meeting notes", () => {
  const meet = (date: string, extra = ""): string => `---\nkind: meeting\nseries: "[[Weekly]]"\ndate: ${date}\nsince: 2026-10-01\n${extra}---\n\nmine\n\n\`\`\`vault-card\nshow: meeting-flagged\n\`\`\`\n`;
  const vault = (): Map<string, string> => new Map([
    ["08 Meetings/Weekly/Weekly.md", "---\nkind: meeting-series\ninterval: weekly\n---\n"],
    ["08 Meetings/Weekly/2026-10-08 Weekly.md", meet("2026-10-08")],
    ["08 Meetings/Weekly/2026-10-15 Weekly.md", meet("2026-10-15")],
    ["08 Meetings/Weekly/2026-10-22 Weekly.md", meet("2026-10-22")],
    ["00 Planning/To-dos/Fix pump.md", "---\nkind: todo\nmeeting: \"[[Weekly]]\"\n---\n"],
  ]);
  const flagged = (): FreezeData => ({ lists: { "meeting-flagged": ["- [[Fix pump]]"] }, flagged: [rec("00 Planning/To-dos/Fix pump.md", { kind: "todo" })] });
  const make = (freeze?: TidyContext["freeze"]): TidyContext => ({
    labFolder: "03 Lab", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: [], migrations: [],
    meetings: { folder: "08 Meetings", todos: "00 Planning/To-dos", today: "2026-10-23", interval: "weekly", day: "Thu" }, freeze,
  });
  const run = (m: Map<string, string>, c: TidyContext) => scan([...m.keys()].map(path => ({ path, text: wantsText(path, c, false) ? m.get(path) : undefined })), c).groups.find(g => g.id === "meeting-freeze");

  it("is off without the lists provider", () => { expect(run(vault(), make())).toBeUndefined(); });

  it("proposes the two older notes, not the newest, opt-in, and stamps the to-do once with the earliest date", () => {
    const g = run(vault(), make(() => flagged()))!;
    expect(g.optIn).toBe(true);
    const props = g.changes.filter(c => !c.body), bodies = g.changes.filter(c => c.body);
    expect(props.map(c => c.path)).toEqual(["08 Meetings/Weekly/2026-10-08 Weekly.md", "00 Planning/To-dos/Fix pump.md", "08 Meetings/Weekly/2026-10-15 Weekly.md"]);
    expect(g.changes.filter(c => c.path.includes("2026-10-22"))).toEqual([]);
    expect(bodies.map(c => c.path)).toEqual(["08 Meetings/Weekly/2026-10-08 Weekly.md", "08 Meetings/Weekly/2026-10-15 Weekly.md"]);
    expect(bodies[0].after).toContain("- [[Fix pump]]");
    expect(bodies[0].after).toContain("mine");
    expect(g.changes.find(c => c.path.includes("Fix pump"))!.after).toContain("raised_on: 2026-10-08");
  });

  it("applies with a backup of each note, and a second scan finds nothing", async () => {
    const m = vault(), c = make(() => flagged());
    const g = run(m, c)!;
    const backups = new Map<string, string>();
    const out = await applyTidy({ read: async p => m.get(p) ?? null, write: async (p, t) => { m.set(p, t); }, backup: async (p, t) => { backups.set(p, t); return `b/${p}`; },
      exists: p => m.has(p), filesIn: p => [p], linkedFrom: () => [], rename: async () => undefined, create: async () => undefined, settingSnapshot: () => "", setSetting: async () => null }, selectChanges({ groups: [g], reported: [] }, new Set(["meeting-freeze"])));
    expect(out.skipped).toEqual([]);
    expect([...backups.keys()].sort()).toEqual(["00 Planning/To-dos/Fix pump.md", "08 Meetings/Weekly/2026-10-08 Weekly.md", "08 Meetings/Weekly/2026-10-15 Weekly.md"]);
    expect(m.get("08 Meetings/Weekly/2026-10-08 Weekly.md")).toContain("frozen: 2026-10-23");
    expect(m.get("08 Meetings/Weekly/2026-10-22 Weekly.md")).toBe(meet("2026-10-22"));
    expect(m.get("00 Planning/To-dos/Fix pump.md")).toContain("raised_on: 2026-10-08");
    expect(run(m, c)).toBeUndefined();
  });

  it("leaves a one-off series alone", () => {
    const m = vault();
    m.set("08 Meetings/Weekly/Weekly.md", "---\nkind: meeting-series\ninterval: once\n---\n");
    expect(run(m, make(() => flagged()))).toBeUndefined();
  });
});

describe("Meeting template (I20)", () => {
  it("shows the Flagged list as a block, which Freeze and Unflag work on, not as a Dataview query", () => {
    const t = readFileSync("kits/planning/Extras/Templates/Meeting.md", "utf8");
    expect(t).toContain("show: meeting-flagged");
    expect(t).not.toContain("dataview");
    expect(freezeBody("> > ```vault-card\n> > show: meeting-flagged\n> > ```", { "meeting-flagged": ["- [[A]]"] })).toBe("> > - [[A]]");
  });
});

describe("plan-picture block in a frozen meeting note (plan-map Phase 3, Q5 a)", () => {
  const plan = readPlan(BIG_TODOS, BIG_HUB);
  const FIXTURE = [
    "- [[Book GPC time for diblocks]] · late: due 15 Oct · waiting: facility reply",
    "- [[Kinetics repeat at 80 C]] · late: due 14 Oct",
    "- [[SAXS beamtime proposal]] · waiting: panel decision",
    "- [[Supervisor review of draft]] · waiting: supervisor",
  ];
  it("the fixture's late and waiting to-dos, late first, then by name", () => {
    expect(pictureFreezeLines(plan, BIG_TODAY)).toEqual(FIXTURE);
  });
  it("nothing late or waiting: one line saying so", () => {
    const calm = readPlan(BIG_TODOS.map(t => ({ ...t, fm: { ...t.fm, due: undefined, waiting: undefined } })), BIG_HUB);
    expect(pictureFreezeLines(calm, BIG_TODAY)).toEqual(["Nothing is late or waiting."]);
  });
  const note = ["## Plan", "> [!note] Plan", "> ```vault-card", "> show: plan-picture", `> project: [[${BIG_TITLE}]]`, "> ```", "after"].join("\n");
  it("freezeBody puts the list where the block was (callout prefix kept); a project it cannot find leaves the block", () => {
    const pictures = (link: string): string[] | null => link === BIG_TITLE ? pictureFreezeLines(plan, BIG_TODAY) : null;
    expect(freezeBody(note, {}, pictures)).toBe(["## Plan", "> [!note] Plan", ...FIXTURE.map(l => `> ${l}`), "after"].join("\n"));
    expect(freezeBody(note.replace(BIG_TITLE, "Nope"), {}, pictures)).toBe(note.replace(BIG_TITLE, "Nope"));
    expect(freezeBody(note, {})).toBe(note);
  });
  it("meetingFreezeLists gives the pictures from the plan of the named hub", () => {
    const data = meetingFreezeLists({ fm: { since: "2026-10-13", date: "2026-10-20" }, todos: BIG_TODOS, hub: null, isFirst: false, planOf: link => link === BIG_TITLE ? plan : null }, new Date(`${BIG_TODAY}T12:00:00`))!;
    expect(data.pictures?.(BIG_TITLE)).toEqual(FIXTURE);
    expect(data.pictures?.("Nope")).toBeNull();
  });
});
