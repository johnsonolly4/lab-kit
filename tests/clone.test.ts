// Clone experiment text rules (src/kit/clone.ts): numbering, the properties that start again, the free text that is cleared, the sample codes.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cloneLabNote, labNoteName, labPrefix, labTitle, localDate, nextLabNumber } from "../src/kit/clone";

const source = readFileSync("tests/fixtures/lab-notes/clone-source.md", "utf8");
const OPTS = { oldPrefix: "ABC0014-", newPrefix: "ABC0015-", today: "2026-10-13" };
const clone = (text = source) => cloneLabNote(text, OPTS);

describe("nextLabNumber", () => {
  it("is the highest number in the folder plus one, 4 digits", () => {
    expect(nextLabNumber(["ABC0013 - a", "ABC0014 - b", "Home"], "ABC")).toBe("0015");
    expect(nextLabNumber(["0099 - old", "ABC0003 - new"], "ABC")).toBe("0100");
  });
  it("starts at 0001 for an empty folder or names without a number", () => {
    expect(nextLabNumber([], "ABC")).toBe("0001");
    expect(nextLabNumber(["Readme"], "ABC")).toBe("0001");
  });
  it("ignores another person's initials followed by digits only when they do not start the name", () => {
    expect(nextLabNumber(["XYZ0020 - other"], "ABC")).toBe("0001");
  });
  it("uses the rule written in the old Templater Lab Book Template (kept as a fixture)", () => {
    const template = readFileSync("tests/fixtures/templates/old/Lab Book Template.md", "utf8");
    expect(template).toContain("const numbered = new RegExp(`^(?:${initials.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\")})?(\\\\d+)`);");
    expect(template).toContain('String(Math.max(0, ...nums) + 1).padStart(4, "0")');
    expect(template).toContain('.replace(/[\\\\/:*?"<>|]/g, "-")');
  });
});

describe("labNoteName and labPrefix", () => {
  it("builds the name and replaces characters a file name cannot hold", () => {
    expect(labNoteName("ABC", "0015", "Flow: 50/50 mix")).toBe("ABC0015 - Flow- 50-50 mix");
    expect(labNoteName("ABC", "0015", "  ")).toBe("ABC0015 - Untitled");
  });
  it("reads the sample-code prefix from a note name", () => {
    expect(labPrefix("ABC0014 - RAFT test")).toBe("ABC0014-");
    expect(labPrefix("0014 - RAFT test")).toBe("0014-");
    expect(labPrefix("Home")).toBeNull();
  });
});

describe("labTitle", () => {
  it("gives the title part of a lab note's name", () => {
    expect(labTitle("ABC0014 - RAFT test")).toBe("RAFT test");
    expect(labTitle("0014 - RAFT test - run 2")).toBe("RAFT test - run 2");
    expect(labTitle("Home")).toBe("Home");
    expect(labTitle("ABC0014")).toBe("ABC0014");
  });
});

describe("localDate", () => {
  it("writes the local date, padded", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(localDate(new Date(2026, 9, 13, 0, 5))).toBe("2026-10-13");
  });
});

describe("cloneLabNote", () => {
  it("starts the run properties again and keeps the set-up", () => {
    const t = clone().text;
    expect(t).toContain("Status: Planned\n");
    expect(t).toContain("Plan date: 2026-10-13\n");
    expect(t).toMatch(/\nExp\. Start:\n/);
    expect(t).not.toContain("Exp. End");   // retired: the clone neither writes nor resets it
    expect(t).toMatch(/\nOutcome:\n/);
    expect(t).not.toContain("Worked, Mn");
    for (const kept of ["Type: Experiment", "Exp. Class: Flow RAFT", 'Rig: "[[Rig one]]"', "CoSHH: C-12", "RA: RA-7", "Objective: Test the reactor", '  - "[[Styrene]]"', '  - "[[AIBN]]"', "  - vt"])
      expect(t).toContain(kept);
    expect(t).toContain("Run styrene at three residence times.");
    expect(t).toContain("1. Prime the pumps.");
  });
  it("adds a link back to the note it was cloned from, as the last property", () => {
    const t = cloneLabNote(source, { ...OPTS, clonedFrom: "ABC0014 - RAFT test" }).text;
    expect(t).toContain('  - vt\nCloned from: "[[ABC0014 - RAFT test]]"\n---\n');
    expect(t.match(/^Cloned from:/gm)?.length).toBe(1);
  });
  it("a clone of a clone points at its own source, not at the first one", () => {
    const first = cloneLabNote(source, { ...OPTS, clonedFrom: "ABC0014 - A" }).text;
    const second = cloneLabNote(first, { oldPrefix: "ABC0015-", newPrefix: "ABC0016-", today: "2026-10-14", clonedFrom: "ABC0015 - A" }).text;
    expect(second.match(/^Cloned from:/gm)?.length).toBe(1);
    expect(second).toContain('Cloned from: "[[ABC0015 - A]]"');
  });
  it("adds no link without a name or without properties", () => {
    expect(clone().text).not.toContain("Cloned from");
    expect(cloneLabNote("# ⚗️ Procedure\n", { ...OPTS, clonedFrom: "X" }).text).toBe("# ⚗️ Procedure\n");
  });
  it("renumbers this note's sample codes in tables and text, and leaves other notes' codes alone", () => {
    const r = clone();
    expect(r.text).toContain("| ABC0015-A30 | 10:30 |");
    expect(r.text).toContain("2. Collect ABC0015-A and ABC0015-B.");
    expect(r.text).toContain("| ABC0013-A | 09:00 |");
    expect(r.text).not.toContain("ABC0014-");
    expect(r.recoded).toBe(5);
  });
  it("clears the free text of Results / Analysis but keeps its headings, tables, code blocks and checklist, unticked", () => {
    const t = clone().text;
    expect(t).not.toContain("Conversion looked good");
    expect(t).not.toContain("Dataset:");
    expect(t).toContain("## Sampling timetable");
    expect(t).toContain("```calc\nname: sampling");
    expect(t).toContain("- [ ] Process ABC0015-A");
    expect(t).toContain("- [ ] Process ABC0015-B");
    expect(t).not.toContain("[x]");
  });
  it("clears Notes for next time and leaves an empty bullet", () => {
    const t = clone().text;
    expect(t).not.toContain("Prime for longer");
    expect(t).not.toContain("Check the BPR");
    expect(t.endsWith("# 💡 Notes for next time\n- ")).toBe(true);
  });
  it("does not treat a # line inside a code block as a heading", () => {
    const text = "# 📈 Results / Analysis\n```python\n# 💡 Notes for next time\nx = 1\n```\n# 💡 Notes for next time\n- old\n";
    const t = cloneLabNote(text, OPTS).text;
    expect(t).toContain("# 💡 Notes for next time\nx = 1");
    expect(t).not.toContain("- old");
  });
  it("keeps CRLF line ends", () => {
    const t = clone(source.replace(/\n/g, "\r\n")).text;
    expect(t).toContain("Status: Planned\r\n");
    expect(t).not.toMatch(/[^\r]\n/);
  });
  it("works on a note without front matter or Results heading", () => {
    const r = cloneLabNote("# ⚗️ Procedure\n1. Mix ABC0014-A\n", OPTS);
    expect(r.text).toBe("# ⚗️ Procedure\n1. Mix ABC0015-A\n");
    expect(r.recoded).toBe(1);
  });
  it("does not touch a longer number that merely starts with the old prefix digits", () => {
    const r = cloneLabNote("See XABC0014-A and ABC0014-A\n", OPTS);
    expect(r.text).toBe("See XABC0014-A and ABC0015-A\n");
  });
  it("does not change its input", () => {
    const before = source;
    clone();
    expect(source).toBe(before);
  });
});
