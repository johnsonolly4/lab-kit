// Phase 5b: meeting series (src/planning/meetings.ts). Dates worked out by hand from the 2026 / 2027 calendars:
// 1 Oct 2026 is a Thursday, 1 Nov 2026 a Sunday, 1 Dec 2026 a Tuesday, 1 Jan 2027 a Friday.
import { describe, it, expect } from "vitest";
import type { NoteRec } from "../src/planning/lists";
import { firstSeries, flaggedFor, nextDate, nextMeetingLines, nextMeetings, parseSeries, sinceLast, type Series } from "../src/planning/meetings";
import { ymd } from "../src/planning/todo";

const hub = (name: string, fm: Record<string, unknown>): NoteRec =>
  ({ path: `08 Meetings/${name}/${name}.md`, name, folder: `08 Meetings/${name}`, fm: { kind: "meeting-series", ...fm }, ctime: 0, mtime: 0 });
const read = (name: string, fm: Record<string, unknown>): Series => {
  const r = parseSeries(hub(name, fm));
  if (!("series" in r)) throw new Error(r.error);
  return r.series;
};
const d = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);
const next = (s: Series, from: Date): string => ymd(nextDate(s, from));

const weekly = read("Weekly meetings", { cadence: "weekly", day: "Thu", start: "2026-09-03" });
const fortnightly = read("Group meeting", { cadence: "fortnightly", day: "Thu", start: "2026-10-01" });
const monthly = read("Review", { cadence: "monthly", day: "Thu", start: "2026-10-08" });   // 2nd Thursday

describe("next meeting date", () => {
  it("weekly: today counts, otherwise the next Thursday", () => {
    expect(next(weekly, d(2026, 10, 8))).toBe("2026-10-08");   // a Thursday
    expect(next(weekly, d(2026, 10, 9))).toBe("2026-10-15");
  });

  it("weekly: across a month end and a year end", () => {
    expect(next(weekly, d(2026, 10, 30))).toBe("2026-11-05");   // Fri 30 Oct
    expect(next(weekly, d(2026, 12, 25))).toBe("2026-12-31");
    expect(next(weekly, d(2027, 1, 1))).toBe("2027-01-07");
  });

  it("fortnightly: every 14 days from the first meeting, across a month end and a year end", () => {
    // 1 Oct, 15 Oct, 29 Oct, 12 Nov, 26 Nov, 10 Dec, 24 Dec, 7 Jan
    expect(next(fortnightly, d(2026, 10, 2))).toBe("2026-10-15");
    expect(next(fortnightly, d(2026, 10, 29))).toBe("2026-10-29");
    expect(next(fortnightly, d(2026, 10, 30))).toBe("2026-11-12");
    expect(next(fortnightly, d(2026, 12, 25))).toBe("2027-01-07");
  });

  it("monthly: the same weekday of the month (2nd Thursday stays 2nd Thursday), across a month end and a year end", () => {
    expect(next(monthly, d(2026, 10, 9))).toBe("2026-11-12");   // Nov: Thursdays 5, 12
    expect(next(monthly, d(2026, 11, 13))).toBe("2026-12-10");   // Dec: Thursdays 3, 10
    expect(next(monthly, d(2026, 12, 11))).toBe("2027-01-14");   // Jan: Thursdays 7, 14
    expect(next(monthly, d(2026, 10, 31))).toBe("2026-11-12");
  });

  it("nothing before the first meeting; a start that is not the day moves to the next one", () => {
    expect(next(weekly, d(2026, 1, 1))).toBe("2026-09-03");
    expect(next(read("Late", { cadence: "weekly", day: "Fri", start: "2026-10-01" }), d(2026, 1, 1))).toBe("2026-10-02");
  });

  it("monthly 5th weekday becomes the last one in a short month", () => {
    const fifth = read("Fifth", { cadence: "monthly", day: "Thu", start: "2026-10-29" });   // 5th Thursday of October
    expect(next(fifth, d(2026, 10, 30))).toBe("2026-11-26");   // Nov has four Thursdays: the last
  });
});

describe("series hub", () => {
  it("names the field that is wrong", () => {
    const error = (fm: Record<string, unknown>): string => { const r = parseSeries(hub("S", fm)); return "error" in r ? r.error : ""; };
    expect(error({ day: "Thu", start: "2026-10-01" })).toMatch(/^cadence/);
    expect(error({ cadence: "daily", day: "Thu", start: "2026-10-01" })).toMatch(/^cadence/);
    expect(error({ cadence: "weekly", start: "2026-10-01" })).toMatch(/^day/);
    expect(error({ cadence: "weekly", day: "Thu" })).toMatch(/^start/);
    expect(error({ cadence: "weekly", day: "Thu", start: "soon" })).toMatch(/^start/);
    expect(error({ cadence: "Weekly", day: "thursday", start: "2026-10-01" })).toBe("");   // case and long day names are fine
  });
});

describe("since the last meeting", () => {
  it("the latest earlier meeting note of the series, else one cadence back", () => {
    expect(ymd(sinceLast(weekly, d(2026, 10, 15), [d(2026, 10, 1), d(2026, 10, 8), d(2026, 10, 15)]))).toBe("2026-10-08");
    expect(ymd(sinceLast(weekly, d(2026, 10, 15), []))).toBe("2026-10-08");
    expect(ymd(sinceLast(fortnightly, d(2026, 10, 15), []))).toBe("2026-10-01");
    expect(ymd(sinceLast(monthly, d(2026, 11, 12), []))).toBe("2026-10-15");
  });
});

describe("flagged to-dos", () => {
  const a = hub("Alpha", {}), b = hub("Beta", {});
  const todo = (name: string, meeting: unknown): NoteRec => ({ path: `00 Planning/To-dos/${name}.md`, name, folder: "00 Planning/To-dos", fm: { kind: "todo", meeting }, ctime: 0, mtime: 0 });
  const todos = [todo("old flag", true), todo("to alpha", "[[Alpha]]"), todo("to beta", "[[Beta]]"), todo("none", false), todo("empty", "")];

  it("a link counts for its series; the old true for the first series only", () => {
    expect(flaggedFor(todos, a, true).map(t => t.name)).toEqual(["old flag", "to alpha"]);
    expect(flaggedFor(todos, b, false).map(t => t.name)).toEqual(["to beta"]);
  });

  it("the first series is the first by name", () => {
    expect(firstSeries([{ name: "Beta" }, { name: "Alpha" }])?.name).toBe("Alpha");
  });
});

describe("next-meetings card", () => {
  it("soonest first, same day by name", () => {
    const rows = nextMeetings([monthly, fortnightly, weekly], d(2026, 10, 30));
    expect(rows.map(r => [r.name, ymd(r.date)])).toEqual([["Weekly meetings", "2026-11-05"], ["Group meeting", "2026-11-12"], ["Review", "2026-11-12"]]);
  });

  it("lines: weekday and date, how often; today says today", () => {
    const lines = nextMeetingLines(nextMeetings([weekly, monthly], d(2026, 11, 5)), d(2026, 11, 5));
    expect(lines.map(l => [l.text, l.badges.map(b => b.text)])).toEqual([["Weekly meetings", ["today", "weekly"]], ["Review", ["· Thu 12 Nov", "monthly"]]]);
  });
});
