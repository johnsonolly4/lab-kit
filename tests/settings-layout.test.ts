// Settings tab: the count shown on the Planning folders row (the tab itself needs Obsidian and is not built here).
import { describe, it, expect } from "vitest";
import { PLANNING_FOLDER_DEFAULTS, changedPlanningFolders } from "../src/kit/paths";

describe("settings tab: planning folders that are not the default", () => {
  it("counts the folders that differ from their default", () => {
    expect(changedPlanningFolders({ ...PLANNING_FOLDER_DEFAULTS })).toBe(0);
    expect(changedPlanningFolders({ ...PLANNING_FOLDER_DEFAULTS, projects: "20 Work", meetings: "Meetings" })).toBe(2);
    expect(changedPlanningFolders({ ...PLANNING_FOLDER_DEFAULTS, inbox: ` ${PLANNING_FOLDER_DEFAULTS.inbox} ` })).toBe(0);   // spaces around a default are still the default
    expect(Object.keys(PLANNING_FOLDER_DEFAULTS).length).toBe(9);   // the row says "N of 9 changed"
  });
});
