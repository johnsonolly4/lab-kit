// Phase 7c-1: Tidy up notes, meetings rule and "folders without a hub" rule, on a small made-up vault held in memory.
import { describe, it, expect } from "vitest";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const OLD_HUB = "---\nkind: hub\ncssclasses:\n  - vt\ndeck_windows: \"\"\n---\n\n`BUTTON[go-deck, new-meeting]`\n";
const vault = (): Map<string, string> => new Map([
  ["08 Meetings/Group meeting/Group meeting.md", OLD_HUB],
  ["08 Meetings/Group meeting/2026-09-24 Group meeting.md", "---\nkind: meeting\ndate: 2026-09-24\n---\nnotes\n"],
  ["08 Meetings/Loose/2026-09-01 Loose.md", "---\nkind: meeting\n---\nno hub here\n"],
  ["00 Planning/To-dos/Order vials.md", "---\nkind: todo\nmeeting: true\n---\n"],
  ["00 Planning/To-dos/Book room.md", "---\nkind: todo\nmeeting: false\n---\n"],
  ["00 Planning/To-dos/Write up.md", "---\nkind: todo\nmeeting: \"[[Group meeting]]\"\n---\n"],
  ["02 Projects/Alpha/Alpha.md", "---\nkind: project\n---\n"],
  ["06 Knowledge/Solvents.md", "---\nkind: concept\n---\n"],
  ["07 How-tos/How-tos index.md", "---\nkind: hub\n---\n"],
  ["04 Literature/Papers.base", "views: []\n"],
]);
const ctx = (over: Partial<NonNullable<TidyContext["meetings"]>> = {}): TidyContext => ({
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: [],
  migrations: [], hubFolders: ["02 Projects", "04 Literature", "06 Knowledge", "07 How-tos"],
  meetings: { folder: "08 Meetings", todos: "00 Planning/To-dos", today: "2026-10-07", interval: "weekly", day: "Thu", ...over },
});
const files = (m: Map<string, string>, c: TidyContext): TidyFile[] => [...m.keys()].map(path => ({ path, text: wantsText(path, c, false) ? m.get(path) : undefined }));
function io(m: Map<string, string>): TidyIO & { backups: Map<string, string> } {
  const backups = new Map<string, string>();
  return {
    backups,
    read: async p => m.get(p) ?? null, write: async (p, t) => { m.set(p, t); },
    backup: async (p, t) => { backups.set(p, t); return `backups/${p}`; },
    exists: p => m.has(p), filesIn: p => [...m.keys()].filter(k => k === p), linkedFrom: () => [], rename: async () => undefined,
    create: async (p, t) => { m.set(p, t); },
    settingSnapshot: () => "", setSetting: async () => null,
  };
}
const group = (c: TidyContext, m: Map<string, string>, id: string) => scan(files(m, c), c).groups.find(g => g.id === id);

describe("Tidy up notes: meetings (Phase 7c-1)", () => {
  it("the old hub becomes a series with the chosen interval and day; start is today", () => {
    const g = group(ctx({ interval: "fortnightly", day: "Tue" }), vault(), "meetings");
    const hub = g?.changes.find(c => c.path.endsWith("Group meeting/Group meeting.md"));
    expect(hub?.before).toBe("kind: hub\ncssclasses:\n  - vt\ndeck_windows: \"\"");
    expect(hub?.after).toBe("kind: meeting-series\ncssclasses:\n  - vt\ndeck_windows: \"\"\ninterval: fortnightly\nday: Tue\nstart: 2026-10-07");
  });

  it("meeting notes get series from the hub in their folder; one without a hub is reported", () => {
    const c = ctx(), s = scan(files(vault(), c), c);
    const note = s.groups.find(g => g.id === "meetings")?.changes.find(x => x.path.endsWith("2026-09-24 Group meeting.md"));
    expect(note?.after).toBe("kind: meeting\ndate: 2026-09-24\nseries: \"[[Group meeting]]\"");
    expect(s.reported.find(r => r.id === "left-alone")?.items.map(i => i.path)).toEqual(["08 Meetings/Loose/2026-09-01 Loose.md"]);
  });

  it("to-dos with meeting: true link to the first series; false and links are untouched", () => {
    const g = group(ctx(), vault(), "meetings");
    const todo = g?.changes.filter(c => c.path.startsWith("00 Planning/To-dos/"));
    expect(todo?.map(c => c.path)).toEqual(["00 Planning/To-dos/Order vials.md"]);
    expect(todo?.[0].after).toBe("kind: todo\nmeeting: \"[[Group meeting]]\"");
  });

  it("no series at all: meeting: true is reported, not changed", () => {
    const m = vault(); m.delete("08 Meetings/Group meeting/Group meeting.md");
    const c = ctx(), s = scan(files(m, c), c);
    expect(s.groups.find(g => g.id === "meetings")).toBeUndefined();
    expect(s.reported.find(r => r.id === "left-alone")?.items.map(i => i.path)).toContain("00 Planning/To-dos/Order vials.md");
  });

  it("the rules are off without the meetings and hubFolders settings (planning kit off)", () => {
    const c: TidyContext = { ...ctx(), meetings: undefined, hubFolders: undefined };
    expect(scan(files(vault(), c), c).groups).toEqual([]);
  });
});

describe("Tidy up notes: folders without a hub (Phase 7c-1)", () => {
  it("proposes a hub only where Go to would find none (kind: hub, folder-named note, .base all count)", () => {
    const g = group(ctx(), vault(), "hub-missing");
    expect(g?.changes).toEqual([
      { path: "02 Projects/Projects.md", before: "", after: "kind: hub", create: true },
      { path: "06 Knowledge/Knowledge.md", before: "", after: "kind: hub", create: true },
    ]);
  });
});

describe("Tidy up notes: empty values count as missing", () => {
  it("a hub with empty interval / day / start is migrated and those lines are filled in place", () => {
    const m = vault();
    m.set("08 Meetings/Group meeting/Group meeting.md", "---\nkind: hub\ninterval:\nday:\nstart: 2026-01-01\n---\n");
    const hub = group(ctx({ interval: "fortnightly", day: "Tue" }), m, "meetings")?.changes.find(c => c.path.endsWith("Group meeting/Group meeting.md"));
    expect(hub?.after).toBe("kind: meeting-series\ninterval: fortnightly\nday: Tue\nstart: 2026-01-01");
  });
});

describe("Tidy up notes: to-dos without a kind", () => {
  it("adds the board's properties to notes with no kind and leaves notes that have one", () => {
    const m = vault();
    m.set("00 Planning/To-dos/Buy gloves.md", "---\ncssclasses:\n  - vt\ndone: true\n---\nbody\n");
    m.set("00 Planning/To-dos/Bare.md", "Just text\n");
    const g = group(ctx(), m, "todo-properties");
    expect(g?.changes).toEqual([
      { path: "00 Planning/To-dos/Bare.md", before: "", after: "kind: todo\nday: Backlog\ndone: false\nrolled: false" },
      { path: "00 Planning/To-dos/Buy gloves.md", before: "cssclasses:\n  - vt\ndone: true", after: "cssclasses:\n  - vt\ndone: true\nkind: todo\nday: Backlog\nrolled: false" },
    ]);
  });
  it("treats an empty kind as no kind and fills that line in place", () => {
    const m = vault();
    m.set("00 Planning/To-dos/Empty kind.md", "---\nkind:\nday: Backlog\nplanned: 2026-10-09\n---\nbody\n");
    const g = group(ctx(), m, "todo-properties");
    expect(g?.changes).toEqual([
      { path: "00 Planning/To-dos/Empty kind.md", before: "kind:\nday: Backlog\nplanned: 2026-10-09", after: "kind: todo\nday: Backlog\nplanned: 2026-10-09\ndone: false\nrolled: false" },
    ]);
  });
  it("applies with a backup, and a second scan finds nothing", async () => {
    const m = vault(); m.set("00 Planning/To-dos/Bare.md", "Just text\n");
    const c = ctx(), s = scan(files(m, c), c), x = io(m);
    await applyTidy(x, selectChanges(s, new Set(["todo-properties"])));
    expect(m.get("00 Planning/To-dos/Bare.md")).toBe("---\nkind: todo\nday: Backlog\ndone: false\nrolled: false\n---\nJust text\n");
    expect(x.backups.get("00 Planning/To-dos/Bare.md")).toBe("Just text\n");
    expect(group(c, m, "todo-properties")).toBeUndefined();
  });
  it("the vault fixture has none (every to-do there has a kind)", () => { expect(group(ctx(), vault(), "todo-properties")).toBeUndefined(); });
});

describe("Change notes: meetings and new hubs (Phase 7c-1)", () => {
  const all = (c: TidyContext, m: Map<string, string>) => { const s = scan(files(m, c), c); return selectChanges(s, new Set(s.groups.map(g => g.id))); };

  it("Cancel (nothing applied) writes nothing; an unticked rule is untouched", async () => {
    const m = vault(), old = new Map(m), c = ctx(), s = scan(files(m, c), c);
    await applyTidy(io(m), selectChanges(s, new Set()));
    expect(m).toEqual(old);
    await applyTidy(io(m), selectChanges(s, new Set(["hub-missing"])));
    expect(m.get("08 Meetings/Group meeting/Group meeting.md")).toBe(OLD_HUB);
    expect(m.get("02 Projects/Projects.md")).toBe("---\nkind: hub\n---\n");
  });

  it("every rewritten note has a backup equal to its old text; new notes need none", async () => {
    const m = vault(), old = new Map(m), c = ctx(), x = io(m);
    const out = await applyTidy(x, all(c, m));
    expect(out.skipped).toEqual([]);
    expect(out.created).toEqual(["02 Projects/Projects.md", "06 Knowledge/Knowledge.md"]);
    for (const p of out.changed) expect(x.backups.get(p)).toBe(old.get(p));
    expect(out.changed.length).toBe(3);
    expect(m.get("00 Planning/To-dos/Order vials.md")).toBe("---\nkind: todo\nmeeting: \"[[Group meeting]]\"\n---\n");
  });

  it("an existing file is never replaced by a new hub", async () => {
    const m = vault(), c = ctx(), changes = all(c, m);
    m.set("02 Projects/Projects.md", "mine");
    const out = await applyTidy(io(m), changes);
    expect(m.get("02 Projects/Projects.md")).toBe("mine");
    expect(out.skipped.map(s => s.path)).toEqual(["02 Projects/Projects.md"]);
  });

  it("a second scan finds nothing left for these rules", async () => {
    const m = vault(), c = ctx();
    await applyTidy(io(m), all(c, m));
    const s = scan(files(m, c), c);
    expect(s.groups.map(g => g.id)).toEqual([]);
  });
});
