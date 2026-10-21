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

describe("the old Templater Lab Book Template (kept as a fixture)", () => {
  it("writes the Exp. Class handed over by the window (quoted), and clears it", () => {
    const tpl = readFileSync("tests/fixtures/templates/old/Lab Book Template.md", "utf8");
    expect(tpl).toContain('const expClass = String(presetClass ?? "").trim();');
    expect(tpl).toContain("delete window.labKitPresetClass;");
    expect(tpl).toContain('Exp. Class: <% expClass ? JSON.stringify(expClass) : "" %>');
  });
});

describe("a note made in the lab folder by hand, old Templater template (the folder trigger)", () => {
  const tpl = readFileSync("tests/fixtures/templates/old/Lab Book Template.md", "utf8");
  it("the template opens the plugin's window through window.vtEntryLab and trashes an empty note on Esc, only inside the lab folder", () => {
    expect(tpl).toContain('title === undefined && typeof window.vtEntryLab === "function"');
    expect(tpl).toContain("const got = await window.vtEntryLab();");
    expect(tpl).toContain("if (!got) { await trashIfBlank(); throw new Error(\"Cancelled - no experiment title\"); }");
    expect(tpl).toContain("f.path.startsWith(`${folder}/`) && (await app.vault.read(f)).trim() === \"\"");
    expect(tpl).toContain("app.fileManager.trashFile(f)");
  });
  it("the plugin provides the hook and removes it when it unloads", () => {
    const ui = readFileSync("src/kit/ui.ts", "utf8");
    expect(ui).toContain("w.vtEntryLab = () => this.askLabEntry();");
    expect(ui).toContain("plugin.register(() => { delete w.vtEntryLab; });");
    expect(ui).toContain('labEntryFields(labNotes, false).filter(f => f.key === "expClass")');
  });
});

describe("a lab note made from a board column keeps that column's Status", () => {
  const tpl = readFileSync("tests/fixtures/templates/old/Lab Book Template.md", "utf8");
  it("reads the Status already in the new file and writes it once (Planned only when there is none)", () => {
    expect(tpl).toContain('const foundStatus = ((rawNow.match(/^Status:[ \\t]*["\']?([^"\'\\r\\n]+)/m) || [])[1] || "").trim();');
    expect(tpl).toContain('const status = foundStatus || "Planned";');
    expect(tpl.match(/^Status:/gm)).toHaveLength(1);
    expect(tpl).not.toMatch(/^Status: Planned$/m);
  });
  it("the regex finds a column's Status in a file the board made", () => {
    const find = (raw: string): string => ((raw.match(/^Status:[ \t]*["']?([^"'\r\n]+)/m) || [])[1] || "").trim();
    expect(find("---\nStatus: Started\n---\n")).toBe("Started");
    expect(find('---\nStatus: "Processing results"\n---\n')).toBe("Processing results");
    expect(find("")).toBe("");
  });
});
