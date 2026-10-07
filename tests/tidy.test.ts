// Phase 7a: Tidy up notes scan rules on a made-up fixture vault (pure scan, writes nothing).
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { applyMigration, diffRows, reportMarkdown, scan, wantsText, type Migration, type TidyContext, type TidyFile } from "../src/kit/tidy";

const ROOT = join(__dirname, "fixtures", "tidy-vault");
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
const hashes = (): Record<string, string> => Object.fromEntries(walk(ROOT).map(f => [relative(ROOT, f).split(sep).join("/"), createHash("sha256").update(readFileSync(f)).digest("hex")]));
const manifest = (id: string): { migrations: Migration[] } => JSON.parse(readFileSync(join(__dirname, "..", "kits", id, "kit-manifest.json"), "utf8"));

const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox",
  contractFolders: ["03 Lab Book", "05 Chemicals", "00 Inbox", "01 Daily Notes", "00 Planning", "02 Projects", "04 Literature", "06 Knowledge", "07 How-tos", "08 Meetings", "99 Archive", "Extras"],
  rootNotes: ["00 Home.md"],
  migrations: [...manifest("lab").migrations, ...manifest("planning").migrations],
};
const vault = (): TidyFile[] => {
  const paths = walk(ROOT).map(f => relative(ROOT, f).split(sep).join("/"));
  const readAll = paths.some(p => /(^|\/)view\.js$/.test(p));
  return paths.map(path => ({ path, text: wantsText(path, ctx, readAll) ? readFileSync(join(ROOT, path), "utf8") : undefined }));
};
const group = (s: ReturnType<typeof scan>, id: string) => s.groups.find(g => g.id === id);
const reported = (s: ReturnType<typeof scan>, id: string) => s.reported.find(r => r.id === id)?.items.map(i => i.path);

describe("Tidy up notes scan (Phase 7a)", () => {
  const before = hashes();
  const s = scan(vault(), ctx);

  it("writes nothing: every fixture file is unchanged", () => { expect(hashes()).toEqual(before); });

  it("lab Status list → text (one value); several values are left alone and reported", () => {
    expect(group(s, "lab-status-text")?.changes).toEqual([
      { path: "03 Lab Book/Notes/ABC0001-A.md", before: "Exp. Class: Test\nStatus:\n  - Planned\ndate: 2026-01-05", after: "Exp. Class: Test\nStatus: Planned\ndate: 2026-01-05" },
      { path: "03 Lab Book/Notes/ABC0002-A.md", before: "Status: [Closed]", after: "Status: Closed" },
    ]);
    const left = s.reported.find(r => r.id === "left-alone")?.items ?? [];
    expect(left.map(i => i.path)).toEqual(["03 Lab Book/Notes/ABC0003-A.md", "06 Knowledge/Clash.md"]);
    expect(left[0].note).toContain("2 values");
    expect(left[1].note).toContain("kind is already set");
  });

  it("Phase 7b: lab notes get the template's missing properties (empty): partial block, no block; a full block and an unnumbered note are left", () => {
    const g = group(s, "lab-template-properties");
    expect(g?.changes.map(c => c.path)).toEqual(["03 Lab Book/Notes/ABC0001-A.md", "03 Lab Book/Notes/ABC0002-A.md", "03 Lab Book/Notes/ABC0003-A.md", "03 Lab Book/Notes/ABC0004-A.md", "03 Lab Book/Notes/ABC0006-A.md"]);
    // after the Status rule (the properties are read as they will be), existing values and extra properties stay, only missing keys are added
    expect(g?.changes[0].after).toBe("Exp. Class: Test\nStatus: Planned\ndate: 2026-01-05\nType:\nPlan date:\nExp. Start:\nExp. End:\nChemicals:\nCoSHH:\nRA:\nObjective:\nOutcome:");
    expect(g?.changes[3].after).toBe("Status: Planned\nType:\nExp. Class:\nPlan date:\nExp. Start:\nExp. End:\nChemicals:\nCoSHH:\nRA:\nObjective:\nOutcome:");
    expect(g?.changes[4]).toMatchObject({ before: "" });
  });

  it("Phase 7b: moves: a folder and a file's folder, only when they exist and the new place is free", () => {
    expect(group(s, "move-folders")?.changes).toEqual([
      { path: "Extras/Templates/Scripts", before: "", after: "", to: "Extras/Templates/Actions", note: "1 file" },
      { path: "fonts", before: "", after: "", to: "Extras/fonts", note: "1 file" },
    ]);
    const taken = scan([{ path: "fonts/a.woff" }, { path: "Extras/fonts/b.woff" }], ctx);
    expect(taken.groups).toEqual([]);
    expect(taken.reported[0].items[0]).toEqual({ path: "fonts", note: "Extras/fonts already exists: not moved" });
  });

  it("knowledge notes: Type: Wiki → kind: concept, adds only the missing summary / sources / checked", () => {
    expect(group(s, "knowledge-concept")?.changes).toEqual([
      { path: "06 Knowledge/Polymer terms.md", before: "Type: Wiki\naliases: [terms]", after: "kind: concept\naliases: [terms]\nsummary:\nsources:\nchecked: false" },
      { path: "06 Knowledge/Solvent notes.md", before: "Type: Wiki\nsummary: Common solvents", after: "kind: concept\nsummary: Common solvents\nsources:\nchecked: false" },
    ]);
  });

  it("hubs: an index note without kind gets kind: hub (also when it has no properties); one with kind is left", () => {
    expect(group(s, "hub-kind")?.changes).toEqual([{ path: "07 How-tos/Cooking index.md", before: "tags: [how-to]", after: "tags: [how-to]\nkind: hub" }]);
    const bare = scan([{ path: "07 How-tos/Index.md", text: "# Index\n" }], { ...ctx, migrations: [] });
    expect(group(bare, "hub-kind")?.changes[0]).toMatchObject({ before: "", after: "kind: hub" });
  });

  it("only reported: untitled, double extension, canvas in the inbox, outside the layout, unused view.js", () => {
    expect(reported(s, "untitled")).toEqual(["00 Inbox/Untitled.md"]);
    expect(reported(s, "double-extension")).toEqual(["02 Projects/Draft. md.md"]);
    expect(reported(s, "inbox-canvas")).toEqual(["00 Inbox/Plan.canvas"]);
    expect(reported(s, "outside-contract")).toEqual(["Random root note.md", "Stray/Loose note.md"]);
    expect(reported(s, "unused-view-js")).toEqual(["Extras/scripts/old/view.js"]);
  });

  it("only reported: knowledge notes are checked as they will be after the changes (### outside code, summary, sources)", () => {
    expect(reported(s, "knowledge-headings")).toEqual(["06 Knowledge/Polymer terms.md"]);
    expect(reported(s, "knowledge-summary")).toEqual(["06 Knowledge/Polymer terms.md"]);
    expect(reported(s, "knowledge-sources")).toEqual(["06 Knowledge/Polymer terms.md", "06 Knowledge/Solvent notes.md"]);
  });

  it("a note that already matches is not listed anywhere", () => {
    const all = JSON.stringify(s);
    for (const p of ["Done concept.md", "Knowledge index.md", "ABC0005-A.md", "Notes about this folder.md", "Glovebox.md", "00 Home.md"]) expect(all).not.toContain(p);
  });

  it("notes outside the layout are not reported when no contract is given (planning kit off)", () => {
    expect(scan(vault(), { ...ctx, contractFolders: [] }).reported.find(r => r.id === "outside-contract")).toBeUndefined();
  });

  it("applyMigration: no properties, CRLF and quoted values", () => {
    const status = ctx.migrations.find(m => m.id === "lab-status-text") as Migration;
    expect(applyMigration("# No properties\n", status)).toBeNull();
    expect(applyMigration("---\r\nStatus:\r\n  - \"Planned\"\r\n---\r\nbody", status)).toEqual({ change: { before: "Status:\n  - \"Planned\"", after: "Status: Planned" } });
    expect(applyMigration("---\nStatus: Planned\n---\n", status)).toBeNull();
  });

  it("diffRows: a replaced line is one changed row; added and removed lines stand alone; amber / green / red", () => {
    expect(diffRows("a\nType: Wiki\nb", "a\nkind: concept\nb\nchecked: false").map(r => [r.kind, r.left, r.right])).toEqual([
      ["same", "a", "a"], ["changed", "Type: Wiki", "kind: concept"], ["same", "b", "b"], ["added", null, "checked: false"],
    ]);
    expect(diffRows("x\ny", "x").map(r => r.kind)).toEqual(["same", "removed"]);
    expect(diffRows("", "kind: hub")).toEqual([{ kind: "added", left: null, right: "kind: hub" }]);
  });

  it("report: counts, paths and not-ticked rules, no note text", () => {
    const md = reportMarkdown(s, new Set(["hub-kind"]));
    expect(md).toContain("12 changes in 5 rules");
    expect(md).toContain("## Add kind: hub to index notes (1)\n- 07 How-tos/Cooking index.md");
    expect(md).toContain("## Lab notes: Status list → text (2) (not ticked)");
    expect(md).toContain("## Only reported");
    expect(md).not.toContain("Common solvents");
  });
});
