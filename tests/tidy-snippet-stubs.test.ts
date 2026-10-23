// Tidy up notes: the rule that offers the old NMR / GPC / DLS stub files for the trash (docs/plans/snippet-menu.md Phase 3).
import { describe, it, expect } from "vitest";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const DIR = "Extras/Templates/Snippets";
const ctx: TidyContext = { labFolder: "03 Lab Book/Notes", knowledgeFolder: "", inboxFolder: "", contractFolders: [], rootNotes: [], migrations: [], snippetsFolder: DIR };
const stub = (key: string, extra = "") => `<%*\n// icon: x\n${extra}tR += await tp.user.labSnippets(tp, "${key}");\n%>`;
const f = (name: string, text: string, dir = DIR): TidyFile => ({ path: `${dir}/${name}`, text });

describe("Tidy: old NMR, GPC and DLS stub files", () => {
  it("offers each kept 07-09 stub, not ticked; an edited icon or an extra comment still counts", () => {
    const r = scan([f("07 NMR samples.md", stub("nmr")), f("08 GPC samples.md", stub("gpc", "// my note\n")), f("09 DLS samples.md", stub("dls"))], ctx);
    const g = r.groups.find(x => x.id === "snippet-stubs")!;
    expect(g.title).toBe("Snippets: old NMR, GPC and DLS files");
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => [c.path, c.trash])).toEqual([[`${DIR}/07 NMR samples.md`, true], [`${DIR}/08 GPC samples.md`, true], [`${DIR}/09 DLS samples.md`, true]]);
  });

  it("leaves everything else alone: other calculators, other code, run: headers, snippets elsewhere, no folder", () => {
    const files = [f("01 Solution prep.md", stub("solution")), f("07 Mine.md", '<%*\nconst a = 1;\ntR += await tp.user.labSnippets(tp, "nmr");\n%>'),
      f("10 Combined results.md", "---\nrun: results\n---\n"), f("My NMR.md", "a table"), f("07 NMR samples.md", stub("nmr"), "Other")];
    expect(scan(files, ctx).groups.find(x => x.id === "snippet-stubs")).toBeUndefined();
    expect(scan([f("07 NMR samples.md", stub("nmr"))], { ...ctx, snippetsFolder: undefined }).groups.find(x => x.id === "snippet-stubs")).toBeUndefined();
  });

  it("the scan reads the text of the files in the Snippets folder", () => {
    expect(wantsText(`${DIR}/07 NMR samples.md`, ctx, false)).toBe(true);
    expect(wantsText(`${DIR}/Old/07 NMR samples.md`, ctx, false)).toBe(false);
    expect(wantsText(`${DIR}/07 NMR samples.md`, { ...ctx, snippetsFolder: undefined }, false)).toBe(false);
  });

  const io = (files: Map<string, string>, trash = true): TidyIO & { trashed: string[]; backups: Map<string, string> } => {
    const trashed: string[] = [], backups = new Map<string, string>();
    return {
      trashed, backups,
      read: async p => files.get(p) ?? null, write: async () => {}, exists: p => files.has(p), filesIn: p => files.has(p) ? [p] : [], linkedFrom: () => [],
      backup: async (p, t) => { backups.set(p, t); return `backups/${p}`; }, create: async () => {}, rename: async () => {}, settingSnapshot: () => "", setSetting: async () => null,
      ...(trash ? { trash: async (p: string) => { trashed.push(p); files.delete(p); } } : {}),
    };
  };
  const path = `${DIR}/07 NMR samples.md`;

  it("Change notes copies the file to the backups folder, then trashes it; nothing else is touched", async () => {
    const files = new Map([[path, stub("nmr")], ["a.md", "x"]]);
    const h = io(files);
    const scanned = scan([f("07 NMR samples.md", stub("nmr"))], ctx);
    const out = await applyTidy(h, selectChanges(scanned, new Set(["snippet-stubs"])));
    expect(out.trashed).toEqual([path]);
    expect(h.trashed).toEqual([path]);
    expect(h.backups.get(path)).toBe(stub("nmr"));
    expect([...files.keys()]).toEqual(["a.md"]);
  });

  it("a rule left unticked trashes nothing", async () => {
    const h = io(new Map([[path, stub("nmr")]]));
    const out = await applyTidy(h, selectChanges(scan([f("07 NMR samples.md", stub("nmr"))], ctx), new Set()));
    expect(out.trashed).toEqual([]);
    expect(h.trashed).toEqual([]);
  });

  it("a file that is gone, or a vault that cannot trash, is skipped and named", async () => {
    const change = { path, before: "", after: "", trash: true };
    expect((await applyTidy(io(new Map()), [change])).skipped).toEqual([{ path, why: "the file is gone" }]);
    const out = await applyTidy(io(new Map([[path, stub("nmr")]]), false), [change]);
    expect(out.trashed).toEqual([]);
    expect(out.skipped[0].why).toContain("cannot move files to the trash");
  });
});
