// New to-do: a due date typed as words (vtAsk.parseDue in the planning kit's script), and the template using it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const vtAsk = createRequire(import.meta.url)("../kits/planning/Extras/scripts/templater/vault/vtAsk.js") as { parseDue(t: string, now: Date): string | null };
const WED = new Date(2026, 9, 7, 15, 30);   // Wed 2026-10-07, mid-afternoon
const at = (text: string, now = WED) => vtAsk.parseDue(text, now);

describe("parseDue", () => {
  it("today and tomorrow", () => {
    expect(at("today")).toBe("2026-10-07");
    expect(at("tomorrow")).toBe("2026-10-08");
  });
  it("a weekday is that day this week (today counts), else next week's", () => {
    expect(at("fri")).toBe("2026-10-09");
    expect(at("wed")).toBe("2026-10-07");
    expect(at("sunday")).toBe("2026-10-11");
    expect(at("mon")).toBe("2026-10-12");
  });
  it("next <weekday> is that day in the week after this one", () => {
    expect(at("next fri")).toBe("2026-10-16");
    expect(at("next mon")).toBe("2026-10-12");
    expect(at("next wed")).toBe("2026-10-14");
  });
  it("short forms, capitals and spaces", () => {
    expect(at("Tues")).toBe("2026-10-13");
    expect(at("THURS")).toBe("2026-10-08");
    expect(at("thur")).toBe("2026-10-08");
    expect(at("  Next   Friday ")).toBe("2026-10-16");
  });
  it("crosses a month and a year", () => {
    expect(at("fri", new Date(2026, 11, 30))).toBe("2027-01-01");
    expect(at("next mon", new Date(2026, 11, 30))).toBe("2027-01-04");
  });
  it("weeks start on Monday: on a Sunday, sun is today and mon is tomorrow", () => {
    const sun = new Date(2026, 9, 11);
    expect(at("sun", sun)).toBe("2026-10-11");
    expect(at("mon", sun)).toBe("2026-10-12");
    expect(at("next mon", sun)).toBe("2026-10-12");
  });
  it("keeps a real YYYY-MM-DD and refuses anything else", () => {
    expect(at("2026-11-02")).toBe("2026-11-02");
    expect(at("2026-02-30")).toBeNull();
    for (const bad of ["", "soon", "next", "fri next", "next week", "2026-1-2", "monday morning"]) expect(at(bad)).toBeNull();
  });
});

describe("To-do template", () => {
  const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
  it("asks with the words and uses parseDue, falling back to YYYY-MM-DD when the script is old", () => {
    expect(tpl).toContain("tp.user.vtAsk.parseDue");
    expect(tpl).toContain("today, tomorrow, fri, next mon");
    expect(tpl).toMatch(/parseDue \? parseDue\(d, new Date\(\)\) : /);
  });
});
