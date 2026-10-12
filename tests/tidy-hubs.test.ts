// Hub plan Phase 5: Tidy up notes brings old hub pages up to the kit's templates, keeping the user's goal, Related text and topic intro.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";
import { newHubPage, replaceBody, templatePage } from "../src/kit/tidy-hubs";

const T = "kits/planning/Extras/Templates/";
const hubTemplates = { project: readFileSync(`${T}Project hub.md`, "utf8"), topic: readFileSync(`${T}New topic hub.md`, "utf8"), series: readFileSync(`${T}Meeting series.md`, "utf8") };
const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: [], migrations: [],
  projectsFolder: "02 Projects", hubFolders: ["02 Projects", "06 Knowledge"], hubTemplates,
  meetings: { folder: "08 Meetings", todos: "00 Planning/To-dos", today: "2026-10-10", interval: "weekly", day: "Thu" },
};
const PROJECT_OLD = "---\nkind: project\nStatus: Active\ndeadline:\ncssclasses:\n  - vt\n  - project\n---\n\n**Status:** `INPUT[inlineSelect(option(Active)):Status]`\n\n> [!focus] Goal\n> [goal:: Make polymers]\n\n> [!columns]\n> > [!planning] To-dos\n\n## Related\n- [[My paper]]\n- my own line\n";
const TOPIC_OLD = "---\nkind: hub\ncssclasses:\n  - vt\n---\n\nNMR is how we check purity.\n\n```dataview\nLIST\nFROM \"06 Knowledge/NMR\"\n```\n";
const SERIES_OLD = "---\nkind: meeting-series\ninterval: weekly\nday: Thu\nstart: 2026-10-01\ndeck_windows: \"\"\ndeck_mac: \"\"\ncssclasses:\n  - vt\n---\n\n`BUTTON[go-deck, new-meeting]`\n";
const vault = (): Map<string, string> => new Map([
  ["02 Projects/Polymers/Polymers.md", PROJECT_OLD],
  ["06 Knowledge/NMR/NMR.md", TOPIC_OLD],
  ["08 Meetings/Group/Group.md", SERIES_OLD],
]);
const files = (m: Map<string, string>): TidyFile[] => [...m.keys()].map(path => ({ path, text: wantsText(path, ctx, false) ? m.get(path) : undefined }));
const io = (m: Map<string, string>): TidyIO => ({
  read: async p => m.get(p) ?? null, write: async (p, t) => { m.set(p, t); }, backup: async p => `backups/${p}`, exists: p => m.has(p),
  filesIn: p => [...m.keys()].filter(k => k === p), linkedFrom: () => [], rename: async () => undefined, create: async (p, t) => { m.set(p, t); },
  settingSnapshot: () => "", setSetting: async () => null,
});
const hubGroup = (m: Map<string, string>) => scan(files(m), ctx).groups.find(g => g.id === "hub-body");

describe("hub pages from the templates", () => {
  it("the group exists, is opt-in and covers the three old hubs", () => {
    const g = hubGroup(vault())!;
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => c.path).sort()).toEqual(["02 Projects/Polymers/Polymers.md", "06 Knowledge/NMR/NMR.md", "08 Meetings/Group/Group.md"]);
    expect(g.changes.every(c => c.body)).toBe(true);
  });

  it("applied: new blocks in, properties untouched, goal / Related / intro kept, a backup made", async () => {
    const m = vault(), backups: string[] = [];
    const g = hubGroup(m)!, i = io(m);
    i.backup = async p => { backups.push(p); return `b/${p}`; };
    const out = await applyTidy(i, selectChanges({ groups: [g], reported: [] }, new Set(["hub-body"])));
    expect(out.skipped).toEqual([]);
    const project = m.get("02 Projects/Polymers/Polymers.md")!;
    expect(project.startsWith(PROJECT_OLD.slice(0, PROJECT_OLD.indexOf("\n---\n", 4) + 5))).toBe(true);
    expect(project).toContain("show: hub-bar");
    expect(project).toContain("[goal:: Make polymers]");
    expect(project).toContain("## Related\n- [[My paper]]\n- my own line");
    const topic = m.get("06 Knowledge/NMR/NMR.md")!;
    expect(topic).toContain("NMR is how we check purity.");
    expect(topic).not.toContain("What is this topic about?");
    expect(topic).toContain("show: hub-bar");
    expect(topic).toContain('FROM "06 Knowledge/NMR"');
    const series = m.get("08 Meetings/Group/Group.md")!;
    expect(series).toContain("show: hub-bar");
    expect(series).toContain('FROM "08 Meetings/Group"');
    expect(series).toContain("interval: weekly");   // properties kept
    expect(backups.sort()).toEqual(["02 Projects/Polymers/Polymers.md", "06 Knowledge/NMR/NMR.md", "08 Meetings/Group/Group.md"]);
  });

  it("a second scan finds nothing: hubs already on the template are left alone", async () => {
    const m = vault();
    await applyTidy(io(m), selectChanges({ groups: [hubGroup(m)!], reported: [] }, new Set(["hub-body"])));
    expect(hubGroup(m)).toBeUndefined();
  });

  it("a hub edited after the scan is skipped, not overwritten", async () => {
    const m = vault();
    const g = hubGroup(m)!;
    m.set("06 Knowledge/NMR/NMR.md", TOPIC_OLD + "\nadded after the scan\n");
    const out = await applyTidy(io(m), selectChanges({ groups: [g], reported: [] }, new Set(["hub-body"])));
    expect(out.skipped.map(s => s.path)).toEqual(["06 Knowledge/NMR/NMR.md"]);
    expect(m.get("06 Knowledge/NMR/NMR.md")).toContain("added after the scan");
  });

  it("notes that are not hubs, and a vault without the templates, are left alone", () => {
    const m = new Map([["02 Projects/Polymers/Notes.md", PROJECT_OLD], ["06 Knowledge/NMR/Basics.md", TOPIC_OLD]]);
    expect(hubGroup(m)).toBeUndefined();
    const off = scan(files(vault()), { ...ctx, hubTemplates: undefined });
    expect(off.groups.find(g => g.id === "hub-body")).toBeUndefined();
  });
});

describe("hub page helpers", () => {
  it("templatePage drops the header and properties and fills the folder", () => {
    const p = templatePage(hubTemplates.topic, "06 Knowledge/NMR");
    expect(p.startsWith("```vault-card")).toBe(true);
    expect(p).toContain('FROM "06 Knowledge/NMR"');
    expect(p).not.toContain("<%");
  });
  it("a project keeps an empty goal empty and a topic without intro keeps the hint", () => {
    expect(newHubPage("project", templatePage(hubTemplates.project, "x"), "")).toContain("[goal:: ]");
    expect(newHubPage("topic", templatePage(hubTemplates.topic, "x"), "```dataview\nLIST\n```")).toContain("What is this topic about?");
  });
  it("replaceBody keeps CRLF and refuses a changed body", () => {
    expect(replaceBody("---\na: 1\n---\nold\n", "\nold\n", "\nnew\n")).toBe("---\na: 1\n---\nnew\n");
    expect(replaceBody("---\r\na: 1\r\n---\r\nold\r\n", "\nold\n", "\nnew\n")).toBe("---\r\na: 1\r\n---\r\nnew\r\n");
    expect(replaceBody("---\na: 1\n---\nother\n", "\nold\n", "\nnew\n")).toBeNull();
  });
});
