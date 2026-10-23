// I2 Phase 4: Tidy up notes on the old-style fixture vault (tests/fixtures/i2-old-vaults/vault): "To-dos: give each card a date" (normalisePatch per note),
// "To-dos: lists read the planned date" (kept Weekly review / daily note queries) and the list of your own queries that read `day`.
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { datedTodos, scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";
import { dateOf, isFinishedTodo, normalisePatch, ymd } from "../src/planning/todo";
import { I2_ROOT, loadVault, readFm, TODO_DIR } from "./helpers/i2-vault";
import { DATES } from "./helpers/i2-model";

const ROOT = join(I2_ROOT, "vault");
const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: ["00 Home.md"], migrations: [],
  meetings: { folder: "08 Meetings", todos: TODO_DIR, today: "2026-10-21", interval: "weekly", day: "Thu" },
  buttonFolders: ["00 Planning", "02 Projects", "08 Meetings", "01 Daily Notes"],
  todoQueries: true,
};
const vault = (): Map<string, string> => new Map(loadVault("vault").map(n => [n.path, readFileSync(join(ROOT, n.path), "utf8")]));
const files = (m: Map<string, string>, c = ctx): TidyFile[] => [...m.keys()].map(path => ({ path, text: wantsText(path, c, false) ? m.get(path) : undefined }));
const io = (m: Map<string, string>): TidyIO => ({
  read: async p => m.get(p) ?? null, write: async (p, t) => { m.set(p, t); }, backup: async p => `backups/${p}`, exists: p => m.has(p),
  filesIn: p => [...m.keys()].filter(k => k === p), linkedFrom: () => [], rename: async () => undefined, create: async (p, t) => { m.set(p, t); },
  settingSnapshot: () => "", setSetting: async () => null,
});
const todoPaths = (m: Map<string, string>): string[] => [...m.keys()].filter(p => p.startsWith(`${TODO_DIR}/`));

describe("Tidy: To-dos: give each card a date", () => {
  it("opt-in; lists every to-do normalisePatch would change (the engine's own rule)", () => {
    const m = vault(), g = scan(files(m), ctx).groups.find(x => x.id === "todo-dates")!;
    expect(g.optIn).toBe(true);
    const want = todoPaths(m).filter(p => normalisePatch(readFm(m.get(p)!), DATES.wed)).sort();
    expect(g.changes.map(c => c.path).sort()).toEqual(want);
    expect(want.length).toBe(35);   // every old-style note has planned / rolled / countdown or an empty value
  });
  it("applied on Wed: each card keeps its dateOf date and finished state, no old keys or empty values, cssclasses last; a second scan lists 0", async () => {
    const m = vault(), before = new Map(todoPaths(m).map(p => [p, readFm(m.get(p)!)]));
    const s = scan(files(m), ctx);
    const changes = selectChanges(s, new Set(["todo-dates"]));
    const out = await applyTidy(io(m), changes);
    expect(out.skipped).toEqual([]);
    for (const p of todoPaths(m)) {
      const a = readFm(m.get(p)!), b = before.get(p)!;
      if (b.kind && b.kind !== "todo") continue;
      const was = dateOf(b, DATES.wed), now = dateOf(a, DATES.wed);
      expect(now && ymd(now), p).toBe(was && ymd(was));
      expect(isFinishedTodo(a), p).toBe(isFinishedTodo(b));
      for (const k of ["planned", "rolled", "countdown"]) expect(k in a, `${p}: ${k}`).toBe(false);
      if (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Backlog", "Done", null].includes(b.day as never)) expect("day" in a, p).toBe(false);
      for (const k of ["project", "due", "priority", "waiting", "scheduled"]) if (k in a) expect(a[k], `${p}: ${k}`).not.toBeNull();
      if ("cssclasses" in a) expect(m.get(p)!).toMatch(/cssclasses:\n {2}- vt\n---/);
    }
    expect(datedTodos(s, changes, out.changed)).toBe(changes.filter(c => /^scheduled:/m.test(c.after) && !/^scheduled:/m.test(c.before)).length);
    expect(datedTodos(s, changes, out.changed)).toBeGreaterThan(0);
    expect(scan(files(m), ctx).groups.find(x => x.id === "todo-dates")).toBeUndefined();
  });
  it("a typo day is kept; a note of another kind is left alone", () => {
    const m = vault(), g = scan(files(m), ctx).groups.find(x => x.id === "todo-dates")!;
    const typo = g.changes.find(c => c.path.endsWith("Day typo.md"));
    if (typo) expect(typo.after).toMatch(/^day: /m);
    m.set(`${TODO_DIR}/A list.md`, "---\nkind: list\nday: Mon\n---\n");
    expect(scan(files(m), ctx).groups.find(x => x.id === "todo-dates")!.changes.some(c => c.path.endsWith("A list.md"))).toBe(false);
  });
  it("datedTodos counts only applied changes that wrote a date", () => {
    const m = vault(), s = scan(files(m), ctx);
    const changes = selectChanges(s, new Set(["todo-dates"]));
    expect(datedTodos(s, changes, [])).toBe(0);
    expect(datedTodos(s, [], changes.map(c => c.path))).toBe(0);
  });
});

describe("Tidy: kept kit queries and your own queries that read day", () => {
  it("opt-in; the Weekly review's and the daily note's old query line become the kit's new one, the rest of the note kept", async () => {
    const m = vault(), s = scan(files(m), ctx), g = s.groups.find(x => x.id === "todo-queries")!;
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => c.path).sort()).toEqual(["00 Planning/Daily notes/2026-10-21.md", "00 Planning/Weekly review.md"]);
    const kitWR = readFileSync("kits/planning/00 Planning/Weekly review.md", "utf8"), kitDaily = readFileSync("kits/planning/Extras/Templates/Daily note.md", "utf8");
    await applyTidy(io(m), selectChanges(s, new Set(["todo-queries"])));
    const wr = m.get("00 Planning/Weekly review.md")!, daily = m.get("00 Planning/Daily notes/2026-10-21.md")!;
    const whereOf = (t: string, from: string): string => t.split("\n").find(l => l.includes(from) && l.includes("WHERE"))!.replace(/^[> ]*/, "");
    expect(whereOf(wr, "!scheduled")).toBe(whereOf(kitWR, "!scheduled"));
    expect(whereOf(daily, "scheduled <=")).toBe(whereOf(kitDaily, "scheduled <="));
    expect(wr.split("\n").length).toBe(readFileSync(join(ROOT, "00 Planning/Weekly review.md"), "utf8").split("\n").length);
    expect(scan(files(m), ctx).groups.find(x => x.id === "todo-queries")).toBeUndefined();
  });
  it("your own queries on day are listed, not changed; the kit's notes are not listed", () => {
    const r = scan(files(vault()), ctx).reported.find(x => x.id === "todo-own-queries")!;
    expect(r.items.map(i => i.path)).toEqual(["Own queries.md"]);
    expect(r.items[0].note).toContain("day");
    expect(scan(files(vault()), ctx).groups.flatMap(g => g.changes).some(c => c.path === "Own queries.md")).toBe(false);
  });
  it("lines outside code blocks, comments and dur(1 day) are not read as queries on day", () => {
    const m = new Map([["Notes/a.md", "---\nkind: note\n---\nThe day I ran it.\n\n```dataview\n// day = \"Mon\"\nLIST WHERE file.mtime >= date(today) - dur(1 day)\n```\n"]]);
    expect(scan(files(m), ctx).reported.find(x => x.id === "todo-own-queries")).toBeUndefined();
  });
  it("off without the planning kit: nothing extra is read or listed", () => {
    const off = { ...ctx, todoQueries: undefined };
    expect(wantsText("Own queries.md", off, false)).toBe(false);
    expect(scan(files(vault(), off), off).reported.find(x => x.id === "todo-own-queries")).toBeUndefined();
  });
  it("reading every note does not widen the button rule", () => {
    const m = new Map([["05 Other/x.md", "---\nkind: note\n---\n\n`BUTTON[todo]`\n"]]);
    expect(scan(files(m), ctx).groups.find(x => x.id === "button-bar")).toBeUndefined();
  });
});
