// New to-do: a due date typed as words (vtAsk.parseDue in the planning kit's script), and the template using it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseDue as parseDueTs } from "../src/planning/due-words";

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
    for (const bad of ["", "soon", "next", "fri next", "next weeks", "2026-1-2", "monday morning"]) expect(at(bad)).toBeNull();
  });
});

// One table for both copies (the script the template runs, and the plugin's TypeScript): WED = Wed 2026-10-07.
const TABLE: [string, string | null][] = [
  ["15 nov", "2026-11-15"], ["nov 15", "2026-11-15"], ["15th november", "2026-11-15"], ["Nov 15th", "2026-11-15"], ["15 nov 2027", "2027-11-15"], ["sept 3", "2027-09-03"],
  ["7 oct", "2026-10-07"], ["6 oct", "2027-10-06"], ["29 feb", "2028-02-29"], ["31 apr", null], ["15 foo", null], ["15 ma", null],
  ["3/11", "2026-11-03"], ["15/11", "2026-11-15"], ["15/11/2026", "2026-11-15"], ["15/11/26", "2026-11-15"], ["11/15", null], ["30/02", null], ["1/1", "2027-01-01"],
  ["in 3 days", "2026-10-10"], ["in 1 day", "2026-10-08"], ["in 2 weeks", "2026-10-21"], ["in days", null],
  ["next week", "2026-10-12"], ["next month", "2026-11-01"],
  ["today", "2026-10-07"], ["fri", "2026-10-09"], ["next fri", "2026-10-16"], ["2026-11-02", "2026-11-02"], ["2026-02-30", null], ["soon", null], ["", null],
];
describe("due words: the script and the plugin's copy agree", () => {
  for (const [text, want] of TABLE) it(`"${text}" → ${want}`, () => {
    expect(at(text)).toBe(want);
    expect(parseDueTs(text, WED)).toBe(want);
  });
  it("next month from December goes to January", () => {
    expect(at("next month", new Date(2026, 11, 20))).toBe("2027-01-01");
    expect(parseDueTs("next month", new Date(2026, 11, 20))).toBe("2027-01-01");
  });
});

describe("To-do template", () => {
  const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
  it("asks nothing when the plugin's entry window handed the values over (window.vtTodo), and writes the chip bar block", () => {
    expect(tpl).toContain("const preset = window.vtTodo;");
    expect(tpl).toContain("preset ? preset.text : await tp.user.vtAsk");
    expect(tpl).toContain("if (!project && !preset) {");
    expect(tpl).toContain("while (!preset) {");
    expect(tpl).toContain("const pr = preset ? preset.priority : await");
    expect(tpl).toMatch(/\n---\n\n```vault-card\nshow: todo-bar\n```\n/);
  });
  it("asks with the words and uses parseDue, falling back to YYYY-MM-DD when the script is old", () => {
    expect(tpl).toContain("tp.user.vtAsk.parseDue");
    expect(tpl).toContain("today, tomorrow, fri, next mon");
    expect(tpl).toMatch(/parseDue \? parseDue\(d, new Date\(\)\) : /);
  });
  it("asks the priority with a text hint (Esc cancels), sets a number property, writes it after countdown", () => {
    expect(tpl).toContain('["No priority", "1 - high", "2 - medium", "3 - low"], ["", 1, 2, 3]');
    expect(tpl).toContain('setType?.("priority", "number")');
    expect(tpl).toContain("Cancelled - no priority choice");
    expect(tpl).toMatch(/^countdown: <% countdown %>\npriority: <% priority %>\n/m);
  });
  it("asks Comes after? only for a project with open to-dos (Esc = nothing) and writes after only when picked", () => {
    expect(tpl).toContain('["(nothing)", ...open], ["", ...open]');
    expect(tpl).toContain("Comes after? (optional: pick (nothing) to skip)");
    expect(tpl).toContain("if (project && !preset) {");
    expect(tpl).toContain("if (open.length) {");
    expect(tpl).toContain("after = before || \"\";");
    expect(tpl).toMatch(/^priority: <% priority %>\n<% after \? `after: "\[\[\$\{after\}\]\]"\\n` : "" -%>\n/m);
  });
  it("reads a project link written as [[Name]], [[Folder/Name|alias]] or [[Name#h]]", () => {
    const src = tpl.match(/const linkName = (.+);\n/)![1];
    const linkName = new Function(`return (${src});`)() as (v: unknown) => string | undefined;
    expect(linkName("[[Alpha]]")).toBe("Alpha");
    expect(linkName("[[02 Projects/Alpha/Alpha|the project]]")).toBe("Alpha");
    expect(linkName("[[Alpha#Goal]]")).toBe("Alpha");
    expect(linkName("")).toBeUndefined();
  });
});
