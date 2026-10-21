// The old Templater meeting templates (tests/fixtures/templates/old/) and the texts they give, written out by hand (tests/fixtures/meeting-expected.ts).
// The `<% expr %>` tags are run here with the values the template's code block works out (what Templater does after `-%>`), so the hand-written
// texts are checked against the real old files and the token templates (tests/meeting-note.test.ts) against the same texts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectedMeeting, expectedOneOff, expectedSeries, meetingName } from "./fixtures/meeting-expected";

const old = (name: string): string => readFileSync(`tests/fixtures/templates/old/${name}.md`, "utf8");
/** Templater's output after the `<%* ... -%>` code block (its `-%>` trims one line break), with each `<% expr %>` evaluated against `scope`. */
function runOld(name: string, scope: Record<string, unknown>): string {
  const body = old(name).split("-%>\n")[1];
  return body.replace(/<%\s*([\s\S]*?)\s*%>/g, (_m, expr: string) => String(new Function(...Object.keys(scope), `return (${expr});`)(...Object.values(scope))));
}

const weekly = { series: "Group meeting", date: "2026-10-22", since: "2026-10-15" };
const fortnightly = { series: "Journal club", date: "2026-10-22", since: "2026-10-08" };
const oneOff = { series: "One-off", date: "2026-10-23", since: "2026-10-16", title: "Cell line review", project: "Alpha" };
const meetingScope = (c: { series: string; date: string; since: string; project?: string }): Record<string, unknown> => ({ vt: { project: c.project }, series: c.series, date: c.date, since: c.since });

describe("old meeting templates: the hand-written expected texts", () => {
  it("the fixtures are the Templater files", () => {
    for (const n of ["Meeting", "One-off meeting", "Meeting series"]) expect(old(n), n).toContain("<%*");
  });
  it("Meeting: weekly, every 2 weeks, and an extra meeting now (the day it is made, since the last one held)", () => {
    expect(runOld("Meeting", meetingScope(weekly))).toBe(expectedMeeting(weekly));
    expect(runOld("Meeting", meetingScope(fortnightly))).toBe(expectedMeeting(fortnightly));
    const extra = { series: "Group meeting", date: "2026-10-21", since: "2026-10-15" };
    expect(runOld("Meeting", meetingScope(extra))).toBe(expectedMeeting(extra));
  });
  it("One-off meeting: with a project, without one, first series by name or not", () => {
    for (const c of [{ ...oneOff, first: false }, { ...oneOff, first: true }, { ...oneOff, project: undefined, first: true }]) {
      expect(runOld("One-off meeting", { ...meetingScope(c), first: c.first }), JSON.stringify(c)).toBe(expectedOneOff(c));
    }
  });
  it("Meeting series: the deck sits under this computer's key; template is JSON", () => {
    for (const c of [
      { name: "Group meeting", folder: "00 Planning/Meetings/Group meeting", interval: "weekly", day: "Thu", start: "2026-10-22", deckKey: "deck_mac" as const, deck: "/Users/x/Decks/group.pptx" },
      { name: "Journal club", folder: "00 Planning/Meetings/Journal club", interval: "every 2 weeks", day: "Wed", start: "2026-10-21", deckKey: "deck_windows" as const, deck: "C:\\Decks\\jc \"v2\".pptx", template: "My meeting" },
    ]) {
      const deck = (key: string): string => JSON.stringify(key === c.deckKey ? c.deck : "");
      expect(runOld("Meeting series", { vt: { ...c, template: c.template }, deck }), c.name).toBe(expectedSeries(c));
    }
  });
  it("the old name rule: date + title or series, then 2, 3 while taken", () => {
    expect(meetingName(weekly)).toBe("2026-10-22 Group meeting");
    expect(meetingName(oneOff, 2)).toBe("2026-10-23 Cell line review 2");
  });
});
