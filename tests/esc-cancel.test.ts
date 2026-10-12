// Release-test fix (c): Esc cancels every naming box and picker; the lab entry title comes from the plugin box.
// The templates run only inside Templater, so these check the text of the kit files.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Esc cancels the creation", () => {
  const todo = read("kits/planning/Extras/Templates/To-do.md");

  it("To-do: Esc (null) in the text box, the project picker and the meeting picker throws; empty text is Untitled", () => {
    expect(todo).toContain('asked === null) { throw new Error("Cancelled');
    expect(todo).toContain('(asked || "Untitled to-do")');
    expect(todo).toContain('picked === null || picked === undefined) { throw');
    expect(todo).toContain('chosen === null || chosen === undefined) { throw');
  });

  it("no box text says Esc skips or Esc = Untitled", () => {
    for (const f of ["kits/planning/Extras/Templates/To-do.md", "kits/planning/Extras/scripts/templater/vault/vtAsk.js"]) {
      expect(read(f), f).not.toMatch(/Esc = |Esc to skip/);
    }
  });

  it("Lab Book Template: takes the preset title, Esc in its own box throws, empty is Untitled", () => {
    const lab = read("kits/lab/Templates/Lab Book Template.md");
    expect(lab).toContain("window.labKitPresetTitle");
    expect(lab).toContain('title === null) throw new Error("Cancelled');
    expect(lab).toContain('title = title || "Untitled"');
  });

  it("New lab entry asks with the plugin box before it makes the note, and clears the preset", () => {
    const ui = read("src/kit/ui.ts");
    const fn = ui.slice(ui.indexOf("async newLabEntry"));
    expect(fn.indexOf("await ask(")).toBeGreaterThan(0);
    expect(fn.indexOf("await ask(")).toBeLessThan(fn.indexOf("templaterCreateNote("));
    expect(fn).toContain("if (title === null) return;");
    expect(fn).toContain("delete w.labKitPresetTitle");
  });
});
