// Phase 5a: planning folder settings (src/kit/paths.ts) and Find moved folders (src/kit/moved-folders.ts).
import { describe, it, expect } from "vitest";
import { PLANNING_FOLDER_DEFAULTS, followFolderRename, kitLoad, missingPlanningFolders, planningFoldersLoad, todoFolder } from "../src/kit/paths";
import { findMoved, missingFolderSettings } from "../src/kit/moved-folders";

describe("planning folder settings", () => {
  it("default to the folder contract; a vault saved before 5a gets them", () => {
    expect(kitLoad(undefined).planningFolders).toEqual(PLANNING_FOLDER_DEFAULTS);
    expect(kitLoad({ initials: "ABC" }).planningFolders).toEqual(PLANNING_FOLDER_DEFAULTS);
    expect(todoFolder(PLANNING_FOLDER_DEFAULTS)).toBe("00 Planning/To-dos");
  });

  it("keep saved values, trimmed and with / separators; empty or unknown values fall back to the default", () => {
    const f = planningFoldersLoad({ planning: " Work\\Plan/ ", projects: "", inbox: 3, other: "x" });
    expect(f.planning).toBe("Work/Plan");
    expect(f.projects).toBe("02 Projects");
    expect(f.inbox).toBe("00 Inbox");
    expect((f as unknown as Record<string, unknown>).other).toBeUndefined();
    expect(kitLoad({ planningFolders: { meetings: "Meet" } }).planningFolders.meetings).toBe("Meet");
  });

  it("follow a folder renamed inside Obsidian (the folder itself or one above it)", () => {
    expect(followFolderRename("02 Projects", "02 Projects", "20 Work")).toBe("20 Work");
    expect(followFolderRename("Areas/02 Projects", "Areas", "Life")).toBe("Life/02 Projects");
    expect(followFolderRename("02 Projects Old", "02 Projects", "20 Work")).toBeNull();   // only whole folder names
    expect(followFolderRename("00 Planning", "02 Projects", "20 Work")).toBeNull();
  });

  it("missing folders: archive never (made when needed), literature only with ZotLit", () => {
    const exists = (p: string) => !["02 Projects", "04 Literature", "99 Archive"].includes(p);
    expect(missingPlanningFolders(PLANNING_FOLDER_DEFAULTS, exists, false)).toEqual(["projects"]);
    expect(missingPlanningFolders(PLANNING_FOLDER_DEFAULTS, exists, true)).toEqual(["projects", "literature"]);
  });
});

describe("Find moved folders", () => {
  const folders = ["Work", "Work/02 Projects", "Work/02 Projects/Alpha", "Work/00 Planning", "Work/00 Planning/To-dos", "Elsewhere", "Elsewhere/Alpha", "Old/Notes", "Lab Book/Notes"];
  const notes = [
    { path: "Work/02 Projects/Alpha/Alpha.md", kind: "project" },
    { path: "Elsewhere/Alpha/Beta.md", kind: "project" },
    { path: "Work/00 Planning/To-dos/Buy gloves.md", kind: "todo" },
    { path: "Work/00 Planning/To-dos/Order CDCl3.md", kind: "todo" },
  ];
  const files = ["Work/00 Planning/Shopping list.md", "Work/00 Planning/To-do board.base", ...notes.map(n => n.path)];

  it("ranks a same-name folder with the notes of its kind first, and says why", () => {
    const m = missingFolderSettings({ planning: { ...PLANNING_FOLDER_DEFAULTS }, planningMissing: ["projects"], labFolder: "", chemicalFolder: "", exists: () => true })[0];
    const found = findMoved(m, folders, notes, files, []);
    expect(found[0].path).toBe("Work/02 Projects");
    expect(found[0].reason).toBe("same name, 1 project hubs found there");
    expect(found.map(c => c.path)).toContain("Elsewhere");   // a project hub there too, ranked lower
  });

  it("uses the kit files tracked inside the missing folder", () => {
    const m = missingFolderSettings({ planning: { ...PLANNING_FOLDER_DEFAULTS }, planningMissing: ["planning"], labFolder: "", chemicalFolder: "", exists: () => true })[0];
    const found = findMoved(m, folders, notes, files, ["00 Planning/Shopping list.md", "00 Planning/To-do board.base"]);
    expect(found[0]).toEqual({ path: "Work/00 Planning", score: 10 + 2 * 5 + 2 * 5, reason: "same name, 2 to-dos found there, 2 kit files found there" });
  });

  it("prefers more matching path parts; leaves out folders another setting already uses", () => {
    const m = missingFolderSettings({ planning: {}, planningMissing: [], labFolder: "03 Lab Book/Notes", chemicalFolder: "", exists: () => false })[0];
    expect(m.key).toBe("lab:labFolder");
    const all = [...folders, "Y/03 Lab Book/Notes"];
    expect(findMoved(m, all, [], [], []).map(c => c.path)).toEqual(["Y/03 Lab Book/Notes", "Lab Book/Notes", "Old/Notes"]);
    expect(findMoved(m, all, [], [], [], ["Y/03 Lab Book/Notes"]).map(c => c.path)).toEqual(["Lab Book/Notes", "Old/Notes"]);
  });

  it("finds nothing when there is no clue", () => {
    const m = missingFolderSettings({ planning: { ...PLANNING_FOLDER_DEFAULTS }, planningMissing: ["inbox"], labFolder: "", chemicalFolder: "", exists: () => true })[0];
    expect(findMoved(m, folders, notes, files, [])).toEqual([]);
  });
});
