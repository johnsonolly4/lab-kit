// Tidy "Old ZotLit templates from Lab Kit" (owner board 9 R1 a): Lab Kit's untouched copies go to the trash, anything changed stays.
import { describe, expect, it } from "vitest";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";
import { OLD_ZOTLIT_TEMPLATES } from "../src/kit/tidy-zotlit-files";

const ctx: TidyContext = { labFolder: "03 Lab Book/Notes", knowledgeFolder: "", inboxFolder: "", contractFolders: [], rootNotes: [], migrations: [], todoQueries: true };
const DIR = "Extras/Templates/ZotLit/";
const NAMES = Object.keys(OLD_ZOTLIT_TEMPLATES);
const group = (files: TidyFile[]) => scan(files, ctx).groups.find(g => g.id === "old-zotlit-templates");

describe("Tidy: old ZotLit templates from Lab Kit", () => {
  it("the three texts are the kit's (the Update literature note button, the Meta Bind data block)", () => {
    expect(NAMES).toEqual(["zotlit-note.liquid.md", "zotlit-content.liquid.md", "zotlit-lititem.liquid.md"]);
    expect(OLD_ZOTLIT_TEMPLATES["zotlit-note.liquid.md"]).toContain("BUTTON[update-litnote]");
  });
  it("offers a copy that still holds Lab Kit's text (also with Windows line endings), not ticked", () => {
    const g = group([...NAMES.map(n => ({ path: DIR + n, text: OLD_ZOTLIT_TEMPLATES[n] })), { path: "Templates/ZotLit/zotlit-note.liquid.md", text: OLD_ZOTLIT_TEMPLATES["zotlit-note.liquid.md"].replace(/\n/g, "\r\n") }])!;
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => [c.path, !!c.trash])).toEqual([...NAMES.map(n => [DIR + n, true]), ["Templates/ZotLit/zotlit-note.liquid.md", true]]);
  });
  it("leaves a changed copy (yours or refpane's) alone and says so; a file that was not read; backups and other folders", () => {
    const r = scan([{ path: DIR + "zotlit-note.liquid.md", text: "```refpane\nshow: paper\n```\n" }, { path: DIR + "zotlit-content.liquid.md" },
      { path: `Extras/kit-backups/2026-10-04T17-21-03-991Z/${DIR}zotlit-lititem.liquid.md`, text: OLD_ZOTLIT_TEMPLATES["zotlit-lititem.liquid.md"] },
      { path: "Other/zotlit-note.liquid.md", text: OLD_ZOTLIT_TEMPLATES["zotlit-note.liquid.md"] }], ctx);
    expect(r.groups.find(g => g.id === "old-zotlit-templates")).toBeUndefined();
    expect(r.reported.find(x => x.id === "left-alone")!.items.map(i => i.path)).toEqual([DIR + "zotlit-note.liquid.md"]);
  });
  it("is read with the planning kit's whole-vault read (wantsText)", () => {
    expect(wantsText(DIR + "zotlit-note.liquid.md", ctx, false)).toBe(true);
  });
  it("Change notes backs up each file, then trashes it", async () => {
    const files = new Map(NAMES.map(n => [DIR + n, OLD_ZOTLIT_TEMPLATES[n]])), trashed: string[] = [], backups = new Map<string, string>();
    const io: TidyIO = {
      read: async p => files.get(p) ?? null, write: async () => {}, exists: p => files.has(p), filesIn: p => [...files.keys()].filter(k => k === p), linkedFrom: () => [],
      backup: async (p, t) => { backups.set(p, t); return `backups/${p}`; }, create: async () => {}, rename: async () => {}, settingSnapshot: () => "", setSetting: async () => null,
      trash: async p => { trashed.push(p); files.delete(p); },
    };
    const s = scan([...files.entries()].map(([path, text]) => ({ path, text })), ctx);
    await applyTidy(io, selectChanges(s, new Set(["old-zotlit-templates"])));
    expect(trashed.sort()).toEqual(NAMES.map(n => DIR + n).sort());
    expect([...backups.keys()].sort()).toEqual(trashed.sort());
    expect(files.size).toBe(0);
  });
});
