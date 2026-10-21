// Tidy up notes: the opt-in rule for kit files no longer shipped (CI2, docs/plans/kit-layout-cleanup.md phase 2): labPick.js, labForm.js, an empty Extras/attachments.
import { describe, it, expect } from "vitest";
import { readsAllForOldScripts, scan, selectChanges, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const ctx: TidyContext = { labFolder: "03 Lab Book/Notes", knowledgeFolder: "", inboxFolder: "", contractFolders: [], rootNotes: [], migrations: [] };
const PICK = "Extras/scripts/templater/lab-kit/labPick.js", FORM = "Extras/scripts/templater/lab-kit/labForm.js";
const js = (path: string): TidyFile => ({ path });
const note = (path: string, text: string): TidyFile => ({ path, text });
const group = (files: TidyFile[], c: TidyContext = ctx) => scan(files, c).groups.find(g => g.id === "old-kit-files");

describe("Tidy: old kit files nothing uses", () => {
  it("offers labPick.js, labForm.js and an empty attachments folder, not ticked", () => {
    const g = group([js(PICK), js(FORM), note("03 Lab Book/Notes/ABC0001.md", "x")], { ...ctx, emptyOldFolders: ["Extras/attachments"] })!;
    expect(g.title).toBe("Old kit files nothing uses");
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => [c.path, !!c.trash, !!c.folder])).toEqual([[PICK, true, false], [FORM, true, false], ["Extras/attachments", true, true]]);
  });

  it("keeps labForm.js while a note calls the kit's Templater scripts, and says which", () => {
    const r = scan([js(PICK), js(FORM), note("Templates/My NMR.md", '<%* tR += await tp.user.labSnippets(tp, "nmr") %>')], ctx);
    expect(r.groups.find(g => g.id === "old-kit-files")!.changes.map(c => c.path)).toEqual([PICK]);
    expect(r.reported.find(x => x.id === "left-alone")!.items).toEqual([{ path: FORM, note: "kept: Templates/My NMR.md calls the kit's Templater scripts" }]);
  });

  it("leaves backups, hidden folders, other scripts and a vault without them alone", () => {
    expect(group([js(`Extras/kit-backups/2026-10-04T17-21-03-991Z/${PICK}`), js(".trash/labPick.js"), js("Extras/scripts/templater/lab-kit/labSnippets.js"), js("my-labPick.js")])).toBeUndefined();
    expect(group([])).toBeUndefined();
  });

  it("reads every note only while a labForm.js is there (not a backup copy)", () => {
    expect(readsAllForOldScripts([FORM])).toBe(true);
    expect(readsAllForOldScripts([PICK, `Extras/kit-backups/2026-10-04T17-21-03-991Z/${FORM}`])).toBe(false);
  });

  const io = (files: Map<string, string>, folders: Set<string>): TidyIO & { trashed: string[]; backups: Map<string, string> } => {
    const trashed: string[] = [], backups = new Map<string, string>();
    return {
      trashed, backups,
      read: async p => files.get(p) ?? null, write: async () => {}, exists: p => files.has(p) || folders.has(p),
      filesIn: p => [...files.keys()].filter(k => k === p || k.startsWith(p + "/")), linkedFrom: () => [],
      backup: async (p, t) => { backups.set(p, t); return `backups/${p}`; }, create: async () => {}, rename: async () => {}, settingSnapshot: () => "", setSetting: async () => null,
      trash: async p => { trashed.push(p); files.delete(p); folders.delete(p); },
    };
  };

  it("Change notes backs up each script, then trashes it; the empty folder goes without a backup", async () => {
    const files = new Map([[PICK, "pick"], [FORM, "form"]]), folders = new Set(["Extras/attachments"]);
    const h = io(files, folders);
    const scanned = scan([js(PICK), js(FORM)], { ...ctx, emptyOldFolders: ["Extras/attachments"] });
    const out = await applyTidy(h, selectChanges(scanned, new Set(["old-kit-files"])));
    expect(out.trashed).toEqual([PICK, FORM, "Extras/attachments"]);
    expect([...h.backups]).toEqual([[PICK, "pick"], [FORM, "form"]]);
    expect(files.size + folders.size).toBe(0);
  });

  it("a folder that got a file since the scan, or is gone, is skipped and named", async () => {
    const change = { path: "Extras/attachments", before: "", after: "", trash: true, folder: true };
    const out = await applyTidy(io(new Map([["Extras/attachments/a.png", "x"]]), new Set(["Extras/attachments"])), [change]);
    expect(out.trashed).toEqual([]);
    expect(out.skipped).toEqual([{ path: "Extras/attachments", why: "the folder is not empty any more" }]);
    expect((await applyTidy(io(new Map(), new Set()), [change])).skipped).toEqual([{ path: "Extras/attachments", why: "the folder is gone" }]);
  });
});
