// Release-test fix (c): Esc cancels every naming box and picker; the lab entry title comes from the plugin box.
// The templates run only inside Templater, so these check the text of the kit files.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Esc cancels the creation", () => {
  const todo = read("tests/fixtures/templates/old/To-do.md");

  it("To-do: Esc (null) in the text box, the project picker and the meeting picker throws; empty text is Untitled", () => {
    expect(todo).toContain('asked === null) { await trashIfBlank(); throw new Error("Cancelled');
    expect(todo).toContain('(asked || "Untitled to-do")');
    expect(todo).toContain('picked === null || picked === undefined) { await trashIfBlank(); throw');
    expect(todo).toContain('chosen === null || chosen === undefined) { await trashIfBlank(); throw');
  });

  it("no box text says Esc skips or Esc = Untitled", () => {
    for (const f of ["tests/fixtures/templates/old/To-do.md", "kits/planning/Extras/scripts/templater/vault/vtAsk.js"]) {
      expect(read(f), f).not.toMatch(/Esc = |Esc to skip/);
    }
  });

  it("Lab Book Template: takes the preset title, Esc in its own box throws, empty is Untitled", () => {
    const lab = read("kits/lab/Templates/Lab Book Template.md");
    expect(lab).toContain("window.labKitPresetTitle");
    expect(lab).toContain('title === null) { await trashIfBlank(); throw new Error("Cancelled');
    expect(lab).toContain('title = title || "Untitled"');
  });

  it("New lab entry asks in the entry window before it makes the note (Esc makes nothing), and clears the presets", () => {
    const ui = read("src/kit/ui.ts");
    const fn = ui.slice(ui.indexOf("async newLabEntry"));
    expect(fn.indexOf("await openEntry(")).toBeGreaterThan(0);
    expect(fn.indexOf("await openEntry(")).toBeLessThan(fn.indexOf("templaterCreateNote("));
    expect(fn).toContain("if (!answer) return;");
    expect(fn).toContain("delete w.labKitPresetTitle; delete w.labKitPresetClass;");
  });
});

describe("a cancel is not logged as an error (Templater would print 'Template parsing error, aborting')", () => {
  for (const f of ["tests/fixtures/templates/old/To-do.md", "kits/lab/Templates/Lab Book Template.md"]) it(`${f}: the script is a try, a cancel is caught at the end and writes nothing, the empty note is trashed later`, () => {
    const t = read(f);
    expect(t.startsWith("<%*\ntry {")).toBe(true);
    expect(t).toContain('if (String(e && e.message).startsWith("Cancelled")) { tR = ""; } else { throw e; }');
    expect(t.trimEnd().endsWith("} -%>")).toBe(true);
    expect(t).toContain("window.setTimeout(() => { app.fileManager.trashFile(f)");
    expect(t).not.toMatch(/await app\.fileManager\.trashFile/);   // not at once: Templater still writes to the file
  });
});
