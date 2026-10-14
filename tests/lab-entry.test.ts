// New lab entry window (src/kit/lab-entry.ts): the Exp. Class and Copy of chips, and the title rule.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { labEntryFields, labEntryTitle, type LabNote } from "../src/kit/lab-entry";
import { missingRequired } from "../src/planning/entry-fields";

const note = (basename: string, classes: string[] = []): LabNote => ({ basename, path: `03 Lab Book/Notes/${basename}.md`, classes });
const notes = [note("ABC0001 - First", ["RAFT"]), note("ABC0003 - Third", ["raft", "Flow"]), note("ABC0002 - Second"), note("Scratch")];

describe("labEntryFields", () => {
  it("Exp. Class lists the classes in use (once, any case) and takes a new one typed", () => {
    const f = labEntryFields(notes, false).find(x => x.key === "expClass")!;
    expect(f.options?.map(o => o.label)).toEqual(["(none)", "Flow", "RAFT"]);
    expect(f.allowNew).toBe(true);
  });
  it("Copy of lists the numbered notes, newest first, with (none) first; Clone needs one", () => {
    const f = labEntryFields(notes, false).find(x => x.key === "copyOf")!;
    expect(f.options?.map(o => o.label)).toEqual(["(none)", "ABC0003 - Third", "ABC0002 - Second", "ABC0001 - First"]);
    const c = labEntryFields(notes, true);
    expect(c.find(x => x.key === "copyOf")?.options?.[0].label).toBe("ABC0003 - Third");
    expect(missingRequired(c, {})?.key).toBe("copyOf");
    expect(missingRequired(labEntryFields(notes, false), {})).toBeNull();
  });
});

describe("labEntryTitle", () => {
  it("the typed title, else the copied note's own title, else empty", () => {
    expect(labEntryTitle("  Run 2 ", note("ABC0003 - Third"))).toBe("Run 2");
    expect(labEntryTitle("", note("ABC0003 - Third"))).toBe("Third");
    expect(labEntryTitle("", null)).toBe("");
  });
});

describe("the Lab Book Template", () => {
  it("writes the Exp. Class handed over by the window (quoted), and clears it", () => {
    const tpl = readFileSync("kits/lab/Templates/Lab Book Template.md", "utf8");
    expect(tpl).toContain('const expClass = String(window.labKitPresetClass ?? "").trim();');
    expect(tpl).toContain("delete window.labKitPresetClass;");
    expect(tpl).toContain('Exp. Class: <% expClass ? JSON.stringify(expClass) : "" %>');
  });
});
