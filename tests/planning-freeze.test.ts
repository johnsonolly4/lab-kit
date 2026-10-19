// I19 / I20: freezing a meeting note (src/planning/freeze.ts), against a fixture note.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { flaggedLines, freezeBody, freezeMeeting, frozenOn, lineMarkdown, meetingFreezeLists, raisedStamp, type FreezeLists } from "../src/planning/freeze";
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
