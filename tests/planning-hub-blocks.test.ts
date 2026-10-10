import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parentHub, type NoteRec } from "../src/planning/lists";

const note = (path: string, fm: Record<string, unknown> = {}): NoteRec => {
  const parts = path.split("/"), file = parts.pop()!;
  return { path, name: file.replace(/\.md$/, ""), folder: parts.join("/"), fm, ctime: 0, mtime: 0 };
};
const kit = (p: string) => readFileSync(`kits/planning/${p}`, "utf8");

describe("parentHub: the hub one folder up, found by folder", () => {
  const notes = [
    note("02 Projects/Projects overview.md", { kind: "hub" }),
    note("02 Projects/Polymers/Polymers.md", { kind: "project" }),
    note("06 Knowledge/Knowledge index.md", { kind: "hub" }),
    note("06 Knowledge/NMR/NMR.md", { kind: "hub" }),
    note("08 Meetings/Meetings.md"),
    note("08 Meetings/Group/Group.md", { kind: "meeting-series" }),
  ];
  it("a project hub goes to the Projects overview, a topic hub to the Knowledge index", () => {
    expect(parentHub(notes, "02 Projects/Polymers/Polymers.md")?.path).toBe("02 Projects/Projects overview.md");
    expect(parentHub(notes, "06 Knowledge/NMR/NMR.md")?.path).toBe("06 Knowledge/Knowledge index.md");
  });
  it("a series hub goes to the note named like the Meetings folder when no note says kind: hub", () => {
    expect(parentHub(notes, "08 Meetings/Group/Group.md")?.path).toBe("08 Meetings/Meetings.md");
  });
  it("follows a folder rename: the button holds no name", () => {
    const renamed = notes.map(n => note(n.path.replace("02 Projects", "Work").replace("08 Meetings", "Mtgs"), n.fm));
    expect(parentHub(renamed, "Work/Polymers/Polymers.md")?.path).toBe("Work/Projects overview.md");
    const mt = renamed.map(n => n.path === "Mtgs/Meetings.md" ? note("Mtgs/Mtgs.md") : n);
    expect(parentHub(mt, "Mtgs/Group/Group.md")?.path).toBe("Mtgs/Mtgs.md");
  });
  it("is null with no hub up there or an unknown path", () => {
    expect(parentHub([note("A/B/B.md")], "A/B/B.md")).toBeNull();
    expect(parentHub(notes, "nope.md")).toBeNull();
  });
});

describe("hub templates carry the buttons as blocks", () => {
  it("project, topic and series hubs have a back link; topic has New concept, series Extra meeting now", () => {
    for (const t of ["Project hub.md", "New topic hub.md", "Meeting series.md"]) expect(kit(`Extras/Templates/${t}`), t).toContain("show: back-to-hub");
    expect(kit("Extras/Templates/New topic hub.md")).toContain("show: topic-actions");
    expect(kit("Extras/Templates/Meeting series.md")).toContain("show: series-actions");
  });
  it("New concept files in a topic hub's folder without asking the topic", () => {
    const t = kit("Extras/Templates/New concept.md");
    expect(t).toContain("window.vtNewConceptFolder");
    expect(t.indexOf("presetFolder &&")).toBeLessThan(t.indexOf("Which topic?"));
  });
});
