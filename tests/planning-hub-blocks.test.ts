import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { folderHub, parentHub, pictureHub, topicIndex, type NoteRec } from "../src/planning/lists";
import { KIT_DEFAULTS } from "../src/kit/paths";
import { seriesOfNote } from "../src/planning/meetings";

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
  it("the kit's guide notes start with a back link, which goes to the How-tos index, and no heading that repeats their name", () => {
    const guides = ["Hotkeys", "Setting up a computer", "How my vault works", "Vault spec"];
    const all = [...notes, note("07 How-tos/How-tos index.md", { kind: "hub" }), ...guides.map(g => note(`07 How-tos/Obsidian/${g}.md`, { kind: "guide" }))];
    for (const g of guides) {
      expect(parentHub(all, `07 How-tos/Obsidian/${g}.md`)?.path, g).toBe("07 How-tos/How-tos index.md");
      const text = kit(`07 How-tos/Obsidian/${g}.md`);
      expect(text, g).toMatch(/^---\n[\s\S]*?\n---\n\n```vault-card\nshow: back-to-hub\n```\n/);
      expect(text, g).not.toContain(`\n# ${g}\n`);
    }
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
  it("project, topic and series hubs have one top bar (back link + the hub's buttons); a one-off meeting and a project note have a back link", () => {
    for (const t of ["Project hub.md", "New topic hub.md", "Meeting series.md"]) expect(kit(`Extras/Templates/${t}`), t).toContain("show: hub-bar");
    expect(kit("Extras/Templates/One-off meeting.md")).toContain("show: meeting-bar");
    expect(kit("Extras/Templates/New project note.md")).toContain("show: back-to-project");
  });
  it("the project hub's Status and Deadline are in the top bar, not Meta Bind lines", () => {
    const t = kit("Extras/Templates/Project hub.md");
    expect(t).not.toContain("INPUT[inlineSelect");
    expect(t).not.toContain("show: deadline");
    expect(t).not.toContain("INPUT[datePicker");   // the deadline date is a box in the bar too
  });
  it("a meeting note has the meeting bar and native tiles with a window, not Dataview lists", () => {
    const t = kit("Extras/Templates/Meeting.md");
    expect(t).toContain("show: meeting-bar");
    for (const s of ["meeting-experiments", "meeting-done", "meeting-papers"]) expect(t, s).toContain(`show: ${s}`);
    expect(t).not.toContain("go-meetings");
    expect(t).not.toContain("this.since");
  });
  it("New concept files in a topic hub's folder without asking the topic: the template takes the folder as an answer (the window asks, tests/hub-note.test.ts)", () => {
    const t = kit("Extras/Templates/New concept.md");
    expect(t).toContain('folder: "{{folder}}"');
    expect(t).not.toContain("<%");
  });
});

describe("folderHub: a note's own project hub", () => {
  const notes = [
    note("02 Projects/Polymers/Polymers.md", { kind: "project" }),
    note("02 Projects/Polymers/Method notes.md", { project: ["[[Polymers]]"] }),
    note("02 Projects/Loose/Idea.md", { project: ["[[Polymers]]"] }),
    note("02 Projects/Empty/Thing.md"),
  ];
  it("finds the hub in the same folder, else the project link, else null", () => {
    expect(folderHub(notes, "02 Projects/Polymers/Method notes.md")?.path).toBe("02 Projects/Polymers/Polymers.md");
    expect(folderHub(notes, "02 Projects/Loose/Idea.md")?.path).toBe("02 Projects/Polymers/Polymers.md");
    expect(folderHub(notes, "02 Projects/Empty/Thing.md")).toBeNull();
  });
});

describe("seriesOfNote: the deck opens without asking", () => {
  const all = [{ name: "Group", path: "08 Meetings/Group/Group.md" }, { name: "One-off", path: "08 Meetings/One-off/One-off.md" }];
  it("a series hub is its own series; a meeting note uses its series link; others get nothing", () => {
    expect(seriesOfNote(all, "08 Meetings/Group/Group.md", {})?.name).toBe("Group");
    expect(seriesOfNote(all, "08 Meetings/Group/2026-10-01 Group.md", { series: "[[Group]]" })?.name).toBe("Group");
    expect(seriesOfNote(all, "08 Meetings/One-off/x.md", { series: "[[One-off]]" })?.name).toBe("One-off");
    expect(seriesOfNote(all, "Elsewhere.md", {})).toBeUndefined();
  });
});

describe("topicIndex: the Knowledge index lists every topic, empty ones too", () => {
  const notes = [
    note("06 Knowledge/Knowledge index.md", { kind: "hub" }),
    note("06 Knowledge/NMR/NMR.md", { kind: "hub" }),
    note("06 Knowledge/NMR/Shimming.md", { kind: "concept" }),
    note("06 Knowledge/NMR/Pulse/Pulse.md", { kind: "hub" }),
    note("06 Knowledge/New topic/New topic.md", { kind: "hub" }),
  ];
  it("one line per topic hub with its notes (sub-folders included); the index itself is not a topic", () => {
    const t = topicIndex(notes, "06 Knowledge");
    expect(t.map(x => x.hub.text)).toEqual(["New topic", "NMR"]);
    expect(t.find(x => x.hub.text === "NMR")!.notes.map(n => n.text)).toEqual(["Pulse", "Shimming"]);
    expect(t.find(x => x.hub.text === "New topic")!.notes).toEqual([]);
  });
});

describe("Project hub template: the Plan tile", () => {
  it("sits bare between the hub bar and the Goal", () => {
    const t = kit("Extras/Templates/Project hub.md");
    const bar = t.indexOf("show: hub-bar"), plan = t.indexOf("```vault-card\nshow: project-plan\n```"), goal = t.indexOf("> [!focus] Goal");
    expect(bar).toBeGreaterThan(0);
    expect(plan).toBeGreaterThan(bar);
    expect(goal).toBeGreaterThan(plan);
  });
  it("has the Experiments tile after the columns and before Meetings", () => {
    const t = kit("Extras/Templates/Project hub.md");
    const tile = t.indexOf("> [!lab] Experiments\n> ```vault-card\n> show: project-experiments\n> ```");
    expect(tile).toBeGreaterThan(t.indexOf("show: project-notes"));
    expect(tile).toBeLessThan(t.indexOf("> [!question] Meetings"));
  });
  it("has the card map under the Plan tile; there is no plan view setting any more", () => {
    const t = kit("Extras/Templates/Project hub.md");
    expect(t.indexOf("```vault-card\nshow: project-map\n```")).toBeGreaterThan(t.indexOf("show: project-plan"));
    expect(t.indexOf("show: project-map")).toBeLessThan(t.indexOf("> [!focus] Goal"));
    expect("planView" in KIT_DEFAULTS).toBe(false);
    expect(KIT_DEFAULTS.planDirection).toBe("across");
  });
});

describe("no plan list option", () => {
  it("no source file mentions planView, and the project-plan block yields to a hub's map", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith(".ts") ? [join(d, n)] : []);
    for (const f of walk("src")) expect(readFileSync(f, "utf8"), f).not.toContain("planView");
    expect(readFileSync("src/planning/blocks.ts", "utf8")).toMatch(/if \(this\.hubHasMap\(\)\) return;/);
  });
});

describe("pictureHub: the project a plan-picture block draws (plan-map Phase 3)", () => {
  const hub = note("02 Projects/Polymers/Polymers.md", { kind: "project" });
  const meeting = note("08 Meetings/Group/2026-10-21 Group.md", { kind: "meeting" });
  const topic = note("03 Knowledge/Kinetics/Kinetics.md", { kind: "topic" });
  const find = (link: string): NoteRec | null => [hub, meeting, topic].find(n => n.name === link.split("/").pop()) ?? null;
  it("on the project's own hub, with no project line: the hub itself", () => {
    expect(pictureHub("show: plan-picture", hub, find)).toEqual({ hub });
  });
  it("a project: [[Hub]] line names the project (alias, heading and .md dropped), also on the hub of another project", () => {
    for (const v of ["[[Polymers]]", "[[Polymers|the polymers]]", "[[02 Projects/Polymers/Polymers.md#Plan]]", "Polymers"]) {
      expect(pictureHub(`show: plan-picture\nproject: ${v}`, meeting, find)).toEqual({ hub });
    }
    expect(pictureHub("show: plan-picture\n  Project :  [[Polymers]]  ", meeting, find)).toEqual({ hub });
  });
  it("an unknown project, or a link to a note that is not a project hub: a line saying so", () => {
    expect(pictureHub("show: plan-picture\nproject: [[Nope]]", meeting, find)).toEqual({ error: 'No project hub called "Nope".' });
    expect(pictureHub("show: plan-picture\nproject: [[Kinetics]]", hub, find)).toEqual({ error: 'No project hub called "Kinetics".' });
  });
  it("no project line on a note that is not a project hub: a line saying how to name one", () => {
    expect(pictureHub("show: plan-picture", meeting, find)).toEqual({ error: "Not a project hub: add a line project: [[Your project]] to this block." });
    expect(pictureHub("show: plan-picture\nproject:", null, find)).toEqual({ error: "Not a project hub: add a line project: [[Your project]] to this block." });
  });
});
