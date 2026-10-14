// New meeting / New extra meeting in the entry window (src/planning/meeting-entry.ts).
import { describe, it, expect } from "vitest";
import { followSeries, meetingFields, meetingStart, ONE_OFF, readMeeting } from "../src/planning/meeting-entry";
import { entryResult, missingRequired, visibleFields } from "../src/planning/entry-fields";
import type { Series } from "../src/planning/meetings";

const mk = (name: string, interval: string, start = new Date(2026, 9, 15)): Series => ({ name, path: `Meetings/${name}/${name}.md`, folder: `Meetings/${name}`, interval: interval as Series["interval"], day: 4, start, template: "" });
const group = mk("Group", "weekly");
const sub = mk("Subgroup", "fortnightly");
const once = mk("One-off", "once");
const today = new Date(2026, 9, 20);   // a Tuesday; the next Thursday is 22 October

describe("meetingFields", () => {
  it("New meeting: Series lists the regular series and One-off; Project shows only for One-off", () => {
    const f = meetingFields([group, sub, once], false, ["Alpha"]);
    expect(f.find(x => x.key === "series")!.options!.map(o => o.label)).toEqual(["Group", "Subgroup", "One-off"]);
    expect(visibleFields(f, { series: "Group" }).map(x => x.key)).toEqual(["series", "date"]);
    expect(visibleFields(f, { series: ONE_OFF }).map(x => x.key)).toEqual(["series", "date", "project"]);
    expect(visibleFields(f, {}).map(x => x.key)).toEqual(["series", "date"]);
  });
  it("New extra meeting: no One-off and no Project", () => {
    const f = meetingFields([group, once], true, ["Alpha"]);
    expect(f.map(x => x.key)).toEqual(["series", "date"]);
    expect(f[0].options!.map(o => o.label)).toEqual(["Group"]);
  });
  it("Series and Date are required; a Project of a regular series is dropped from the result", () => {
    const f = meetingFields([group, sub], false, ["Alpha"]);
    expect(missingRequired(f, {})!.key).toBe("series");
    expect(missingRequired(f, { series: "Group" })!.key).toBe("date");
    expect(entryResult(f, { series: "Group", date: "2026-10-22", project: "Alpha" })).toEqual({ series: "Group", date: "2026-10-22" });
  });
});

describe("dates and start values", () => {
  it("a regular series suggests its next meeting; an extra meeting and a one-off suggest today", () => {
    expect(meetingStart([group, sub], false, today, "")).toEqual({ date: "2026-10-20" });   // two series: nothing picked yet
    expect(meetingStart([group], false, today, "")).toEqual({ series: "Group", date: "2026-10-22" });   // the only series is preselected
    expect(meetingStart([group], true, today, "")).toEqual({ series: "Group", date: "2026-10-20" });
    expect(meetingStart([once], false, today, "Alpha")).toEqual({ series: ONE_OFF, date: "2026-10-20", project: "Alpha" });
  });
  it("picking a series moves the date to its suggestion; picking One-off goes to today; other chips leave it", () => {
    expect(followSeries([group, sub], false, { series: "Subgroup", date: "2026-10-20" }, "series", today).date).toBe("2026-10-29");   // fortnightly from 15 Oct: 15, 29
    expect(followSeries([group], false, { series: ONE_OFF, date: "2026-10-22" }, "series", today).date).toBe("2026-10-20");
    expect(followSeries([group], false, { series: "Group", date: "2026-11-01" }, "date", today).date).toBe("2026-11-01");
  });
});

describe("readMeeting", () => {
  it("a regular series, a one-off with title and project, and the errors", () => {
    expect(readMeeting([group], "", { series: "Group", date: "2026-10-22" })).toEqual({ oneOff: false, series: group, date: "2026-10-22" });
    expect(readMeeting([group], "Kick-off", { series: ONE_OFF, date: "2026-10-22", project: "Alpha" })).toEqual({ oneOff: true, date: "2026-10-22", project: "Alpha", title: "Kick-off" });
    expect(readMeeting([group], "", { series: "Group", date: "tomorrow" })).toHaveProperty("error");
    expect(readMeeting([group], "", { series: "Gone", date: "2026-10-22" })).toHaveProperty("error");
  });
});
