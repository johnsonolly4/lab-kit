// Phase 5b: meeting series (src/planning/meetings.ts). Dates worked out by hand from the 2026 / 2027 calendars:
// 1 Oct 2026 is a Thursday, 1 Nov 2026 a Sunday, 1 Dec 2026 a Tuesday, 1 Jan 2027 a Friday.
import { describe, it, expect } from "vitest";
import type { NoteRec } from "../src/planning/lists";
import { checkFirstDate, checkSeriesName, cleanDeckPath, firstDefaultDate, firstSeries, flaggedFor, intervalWeeks, nextDate, nextMeetingLines, nextMeetings, parseInterval, parseSeries, sinceLast, WEEKDAYS, type Series } from "../src/planning/meetings";
import { readFileSync } from "fs";
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

const weekly = read("Weekly meetings", { interval: "weekly", day: "Thu", start: "2026-09-03" });
const fortnightly = read("Group meeting", { interval: "fortnightly", day: "Thu", start: "2026-10-01" });
const monthly = read("Review", { interval: "monthly", day: "Thu", start: "2026-10-08" });   // 2nd Thursday

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
    expect(next(read("Late", { interval: "weekly", day: "Fri", start: "2026-10-01" }), d(2026, 1, 1))).toBe("2026-10-02");
  });

  it("monthly 5th weekday becomes the last one in a short month", () => {
    const fifth = read("Fifth", { interval: "monthly", day: "Thu", start: "2026-10-29" });   // 5th Thursday of October
    expect(next(fifth, d(2026, 10, 30))).toBe("2026-11-26");   // Nov has four Thursdays: the last
  });
});

describe("series hub", () => {
  it("names the field that is wrong", () => {
    const error = (fm: Record<string, unknown>): string => { const r = parseSeries(hub("S", fm)); return "error" in r ? r.error : ""; };
    expect(error({ day: "Thu", start: "2026-10-01" })).toMatch(/^interval/);
    expect(error({ interval: "daily", day: "Thu", start: "2026-10-01" })).toMatch(/^interval/);
    expect(error({ interval: "weekly", start: "2026-10-01" })).toMatch(/^day/);
    expect(error({ interval: "weekly", day: "Thu" })).toMatch(/^start/);
    expect(error({ interval: "weekly", day: "Thu", start: "soon" })).toMatch(/^start/);
    expect(error({ interval: "Weekly", day: "thursday", start: "2026-10-01" })).toBe("");   // case and long day names are fine
  });
});

describe("since the last meeting", () => {
  it("the latest earlier meeting note of the series, else one interval back", () => {
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

describe("New meeting series: defaults and checks", () => {
  it("the first date offered is the next matching day (today counts)", () => {
    expect(ymd(firstDefaultDate(4, d(2026, 10, 8)))).toBe("2026-10-08");   // Thursday
    expect(ymd(firstDefaultDate(4, d(2026, 10, 9)))).toBe("2026-10-15");
    expect(ymd(firstDefaultDate(0, d(2026, 12, 29)))).toBe("2027-01-03");   // Sunday, over the year end
  });

  it("a name keeps to what a folder can be called", () => {
    expect(checkSeriesName(" Group: meeting? ")).toEqual({ name: "Group- meeting-" });
    expect(checkSeriesName("..hidden")).toEqual({ name: "hidden" });
    expect(checkSeriesName("  ")).toHaveProperty("error");
    expect(checkSeriesName("...")).toHaveProperty("error");
  });

  it("the first date must be a real day on the chosen weekday", () => {
    expect(checkFirstDate("2026-10-15", 4)).toHaveProperty("date");
    expect(checkFirstDate("2026-10-14", 4)).toEqual({ error: "2026-10-14 is a Wed, not a Thu." });
    expect(checkFirstDate("2026-02-30", 4)).toHaveProperty("error");
    expect(checkFirstDate("15 Oct", 4)).toHaveProperty("error");
  });

  it("a pasted deck path loses the quotes Copy as path adds", () => {
    expect(cleanDeckPath(' "C:\\Decks\\a.pptx" ')).toBe("C:\\Decks\\a.pptx");
    expect(cleanDeckPath("")).toBe("");
  });
});

describe("New meeting series: the template's hub note reads back", () => {
  /** The template's front matter with its <% vt.x %> places filled as Templater would. */
  const render = (vt: Record<string, string>): Record<string, string> => {
    const raw = readFileSync("kits/planning/Extras/Templates/Meeting series.md", "utf8");
    const front = /^---\n([\s\S]*?)\n---$/m.exec(raw.slice(raw.indexOf("-%>")))![1];
    const out: Record<string, string> = {};
    for (const line of front.split("\n")) {
      const m = /^(\w+):[ \t]*(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/<% vt\.(\w+) %>/g, (_, k) => vt[k]).replace(/<% deck\("(\w+)"\) %>/, (_, k) => JSON.stringify(k === vt.deckKey ? vt.deck : ""));
    }
    return out;
  };

  it("the same name, interval, day and start; the next date is the chosen first date", () => {
    for (const [interval, day, start] of [["weekly", "Thu", "2026-10-15"], ["fortnightly", "Mon", "2026-10-12"], ["monthly", "Wed", "2026-10-14"]]) {
      const fm = render({ name: "Group meeting", folder: "08 Meetings/Group meeting", interval, day, start, deckKey: "deck_mac", deck: "/Users/x/deck.pptx" });
      expect(fm).toMatchObject({ kind: "meeting-series", deck_windows: '""', deck_mac: '"/Users/x/deck.pptx"' });
      const s = read("Group meeting", fm);
      expect(s).toMatchObject({ name: "Group meeting", interval, start: d(...(start.split("-").map(Number) as [number, number, number])) });
      expect(WEEKDAYS[s.day]).toBe(day);
      expect(next(s, d(2026, 10, 1))).toBe(start);
    }
  });
});

describe("every N weeks and one-off hubs", () => {
  const every3 = read("Quarter", { interval: "every 3 weeks", day: "Thu", start: "2026-10-01" });
  it("reads every N weeks (case, singular and the range), and nothing else", () => {
    expect(parseInterval("Every 3 weeks")).toBe("every 3 weeks");
    expect(parseInterval("every 1 week")).toBe("every 1 weeks");
    expect(parseInterval("every 52 weeks")).toBe("every 52 weeks");
    for (const bad of ["every 0 weeks", "every 53 weeks", "every weeks", "every 3 days", "daily", ""]) expect(parseInterval(bad), bad).toBeNull();
    expect(parseInterval("once")).toBe("once");
    expect([intervalWeeks("weekly"), intervalWeeks("fortnightly"), intervalWeeks("every 6 weeks"), intervalWeeks("monthly"), intervalWeeks("once")]).toEqual([1, 2, 6, null, null]);
  });
  it("counts N weeks from the first meeting, today counting", () => {
    expect(next(every3, d(2026, 9, 1))).toBe("2026-10-01");   // before the first meeting
    expect(next(every3, d(2026, 10, 1))).toBe("2026-10-01");
    expect(next(every3, d(2026, 10, 2))).toBe("2026-10-22");
    expect(next(every3, d(2026, 10, 22))).toBe("2026-10-22");
    expect(next(every3, d(2026, 10, 23))).toBe("2026-11-12");
  });
  it("looks N weeks back when the series has no earlier meeting", () => {
    expect(ymd(sinceLast(every3, d(2026, 10, 22), []))).toBe("2026-10-01");
  });
  it("names the allowed intervals when a hub's is wrong", () => {
    const r = parseSeries(hub("X", { interval: "daily", day: "Thu", start: "2026-10-01" }));
    expect("error" in r && r.error).toContain("every N weeks");
  });
  it("a once hub needs no day or start and is left out of Next meetings", () => {
    const once = read("One-off", { interval: "once" });
    expect(once.interval).toBe("once");
    expect(nextMeetings([once, weekly], d(2026, 10, 9)).map(n => n.name)).toEqual(["Weekly meetings"]);
  });
});
