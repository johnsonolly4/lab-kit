// Meeting notes without Templater (Phase 4): the token templates give the texts the old Templater ones gave (tests/fixtures/meeting-expected.ts, checked against the
// old files in tests/meeting-old-templates.test.ts), byte for byte.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEETING_TEMPLATE, ONE_OFF_TEMPLATE, SERIES_TEMPLATE, createMadeNote, isFirstSeries, isTokenTemplate, madeNote, meetingAnswers, seriesAnswers, tokenTemplate } from "../src/planning/meeting-note";
import { expectedMeeting, expectedOneOff, expectedSeries, meetingName } from "./fixtures/meeting-expected";
import { miniYaml } from "./token-snippets";

const kit = (n: string): string => readFileSync(`kits/planning/Extras/Templates/${n}.md`, "utf8");
const NOW = new Date(2026, 9, 21);
const folder = "00 Planning/Meetings/Group meeting";
const weekly = { series: "Group meeting", date: "2026-10-22", since: "2026-10-15" };
const fortnightly = { series: "Journal club", date: "2026-10-22", since: "2026-10-08" };
const extra = { series: "Group meeting", date: "2026-10-21", since: "2026-10-15" };
const oneOff = { series: "One-off", date: "2026-10-23", since: "2026-10-16", title: "Cell line review", project: "Alpha" };
const make = (tpl: string, c: { series: string; date: string; since: string; title?: string; project?: string; first?: boolean }) => madeNote(tpl, miniYaml, meetingAnswers({ ...c, folder }), NOW, "", "");

describe("the bundled templates are the kit files", () => {
  it("equal text", () => {
    expect(MEETING_TEMPLATE).toBe(kit("Meeting"));
    expect(ONE_OFF_TEMPLATE).toBe(kit("One-off meeting"));
    expect(SERIES_TEMPLATE).toBe(kit("Meeting series"));
  });
});

describe.each([["the kit file", (n: string) => kit(n)], ["the bundled text", (n: string) => ({ Meeting: MEETING_TEMPLATE, "One-off meeting": ONE_OFF_TEMPLATE, "Meeting series": SERIES_TEMPLATE })[n]!]])("meeting notes: %s", (_l, get) => {
  it("Meeting: weekly, every 2 weeks, extra meeting now", () => {
    for (const c of [weekly, fortnightly, extra]) {
      const m = make(get("Meeting"), c);
      expect(m.text).toBe(expectedMeeting(c));
      expect(m.name).toBe(meetingName(c));
      expect(m.folder).toBe(folder);
    }
  });
  it("One-off meeting: with and without a project, first series or not", () => {
    for (const c of [{ ...oneOff, first: false }, { ...oneOff, first: true }, { ...oneOff, project: undefined, first: true }]) {
      const m = make(get("One-off meeting"), c);
      expect(m.text, JSON.stringify(c)).toBe(expectedOneOff(c));
      expect(m.name).toBe(meetingName(c));
    }
  });
  it("Meeting series: this computer's deck key, a quote and a backslash in the path, a template name", () => {
    for (const c of [
      { name: "Group meeting", folder, interval: "weekly", day: "Thu", start: "2026-10-22", deckKey: "deck_mac" as const, deck: "/Users/x/Decks/group.pptx" },
      { name: "Journal club", folder: "00 Planning/Meetings/Journal club", interval: "every 2 weeks", day: "Wed", start: "2026-10-21", deckKey: "deck_windows" as const, deck: "C:\\Decks\\jc \"v2\".pptx", template: "My meeting" },
      { name: "One-off", folder: "00 Planning/Meetings/One-off", interval: "once", day: "Mon", start: "2026-10-23", deckKey: "deck_windows" as const, deck: "" },
    ]) {
      const m = madeNote(get("Meeting series"), miniYaml, seriesAnswers(c), NOW, "", "");
      expect(m.text, c.name).toBe(expectedSeries(c));
      expect([m.name, m.folder]).toEqual([c.name, c.folder]);
    }
  });
});

describe("meeting-note: helpers", () => {
  it("a token template is told from an old Templater one", () => {
    expect(isTokenTemplate(kit("Meeting"), miniYaml)).toBe(true);
    expect(isTokenTemplate(readFileSync("tests/fixtures/templates/old/Meeting.md", "utf8"), miniYaml)).toBe(false);
    expect(isTokenTemplate(null, miniYaml)).toBe(false);
    expect(tokenTemplate(readFileSync("tests/fixtures/templates/old/Meeting.md", "utf8"), MEETING_TEMPLATE, miniYaml)).toBe(MEETING_TEMPLATE);
    expect(tokenTemplate("---\nmake: note\n---\n---\nkind: meeting\n---\n", MEETING_TEMPLATE, miniYaml)).toContain("kind: meeting");
  });
  it("the first series by name (the One-off hub counts, as the old template read them); none yet counts as first", () => {
    const s = (name: string, interval = "weekly") => ({ name, interval }) as never;
    expect(isFirstSeries([s("Journal club"), s("Group meeting"), s("A one", "once")], "Group meeting")).toBe(false);
    expect(isFirstSeries([s("Journal club"), s("Group meeting"), s("One-off", "once")], "Group meeting")).toBe(true);
    expect(isFirstSeries([s("Journal club"), s("Group meeting")], "Journal club")).toBe(false);
    expect(isFirstSeries([], "x")).toBe(true);
  });
  it("a taken name gets 2, 3 (the old unused-name loop); the note is made in the folder", async () => {
    const taken = new Set([`${folder}/2026-10-22 Group meeting.md`, `${folder}/2026-10-22 Group meeting 2.md`]);
    const created: { path: string; text: string }[] = [];
    const vault = { getAbstractFileByPath: (p: string) => (taken.has(p) ? {} : null), create: async (path: string, text: string) => { created.push({ path, text }); return { path }; } };
    await createMadeNote(vault as never, MEETING_TEMPLATE, miniYaml, meetingAnswers({ ...weekly, folder }), NOW, "", "");
    expect(created).toHaveLength(1);
    expect(created[0].path).toBe(`${folder}/2026-10-22 Group meeting 3.md`);
    expect(created[0].text).toBe(expectedMeeting(weekly));
  });
  it("a template of your own without name or folder in its header: the date and label, and the series' folder", async () => {
    const own = "---\nmake: note\n---\n---\nkind: meeting\nseries: \"[[{{series}}]]\"\n---\nMine {{note-name}}\n";
    const created: { path: string; text: string }[] = [];
    const vault = { getAbstractFileByPath: () => null, create: async (path: string, text: string) => { created.push({ path, text }); return { path }; } };
    await createMadeNote(vault as never, own, miniYaml, meetingAnswers({ ...weekly, folder }), NOW, meetingName(weekly), folder);
    expect(created[0]).toEqual({ path: `${folder}/2026-10-22 Group meeting.md`, text: `---\nkind: meeting\nseries: "[[Group meeting]]"\n---\nMine 2026-10-22 Group meeting\n` });
  });
});
