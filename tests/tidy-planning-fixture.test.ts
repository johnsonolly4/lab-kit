// The old-style planning notes in tests/fixtures/tidy-vault-planning (also copied by `npm run tidy-fixture`): each newer Tidy rule lists its note.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { changeKey, countRows, diffRows, pageSummary, replacesPage, scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";

const ROOT = join(__dirname, "fixtures", "tidy-vault-planning");
const T = "kits/planning/Extras/Templates/";
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
const hashes = (): Record<string, string> => Object.fromEntries(walk(ROOT).map(f => [relative(ROOT, f).split(sep).join("/"), createHash("sha256").update(readFileSync(f)).digest("hex")]));
const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: [], migrations: [],
  projectsFolder: "02 Projects", hubFolders: ["02 Projects", "06 Knowledge"],
  hubTemplates: { project: readFileSync(`${T}Project hub.md`, "utf8"), topic: readFileSync(`${T}New topic hub.md`, "utf8"), series: readFileSync(`${T}Meeting series.md`, "utf8") },
  meetings: { folder: "08 Meetings", todos: "00 Planning/To-dos", today: "2026-10-10", interval: "weekly", day: "Thu" },
};
const files = (): TidyFile[] => walk(ROOT).map(f => relative(ROOT, f).split(sep).join("/")).map(path => ({ path, text: wantsText(path, ctx, false) ? readFileSync(join(ROOT, path), "utf8") : undefined }));

describe("Tidy up notes on the old-style planning fixture", () => {
  const before = hashes();
  const s = scan(files(), ctx);
  const paths = (id: string) => s.groups.find(g => g.id === id)?.changes.map(c => c.path);

  it("a replaced hub page in short: only the lines that go, the goal counts as kept", () => {
    const alpha = s.groups.find(x => x.id === "hub-body")!.changes.find(c => c.path === "02 Projects/Alpha/Alpha.md")!;
    expect(replacesPage(alpha)).toBe(true);
    const sum = pageSummary(alpha.before, alpha.after);
    expect(sum.lost).toEqual(["# Alpha", "LIST FROM \"02 Projects/Alpha\""]);   // the goal moved into the Goal box; fence lines are in the new page too
    expect(sum.kept).toBe(3);
    expect(sum.added).toContain("show: project-map");
    expect(sum.added).not.toContain("> [goal:: Make a polymer library]");
    // the back link added to a project note only adds lines: it keeps the before / after grid
    const note = s.groups.find(x => x.id === "project-notes")!.changes.find(c => c.body)!;
    expect(replacesPage(note)).toBe(false);
    expect(countRows(diffRows(note.before, note.after))).toEqual({ added: 5, removed: 0, changed: 0 });
  });

  it("single notes of a ticked rule can be left out", () => {
    const g = s.groups.find(x => x.id === "todo-properties")!;
    expect(selectChanges(s, new Set(["todo-properties"])).length).toBe(g.changes.length);
    expect(selectChanges(s, new Set(["todo-properties"]), new Set([changeKey("todo-properties", 0)])).length).toBe(g.changes.length - 1);
    expect(selectChanges(s, new Set(), new Set()).length).toBe(0);   // an unticked rule gives nothing, whatever is "off"
  });

  it("lists each old note under its rule, and writes nothing", () => {
    expect(paths("project-properties")).toEqual(["02 Projects/Alpha/Alpha.md"]);
    expect(paths("project-notes")).toEqual(["02 Projects/Alpha/Method notes.md", "02 Projects/Alpha/Method notes.md", "02 Projects/Beta/Beta ideas.md", "02 Projects/Beta/Beta ideas.md"]);   // the properties, then the back link on the page; Beta's hub is made by this same scan
    expect(paths("project-hub-missing")).toEqual(["02 Projects/Beta/Beta.md"]);
    expect(paths("todo-properties")).toEqual(["00 Planning/To-dos/Order vials.md"]);
    expect(paths("meetings")).toContain("08 Meetings/Group meeting/Group meeting.md");
    expect(paths("meetings")).toContain("08 Meetings/Group meeting/2026-09-24 Group meeting.md");
    expect(paths("meetings")).toContain("00 Planning/To-dos/Book room.md");
    // the old project and series hubs are hubs after the rules above, so their pages are brought up to the template too
    expect(paths("hub-body")).toEqual(["02 Projects/Alpha/Alpha.md", "06 Knowledge/NMR/NMR.md", "08 Meetings/Group meeting/Group meeting.md"]);
    expect(s.reported.find(r => r.id === "left-alone")?.items.map(i => i.path)).toEqual(["08 Meetings/Loose/2026-09-01 Loose.md"]);
    expect(hashes()).toEqual(before);
  });

  it("I2 rules: the old-style to-dos get a date, the kept Weekly review and daily note queries the new line, own queries are listed", () => {
    const c: TidyContext = { ...ctx, todoQueries: true };
    const s2 = scan(walk(ROOT).map(f => relative(ROOT, f).split(sep).join("/")).map(path => ({ path, text: wantsText(path, c, false) ? readFileSync(join(ROOT, path), "utf8") : undefined })), c);
    const p2 = (id: string) => s2.groups.find(g => g.id === id)?.changes.map(x => x.path.split("/").pop());
    expect(p2("todo-dates")).toEqual(["Backlog with planned stamp.md", "Book room.md", "Day Done not ticked.md", "Day typo.md", "Mon planned this week.md", "Order vials.md", "Rolled to Wed.md", "Wed no planned.md"]);
    expect(p2("todo-queries")).toEqual(["Weekly review.md", "2026-10-21.md"]);
    expect(s2.reported.find(r => r.id === "todo-own-queries")?.items.map(i => i.path)).toEqual(["00 Planning/Own queries.md"]);
    expect(hashes()).toEqual(before);
  });

  it("Templater Phase 6: the hub pages are the same from the new-format templates as from the old Templater ones (tests/fixtures/templates/old/)", () => {
    const O = "tests/fixtures/templates/old/";
    const oldCtx: TidyContext = { ...ctx, hubTemplates: { ...ctx.hubTemplates!, project: readFileSync(`${O}Project hub.md`, "utf8"), topic: readFileSync(`${O}New topic hub.md`, "utf8") } };
    const hubs = (c: TidyContext) => scan(files(), c).groups.find(g => g.id === "hub-body")!.changes.filter(x => !x.path.startsWith("08 Meetings/")).map(x => [x.path, x.after]);
    const now = hubs(ctx), before = hubs(oldCtx);
    expect(now.map(([p]) => p)).toEqual(["02 Projects/Alpha/Alpha.md", "06 Knowledge/NMR/NMR.md"]);
    expect(now).toEqual(before);
    // no template header in any replaced page, the meeting series hub's too (its template went to the new format in Phase 4)
    for (const c of scan(files(), ctx).groups.find(g => g.id === "hub-body")!.changes) expect(c.after, c.path).not.toMatch(/make: note|\{\{|<%|^kind:/m);
  });
});
