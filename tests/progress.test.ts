import { describe, it, expect } from "vitest";
import { progressOf, wantsProgress } from "../src/planning/progress";
import { KIT_DEFAULTS } from "../src/kit/paths";

describe("checklist progress", () => {
  it("counts ticked check boxes out of all, ignoring plain list items", () => {
    expect(progressOf([{ task: " " }, { task: "x" }, { task: " " }, {}])).toBe("1/3");
    expect(progressOf([{ task: "x" }, { task: "/" }])).toBe("2/2");
  });
  it("is null without check boxes", () => {
    expect(progressOf(undefined)).toBeNull();
    expect(progressOf([{}, {}])).toBeNull();
  });
  it("applies to lab notes and the Shopping list only", () => {
    const kit = { ...KIT_DEFAULTS, labFolder: "03 Lab Book/Notes" };
    expect(wantsProgress("03 Lab Book/Notes/0001 - A.md", kit)).toBe(true);
    expect(wantsProgress("00 Planning/Shopping list.md", kit)).toBe(true);
    expect(wantsProgress("00 Planning/To-dos/x.md", kit)).toBe(false);
    expect(wantsProgress("03 Lab Book/Notes2/a.md", kit)).toBe(false);
    expect(wantsProgress("03 Lab Book/Notes/a.md", { ...kit, labFolder: "" })).toBe(false);
  });
  it("is off by default", () => expect(KIT_DEFAULTS.checklistProgress).toBe(false));
});
