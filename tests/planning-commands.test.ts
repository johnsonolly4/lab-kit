// Phase 4b: the planning commands (src/planning/commands.ts) and the kit's Meta Bind buttons that call them.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import type { EmbeddedKit } from "../src/kit/managed";
import { cleanName, sortedName, subfolders, todoFields } from "../src/planning/actions";
import { PlanningCommands, TPL } from "../src/planning/commands";
import { Platform } from "obsidian";
import { expectedMeeting, expectedOneOff, expectedSeries } from "./fixtures/meeting-expected";
import { kitLoad } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

// The text box, the picker and Templater are Obsidian's: the tests answer the boxes and record what the template is handed.
const answers: unknown[] = [];
vi.mock("../src/planning/ask", () => ({ ask: async () => answers.shift() ?? null, pick: async () => answers.shift() ?? null }));
// The entry window: the tests queue what was typed; a failed check (a taken name) moves on to the next answer, as the user typing again would.
type Answer = { title: string; values: Record<string, unknown> } | null;
const windows: Answer[] = [];
vi.mock("../src/planning/entry-window", () => ({
  openEntry: async (_app: unknown, _heading: string, _fields: unknown, initial: { validate?: (a: NonNullable<Answer>) => string | null } = {}) => {
    for (;;) { const a = windows.shift() ?? null; if (!a || !initial.validate?.(a)) return a; }
  },
}));
// The stand-in obsidian module parses YAML as JSON; the token templates need the real thing
vi.mock("obsidian", async orig => ({ ...(await orig<Record<string, unknown>>()), parseYaml: (await import("./token-snippets")).miniYaml }));
const created: { template: string; folder: string; handoff: unknown }[] = [];
let templaterOn = true;
vi.mock("../src/kit/obsidian-private", () => ({
  hasTemplater: () => templaterOn,
  templaterSettings: () => ({ templates_folder: "Extras/Templates" }),
  templaterCreateNote: async (_app: unknown, template: { path: string }, folder: { path: string }) => {
    created.push({ template: template.path, folder: folder.path, handoff: structuredClone((window as unknown as { vtMeeting?: unknown }).vtMeeting) }); return true;
  },
}));

const planning = embeddedKit("kits/planning") as EmbeddedKit;
const lab = embeddedKit("kits/lab") as EmbeddedKit;
const buttons = JSON.parse(readFileSync("src/planning/meta-bind-buttons.json", "utf8")) as
  { buttonTemplates: { id: string; actions: { type: string; command?: string; templateFile?: string; link?: string }[] }[] };
const actions = buttons.buttonTemplates.flatMap(b => b.actions.map(a => ({ button: b.id, ...a })));

/** The command IDs a fake plugin is asked to register. */
function registered(): string[] {
  const ids: string[] = [];
  const plugin = { app: {}, register: () => undefined, addCommand: (c: { id: string }) => { ids.push(c.id); } };
  new PlanningCommands(plugin as never, null as never, () => kitLoad(undefined), { openSettings: () => {}, findMoved: () => {} }).register();
  return ids;
}

describe("planning commands", () => {
  it("registers the fixed IDs (never renamed: buttons call them)", () => {
    expect(registered().sort()).toEqual(["add-result", "add-to-shopping", "archive-todos", "freeze-meeting", "link-todos-in-order", "new-concept", "new-extra-meeting", "new-meeting", "new-meeting-series", "new-one-off-meeting", "new-project", "new-project-note", "new-todo", "new-topic-hub",
      "open-deck", "open-todo-board", "quick-capture", "sort-inbox"]);
  });

  it("runs templates the planning kit ships", () => {
    const shipped = new Map(planning.manifest.files.map(f => [f.id, f.dest]));
    for (const t of Object.values(TPL)) expect(shipped.get(t.id), t.id).toBe(t.dest);
  });
});

describe("Meta Bind buttons (kit-files source, shipped in Phase 6)", () => {
  it("every lab-kit: command is registered", () => {
    const ids = new Set([...registered(), "new-lab-entry", "new-chemical"]);   // New lab entry is registered by the lab kit's UI (`src/kit/ui.ts`)
    const used = actions.filter(a => a.command?.startsWith("lab-kit:"));
    expect(used.length).toBe(12);
    for (const a of used) expect(ids.has(a.command!.slice("lab-kit:".length)), a.button).toBe(true);
  });

  it("no button runs a Templater file any more", () => {
    expect(actions.filter(a => a.type === "runTemplaterFile" || a.type === "templaterCreateNote" || a.templateFile)).toEqual([]);
  });

  it("every note a button opens is shipped by a kit", () => {
    const names = new Set([...planning.manifest.files, ...lab.manifest.files].map(f => f.dest.split("/").pop()!.replace(/\.md$/, "")));
    const links = actions.filter(a => a.link).map(a => a.link!.replace(/^\[\[|\]\]$/g, ""));
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) expect(names.has(l), l).toBe(true);
  });
});

describe("sort inbox rules", () => {
  it("cleans names as the old template", () => {
    expect(cleanName(" a/b: c? [x] #1 ")).toBe("a-b- c- -x- -1");
    expect(sortedName("Capture 2", null)).toBe("Capture 2");
    expect(sortedName("Capture 2", "")).toBe("Capture 2");
    expect(sortedName("Capture 2", "Buy THF")).toBe("Buy THF");
  });
  it("lists the root and the folders below it, not look-alikes", () => {
    expect(subfolders(["06 Knowledge/Polymers", "06 Knowledge", "06 Knowledge 2", "07 How-tos", "06 Knowledge/A"], "06 Knowledge"))
      .toEqual(["06 Knowledge", "06 Knowledge/A", "06 Knowledge/Polymers"]);
  });
  it("makes a to-do on the Backlog, keeping project / due / meeting", () => {
    const fresh: Record<string, unknown> = { tags: ["x"] };
    todoFields(fresh);
    expect(fresh).toEqual({ tags: ["x"], kind: "todo", done: false });
    const kept: Record<string, unknown> = { project: "[[P]]", due: "2026-10-09", meeting: true, done: true, day: "Mon" };
    todoFields(kept);
    expect(kept).toEqual({ project: "[[P]]", due: "2026-10-09", meeting: true, done: false, kind: "todo" });
  });
});

describe("Meeting notes without Templater (Phase 4)", () => {
  const MEETINGS = "08 Meetings";
  const TPLS = "Extras/Templates";
  const oldText = (n: string): string => readFileSync(`tests/fixtures/templates/old/${n}.md`, "utf8");
  const kitText = (n: string): string => readFileSync(`kits/planning/Extras/Templates/${n}.md`, "utf8");
  let made: { path: string; text: string }[] = [];
  let opened: string[] = [];
  /** A fake vault: `files` are existing notes (path → text), `fm` the properties the series hub has. */
  const makeCommands = (files: Record<string, string>, fm: Record<string, unknown> = { kind: "meeting-series", interval: "weekly", day: "Thu", start: "2026-10-01" }): PlanningCommands => {
    const entries = Object.keys(files).map(path => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, ""), parent: { path: path.split("/").slice(0, -1).join("/") }, stat: { ctime: 0, mtime: 0 } }));
    const byPath = (p: string) => entries.find(e => e.path === p) ?? null;
    const app = { vault: {
      getFolderByPath: (p: string) => (p === MEETINGS || p.startsWith(MEETINGS + "/") ? { path: p } : null),
      getAbstractFileByPath: (p: string) => byPath(p) ?? (made.some(m => m.path === p) ? { path: p } : entries.some(e => e.path.startsWith(p + "/")) ? { path: p } : null),
      getFileByPath: byPath, getMarkdownFiles: () => entries, createFolder: async () => undefined,
      cachedRead: async (f: { path: string }) => files[f.path],
      create: async (path: string, text: string) => { made.push({ path, text }); return { path }; } },
      metadataCache: { getFileCache: (f: { path: string }) => ({ frontmatter: f.path.endsWith("Group meeting.md") || f.path.endsWith("One-off.md") ? fm : {} }), getFirstLinkpathDest: (name: string) => byPath(`${TPLS}/${name}.md`) },
      workspace: { getLeaf: () => ({ openFile: async (f: { path: string }) => { opened.push(f.path); } }) } };
    return new PlanningCommands({ app, addCommand: () => undefined } as never, () => null, () => kitLoad(undefined), { openSettings: () => {}, findMoved: () => {} });
  };
  const group = { path: `${MEETINGS}/Group meeting/Group meeting.md`, name: "Group meeting", folder: `${MEETINGS}/Group meeting`, interval: "weekly" as const, day: 4, start: new Date(2026, 9, 1), template: "" };
  const call = (c: PlanningCommands, name: string, ...a: unknown[]): Promise<void> => (c as unknown as Record<string, (...x: unknown[]) => Promise<void>>)[name](...a);
  beforeEach(() => { answers.length = 0; windows.length = 0; created.length = 0; made = []; opened = []; templaterOn = true; vi.stubGlobal("window", Object.assign(globalThis, { setTimeout })); });

  it("New meeting: the note comes from the vault's token Meeting.md, in the series' folder, opened; Templater is not asked", async () => {
    const c = makeCommands({ [`${TPLS}/Meeting.md`]: kitText("Meeting"), [group.path]: "" });
    templaterOn = false;
    await call(c, "makeMeeting", group, "2026-10-22");
    expect(created).toEqual([]);
    expect(made).toHaveLength(1);
    expect(made[0].path).toBe(`${MEETINGS}/Group meeting/2026-10-22 Group meeting.md`);
    expect(made[0].text).toBe(expectedMeeting({ series: "Group meeting", date: "2026-10-22", since: "2026-10-15" }));
    expect(opened).toEqual([made[0].path]);
  });

  it("an old Templater Meeting.md in the vault is not run: the bundled text makes the note (Q7)", async () => {
    const c = makeCommands({ [`${TPLS}/Meeting.md`]: oldText("Meeting"), [group.path]: "" });
    await call(c, "makeMeeting", group, "2026-10-22");
    expect(created).toEqual([]);
    expect(made[0].text).toBe(expectedMeeting({ series: "Group meeting", date: "2026-10-22", since: "2026-10-15" }));
  });

  it("a series' own template in token format makes the note; one still in the old format runs through Templater with the hand-over while it is installed", async () => {
    const own = "---\nmake: note\n---\n---\nkind: meeting\nseries: \"[[{{series}}]]\"\n---\nMine\n";
    const files = { [`${TPLS}/Meeting.md`]: kitText("Meeting"), [`${TPLS}/Mine.md`]: own, [`${TPLS}/Old mine.md`]: oldText("Meeting"), [group.path]: "" };
    await call(makeCommands(files), "makeMeeting", { ...group, template: "Mine" }, "2026-10-22");
    expect(made[0]).toEqual({ path: `${MEETINGS}/Group meeting/2026-10-22 Group meeting.md`, text: "---\nkind: meeting\nseries: \"[[Group meeting]]\"\n---\nMine\n" });
    made = [];
    await call(makeCommands(files), "makeMeeting", { ...group, template: "Old mine" }, "2026-10-22");
    expect(made).toEqual([]);
    expect(created).toEqual([{ template: `${TPLS}/Old mine.md`, folder: `${MEETINGS}/Group meeting`, handoff: { series: "Group meeting", folder: `${MEETINGS}/Group meeting`, date: "2026-10-22", since: "2026-10-15" } }]);
    expect(window).not.toHaveProperty("vtMeeting");
  });

  it("a series' old-format own template without Templater: the kit's text makes the note", async () => {
    templaterOn = false;
    const files = { [`${TPLS}/Meeting.md`]: kitText("Meeting"), [`${TPLS}/Old mine.md`]: oldText("Meeting"), [group.path]: "" };
    await call(makeCommands(files), "makeMeeting", { ...group, template: "Old mine" }, "2026-10-22");
    expect(created).toEqual([]);
    expect(made[0].text).toBe(expectedMeeting({ series: "Group meeting", date: "2026-10-22", since: "2026-10-15" }));
  });

  it("since is the latest meeting held before the date; a taken name gets 2", async () => {
    const files = { [`${TPLS}/Meeting.md`]: kitText("Meeting"), [group.path]: "", [`${MEETINGS}/Group meeting/2026-10-22 Group meeting.md`]: "" };
    const c = makeCommands(files);
    (c as unknown as { app: { metadataCache: { getFileCache: unknown } } }).app.metadataCache.getFileCache = (f: { path: string }) => ({ frontmatter: f.path.includes("2026-10-22") ? { date: "2026-10-15" } : group.path === f.path ? { kind: "meeting-series", interval: "weekly", day: "Thu", start: "2026-10-01" } : {} });
    await call(c, "makeMeeting", group, "2026-10-22");
    expect(made[0].path).toBe(`${MEETINGS}/Group meeting/2026-10-22 Group meeting 2.md`);
    expect(made[0].text).toContain("since: 2026-10-15");
  });

  it("New one-off meeting: the One-off hub exists, the note is dated, titled, linked to its project; the old flag counts only for the first series", async () => {
    const hub = { ...group, path: `${MEETINGS}/One-off/One-off.md`, name: "One-off", folder: `${MEETINGS}/One-off`, interval: "once" as const };
    const files = { [`${TPLS}/One-off meeting.md`]: kitText("One-off meeting"), [group.path]: "", [hub.path]: "" };
    const c = makeCommands(files);
    (c as unknown as { app: { metadataCache: { getFileCache: unknown } } }).app.metadataCache.getFileCache = (f: { path: string }) => ({ frontmatter: f.path === hub.path ? { kind: "meeting-series", interval: "once", start: "2026-10-23" } : f.path === group.path ? { kind: "meeting-series", interval: "weekly", day: "Thu", start: "2026-10-01" } : {} });
    await call(c, "makeOneOff", "2026-10-23", "Cell line: review", "Alpha");
    expect(made[0].path).toBe(`${MEETINGS}/One-off/2026-10-23 Cell line- review.md`);
    expect(made[0].text).toBe(expectedOneOff({ series: "One-off", date: "2026-10-23", since: "2026-10-16", project: "Alpha", title: "Cell line- review", first: false }));
  });
});

describe("New meeting series command", () => {
  const MEETINGS = "08 Meetings";
  const tpl = { path: "Extras/Templates/Meeting series.md" };
  let made: { path: string; text: string }[] = [];
  const makeCommands = (existing: string[] = [], tplText: string | null = readFileSync("kits/planning/Extras/Templates/Meeting series.md", "utf8")): PlanningCommands => {
    const files = existing.map(path => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, ""), parent: { path: path.split("/").slice(0, -1).join("/") }, stat: { ctime: 0, mtime: 0 } }));
    const app = { vault: {
      getFolderByPath: (p: string) => (p === MEETINGS || p.startsWith(MEETINGS + "/") ? { path: p } : null),
      getAbstractFileByPath: (p: string) => existing.includes(p) || existing.some(e => e.startsWith(p + "/")) ? { path: p } : null,
      getFileByPath: (p: string) => (p === tpl.path && tplText !== null ? tpl : null),
      cachedRead: async () => tplText,
      create: async (path: string, text: string) => { made.push({ path, text }); return { path }; },
      getMarkdownFiles: () => files, createFolder: async () => undefined },
      workspace: { getLeaf: () => ({ openFile: async () => undefined }) },
      metadataCache: { getFileCache: () => ({ frontmatter: { kind: "meeting-series", interval: "weekly", day: "Thu", start: "2026-10-01" } }) } };
    const plugin = { app, addCommand: () => undefined };
    return new PlanningCommands(plugin as never, () => null, () => kitLoad(undefined), { openSettings: () => {}, findMoved: () => {} });
  };
  beforeEach(() => { answers.length = 0; windows.length = 0; created.length = 0; made = []; templaterOn = false; });

  it("the window's name, interval, first date, deck and template make the hub note; the day is the first date's weekday", async () => {
    windows.push({ title: "Group: meeting", values: { interval: "fortnightly", date: "2026-10-15", deck: '"C:\\Decks\\group.pptx"', template: "[[My meeting]]" } });
    await makeCommands().newSeries();
    expect(made).toHaveLength(1);
    expect(made[0].path).toBe("08 Meetings/Group- meeting/Group- meeting.md");
    expect(made[0].text).toBe(expectedSeries({ name: "Group- meeting", folder: "08 Meetings/Group- meeting", interval: "fortnightly", day: "Thu", start: "2026-10-15",
      deckKey: Platform.isMacOS ? "deck_mac" : "deck_windows", deck: "C:\\Decks\\group.pptx", template: "My meeting" }));
    expect(created).toEqual([]);   // Templater is not used
  });

  it("an old Templater Meeting series.md in the vault is not run: the bundled text makes the hub (Q7)", async () => {
    windows.push({ title: "Group", values: { interval: "weekly", date: "2026-10-15" } });
    await makeCommands([], readFileSync("tests/fixtures/templates/old/Meeting series.md", "utf8")).newSeries();
    expect(made[0].text).toBe(expectedSeries({ name: "Group", folder: "08 Meetings/Group", interval: "weekly", day: "Thu", start: "2026-10-15", deckKey: Platform.isMacOS ? "deck_mac" : "deck_windows", deck: "" }));
  });

  it("Esc in the window makes nothing", async () => {
    windows.push(null);
    await makeCommands().newSeries();
    expect(made).toEqual([]);
  });

  it("a name already used (series or folder) is refused and the window asks again; a typed number of weeks is that many weeks", async () => {
    windows.push({ title: "weekly meetings", values: { interval: "weekly", date: "2026-10-14" } }, { title: "Journal club", values: { interval: "5", date: "2026-10-14" } });
    await makeCommands(["08 Meetings/Weekly meetings/Weekly meetings.md"]).newSeries();
    expect(made[0].text).toContain("interval: every 5 weeks\nday: Wed\nstart: 2026-10-14\n");
    expect(made[0].path).toBe("08 Meetings/Journal club/Journal club.md");
  });
});
