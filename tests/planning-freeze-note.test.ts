// I19 / I20: freezeFile on a fake vault (src/planning/freeze-note.ts): lists written, to-dos stamped, never twice.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { freezeDue, freezeFile } from "../src/planning/freeze-note";
import { KIT_DEFAULTS, PLANNING_FOLDER_DEFAULTS, kitLoad, type KitData } from "../src/kit/paths";
import { FREEZE_AUTO } from "../src/planning/freeze";

interface F { path: string; basename: string; parent: { path: string }; stat: { ctime: number; mtime: number } }
function fakeApp(files: Record<string, { text: string; fm: Record<string, unknown> }>) {
  const f = (path: string): F => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, ""), parent: { path: path.split("/").slice(0, -1).join("/") }, stat: { ctime: 0, mtime: 0 } });
  const byPath = new Map(Object.keys(files).map(p => [p, f(p)]));
  const find = (x: unknown): string => [...byPath].find(([, v]) => v === x)![0];
  const app = {
    vault: {
      getMarkdownFiles: () => [...byPath.values()], getFileByPath: (p: string) => byPath.get(p) ?? null,
      getFolderByPath: (p: string) => (p === "00 Planning/To-dos" || p === "03 Lab" ? { path: p } : null),
      read: async (x: unknown) => files[find(x)].text, process: async (x: unknown, fn: (t: string) => string) => { files[find(x)].text = fn(files[find(x)].text); },
    },
    metadataCache: {
      getFileCache: (x: unknown) => ({ frontmatter: files[find(x)].fm }),
      getFirstLinkpathDest: (name: string) => [...byPath.values()].find(v => v.basename === name) ?? null,
    },
    fileManager: { processFrontMatter: async (x: unknown, fn: (fm: Record<string, unknown>) => void) => { fn(files[find(x)].fm); } },
  };
  return { app: app as never, files, byPath };
}
const kit = { planningFolders: { ...PLANNING_FOLDER_DEFAULTS }, labFolder: "03 Lab" } as unknown as KitData;
const MEET = "08 Meetings/Weekly meetings/2026-10-15 Weekly meetings.md";
const mk = () => fakeApp({
  [MEET]: { text: readFileSync("tests/fixtures/meeting-before.md", "utf8"), fm: { kind: "meeting", series: "[[Weekly meetings]]", date: "2026-10-15", since: "2026-10-08" } },
  "08 Meetings/Weekly meetings/Weekly meetings.md": { text: "", fm: { kind: "meeting-series" } },
  "00 Planning/To-dos/Fix pump.md": { text: "", fm: { kind: "todo", done: false, day: "Mon", meeting: "[[Weekly meetings]]" } },
  "00 Planning/To-dos/Seen before.md": { text: "", fm: { kind: "todo", done: false, day: "Mon", meeting: "[[Weekly meetings]]", raised_on: "2026-10-01" } },
});

describe("freezeFile", () => {
  it("writes the lists, sets frozen, stamps raised_on and keeps the earlier stamp", async () => {
    const { app, files } = mk();
    const r = await freezeFile(app, kit, app.vault.getFileByPath(MEET)!, new Date(2026, 9, 22));
    expect(r).toEqual({ done: true, flagged: 2 });
    expect(files[MEET].text).toContain("frozen: 2026-10-22");
    expect(files[MEET].text).toContain("> > - [[Fix pump]]");
    expect(files[MEET].text).toContain("> > - [[Seen before]] · raised 1 Oct");
    expect(files[MEET].text).not.toContain("show: meeting-done");
    expect(files[MEET].text).toContain("- agreed to repeat 0005");
    expect(files["00 Planning/To-dos/Fix pump.md"].fm.raised_on).toBe("2026-10-15");
    expect(files["00 Planning/To-dos/Seen before.md"].fm.raised_on).toBe("2026-10-01");
  });

  it("says why when it does nothing, and does not change a frozen note", async () => {
    const { app, files } = mk();
    const file = app.vault.getFileByPath(MEET)!;
    await freezeFile(app, kit, file, new Date(2026, 9, 22));
    const once = files[MEET].text;
    expect(await freezeFile(app, kit, file, new Date(2026, 10, 1))).toEqual({ done: false, why: "frozen", on: "2026-10-22" });
    expect(files[MEET].text).toBe(once);
    expect(await freezeFile(app, kit, app.vault.getFileByPath("00 Planning/To-dos/Fix pump.md")!)).toEqual({ done: false, why: "not-meeting" });
  });
});

describe("freezeDue (the daily check)", () => {
  const dated = (date: unknown, extra: Record<string, unknown> = {}) => {
    const m = mk();
    m.files[MEET].fm = { ...m.files[MEET].fm, date, ...extra };
    return m;
  };
  it("does not freeze on the day of the meeting, freezes the day after, and is the same on later days", async () => {
    const a = dated("2026-10-15");
    expect(await freezeDue(a.app, kit, new Date(2026, 9, 15))).toEqual([]);
    expect(a.files[MEET].text).not.toContain("frozen:");
    expect(await freezeDue(a.app, kit, new Date(2026, 9, 16))).toEqual([]);
    expect(a.files[MEET].text).toContain("frozen: 2026-10-16");
    const b = dated("2026-10-15");
    await freezeDue(b.app, kit, new Date(2026, 10, 20));
    expect(b.files[MEET].text).toContain("frozen: 2026-11-20");
  });
  it("freezeAuto off: the daily check freezes nothing, the command still does; default and bad values load as on", async () => {
    const m = dated("2026-10-15");
    const was = m.files[MEET].text;
    expect(await freezeDue(m.app, { ...kit, freezeAuto: false }, new Date(2026, 9, 20))).toEqual([]);
    expect(m.files[MEET].text).toBe(was);
    expect(await freezeFile(m.app, { ...kit, freezeAuto: false }, m.app.vault.getFileByPath(MEET)!, new Date(2026, 9, 20))).toEqual({ done: true, flagged: 2 });
    expect(m.files[MEET].text).toContain("frozen: 2026-10-20");
    expect(KIT_DEFAULTS.freezeAuto).toBe(true);
    expect(kitLoad({}).freezeAuto).toBe(true);
    expect(kitLoad({ freezeAuto: "x" }).freezeAuto).toBe(true);
    expect(kitLoad({ freezeAuto: false }).freezeAuto).toBe(false);
    expect([FREEZE_AUTO.name, FREEZE_AUTO.desc]).toEqual(["Freeze meeting notes automatically", "Freeze a meeting note the day after its date."]);
  });
  it("freezes nothing when the date is missing or unreadable", async () => {
    for (const d of [undefined, "", "next week"]) {
      const m = dated(d);
      const was = m.files[MEET].text;
      await freezeDue(m.app, kit, new Date(2027, 0, 1));
      expect(m.files[MEET].text).toBe(was);
    }
  });
  it("leaves a frozen note unchanged, and a date edited later after the freeze does not freeze it again", async () => {
    const m = dated("2026-10-15");
    await freezeDue(m.app, kit, new Date(2026, 9, 16));
    const once = m.files[MEET].text;
    await freezeDue(m.app, kit, new Date(2026, 9, 20));
    expect(m.files[MEET].text).toBe(once);
    m.files[MEET].fm.date = "2026-11-30";
    await freezeDue(m.app, kit, new Date(2026, 9, 21));
    expect(m.files[MEET].text).toBe(once);
  });
  it("a date edited to a later day before the freeze is not frozen until after that day", async () => {
    const m = dated("2026-10-15");
    m.files[MEET].fm.date = "2026-10-29";
    await freezeDue(m.app, kit, new Date(2026, 9, 20));
    expect(m.files[MEET].text).not.toContain("frozen:");
    await freezeDue(m.app, kit, new Date(2026, 9, 30));
    expect(m.files[MEET].text).toContain("frozen: 2026-10-30");
  });
  it("leaves a one-off meeting alone and writes nothing else of the owner's", async () => {
    const m = dated("2026-10-15");
    m.files["08 Meetings/Weekly meetings/Weekly meetings.md"].fm.interval = "once";
    await freezeDue(m.app, kit, new Date(2026, 9, 20));
    expect(m.files[MEET].text).not.toContain("frozen:");
    const n = dated("2026-10-15");
    await freezeDue(n.app, kit, new Date(2026, 9, 20));
    expect(n.files[MEET].text).toContain("- agreed to repeat 0005");
  });
});
