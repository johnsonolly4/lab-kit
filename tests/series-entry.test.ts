// New meeting series in the entry window (src/planning/series-entry.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readSeries, seriesFields } from "../src/planning/series-entry";
import { missingRequired } from "../src/planning/entry-fields";

const none = () => false;
const ok = { interval: "weekly", date: "2026-10-15" };   // a Thursday

describe("readSeries", () => {
  it("the name, interval, the weekday of the first date as the day, and the cleaned deck and template", () => {
    expect(readSeries(" Group meeting ", { ...ok, deck: '"C:\\Decks"', template: "[[My meeting.md]]" }, none))
      .toEqual({ name: "Group meeting", interval: "weekly", day: 4, start: "2026-10-15", deck: "C:\\Decks", template: "My meeting" });
    expect(readSeries("G", { interval: "monthly", date: "2026-10-18" }, none)).toMatchObject({ day: 0, interval: "monthly", deck: "", template: "" });
  });
  it("a bare number of weeks is 'every N weeks'; 0, 53 and words are refused", () => {
    expect(readSeries("G", { ...ok, interval: "5" }, none)).toMatchObject({ interval: "every 5 weeks" });
    expect(readSeries("G", { ...ok, interval: "every 3 weeks" }, none)).toMatchObject({ interval: "every 3 weeks" });
    for (const bad of ["0", "53", "sometimes", ""]) expect(readSeries("G", { ...ok, interval: bad }, none)).toHaveProperty("error");
  });
  it("asks for a name, refuses a taken one, and needs a real first date", () => {
    expect(readSeries("  ", ok, none)).toHaveProperty("error");
    expect(readSeries("Group meeting", ok, n => n === "Group meeting")).toEqual({ error: "A meeting series called Group meeting already exists. Choose another name." });
    expect(readSeries("G", { interval: "weekly" }, none)).toEqual({ error: "Pick the date of the first meeting." });
  });
});

describe("seriesFields", () => {
  it("How often and First meeting are required, Deck and Note template are text, How often takes a typed number", () => {
    const f = seriesFields("this Mac");
    expect(f.map(x => `${x.key}:${x.kind}`)).toEqual(["interval:pick", "date:date", "deck:text", "template:text"]);
    expect(missingRequired(f, {})?.key).toBe("interval");
    expect(missingRequired(f, ok)).toBeNull();
    expect(f[0].allowNew).toBe(true);
    expect(f[2].prompt).toContain("this Mac");
  });
  it("New meeting series opens the window with weekly and a week from today, and checks the answer before it closes", () => {
    const src = readFileSync("src/planning/commands.ts", "utf8");
    const fn = src.slice(src.indexOf("async newSeries"));
    expect(fn).toContain('openEntry(this.app, "New meeting series", seriesFields(where)');
    expect(fn).toContain('values: { interval: "weekly", date: ymd(dayOf(new Date(), 7)) }');
    expect(fn).toContain("validate:");
  });
});
