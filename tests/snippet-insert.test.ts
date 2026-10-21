// I23 Phase 6: Alt+S without Templater. The Insert snippet command lists the Snippets folder and the Methods folder, runs the pick on the
// kit scripts and the plugin's form, and puts the text at the cursor. The old test of Insert snippet.md's own code lives on here.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import { Notice, TFile } from "obsidian";
import { SnippetTemplates } from "../src/kit/snippet-run";
import { insertSnippet, formatNow, snippetTp, type InsertDeps } from "../src/kit/snippet-insert";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import type { FormField } from "../src/kit/snippet-form";

const require = createRequire(import.meta.url);
const labSnippets = require("../src/kit/bundled/labSnippets.js");
const labMethods = require("../src/kit/bundled/labMethods.js");

const FOLDER = "Templates/Snippets";
const snip = (name: string, text: string) => ({ file: new TFile({ path: `${FOLDER}/${name}.md`, basename: name }), text });
const header = (o: object, body: string): string => `---\n${JSON.stringify(o)}\n---\n${body}`;
const MASS_SPEC = { Columns: ["Sample", "m/z"], Results: ["m/z"] };

function setup(opts: { files: { file: TFile; text: string }[]; pick: string; withMethods?: boolean; templater?: boolean; answers?: Record<string, unknown> }) {
  const typed: string[] = [], forms: string[] = [], inserted: string[] = [], viaTemplater: string[] = [], shown: { name: string; icon?: string; desc?: string }[] = [];
  const texts = new Map(opts.files.map(f => [f.file.path, f.text]));
  const methodNote = { extension: "md", basename: "Mass spec", path: "Methods/Mass spec.md" };
  const app = {
    vault: {
      getMarkdownFiles: () => opts.files.map(f => f.file),
      cachedRead: async (f: TFile) => texts.get(f.path) ?? "",
      adapter: { read: async () => JSON.stringify({ kit: { initials: "ABC", methodsFolder: opts.withMethods ? "Methods" : "" } }) },
      getFolderByPath: (p: string) => p === "Methods" && opts.withMethods ? { children: [methodNote] } : null,
    },
    workspace: { activeEditor: { editor: { getValue: () => "" } }, getActiveFile: () => ({ basename: "0016 - Test", path: "0016 - Test.md" }) },
    metadataCache: { getFileCache: () => ({ frontmatter: MASS_SPEC }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
  };
  for (const f of opts.files) (f.file as { parent?: unknown }).parent = { path: FOLDER };
  const kit = { ...KIT_DEFAULTS, initials: "ABC" } as KitData;
  const real = new SnippetTemplates(app as never, () => kit, async () => {}, async (title, fields) => {
    forms.push(title);
    return Object.fromEntries((fields as FormField[]).filter(f => f.key).map(f => [f.key, opts.answers && f.key in opts.answers ? opts.answers[f.key] : f.type === "toggle" ? !!f.value : String(f.value ?? "")]));
  });
  const snippets = {
    meta: (f: TFile) => real.meta(f),
    run: (tp: never, f: TFile) => real.run(tp, f),
    menu: async (items: { name: string; icon?: string; desc?: string; value: unknown }[]) => { shown.push(...items); return items.find(i => i.name === opts.pick)?.value ?? null; },
  };
  const deps: InsertDeps = {
    app: app as never, snippets: snippets as never, scripts: { labSnippets, labMethods }, snippetFolder: FOLDER,
    form: async (title, fields) => { typed.push(title); return real["form"]!(title, fields); },
    templaterInsert: opts.templater ? async f => { viaTemplater.push(f.basename); return true; } : null,
  };
  const editor = { replaceSelection: (t: string) => { inserted.push(t); } };
  return { deps, editor: editor as never, shown, inserted, forms, typed, viaTemplater };
}

beforeEach(() => { Notice.messages.length = 0; });

describe("Insert snippet without Templater", () => {
  it("lists the snippet files, then NMR / GPC / DLS and the Methods folder's notes", async () => {
    const r = setup({ files: [snip("02 Beta", "b"), snip("01 Alpha", "a")], pick: "Alpha", withMethods: true });
    await insertSnippet(r.deps, r.editor);
    expect(r.shown.map(i => i.name)).toEqual(["Alpha", "Beta", "NMR samples", "GPC samples", "DLS samples", "Mass spec samples"]);
    expect(r.inserted).toEqual(["a"]);
  });

  it("a plain snippet is inserted as it is; a cancelled menu inserts nothing", async () => {
    const r = setup({ files: [snip("01 Plain", "// icon: star\nline 1\nline 2\n")], pick: "Plain" });
    await insertSnippet(r.deps, r.editor);
    expect(r.inserted).toEqual(["// icon: star\nline 1\nline 2\n"]);
    const c = setup({ files: [snip("01 Plain", "x")], pick: "nothing" });
    await insertSnippet(c.deps, c.editor);
    expect(c.inserted).toEqual([]);
  });

  it("a token template asks through the plugin's form and fills the text", async () => {
    const r = setup({ files: [snip("01 Hello", header({ title: "Hello", fields: [{ key: "who", label: "Who", value: "world" }] }, "Hello {{who}}\n"))], pick: "Hello", answers: { who: "Ann" } });
    await insertSnippet(r.deps, r.editor);
    expect(r.inserted).toEqual(["Hello Ann\n"]);
    expect(r.forms).toEqual(["Hello"]);
  });

  it("a run: calculator asks through the plugin's form (no Templater labForm) and gives what labSnippets.js gives", async () => {
    const r = setup({ files: [snip("10 Combined", header({ title: "Combined results", run: "results" }, ""))], pick: "Combined results", answers: { codes: "ABC0016-A, ABC0016-B" } });
    await insertSnippet(r.deps, r.editor);
    expect(r.typed.length).toBe(1);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]).toContain("ABC0016-A");
    expect(r.inserted[0]).toContain("ABC0016-B");
  });

  it("picking a method entry builds that method's table", async () => {
    const r = setup({ files: [snip("01 Alpha", "a")], pick: "Mass spec samples", withMethods: true, answers: { codes: "ABC0001-A" } });
    await insertSnippet(r.deps, r.editor);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]).toContain("name: mass_spec");
  });

  it("a plain snippet with Templater code goes through Templater when it is there, else a notice names it", async () => {
    const withT = setup({ files: [snip("05 Dated", "Today: <% tp.date.now() %>\n")], pick: "Dated", templater: true });
    await insertSnippet(withT.deps, withT.editor);
    expect(withT.viaTemplater).toEqual(["05 Dated"]);
    expect(withT.inserted).toEqual([]);
    const without = setup({ files: [snip("05 Dated", "Today: <% tp.date.now() %>\n")], pick: "Dated" });
    await insertSnippet(without.deps, without.editor);
    expect(without.inserted).toEqual([]);
    expect(Notice.messages.join("\n")).toContain("“Dated” holds Templater code");
  });

  it("no snippet files: the menu still lists NMR, GPC and DLS", async () => {
    const r = setup({ files: [], pick: "x" });
    await insertSnippet(r.deps, r.editor);
    expect(r.shown.map(i => i.name)).toEqual(["NMR samples", "GPC samples", "DLS samples"]);
    expect(r.inserted).toEqual([]);
  });

  it("the script globals are put back after the run", async () => {
    const g = window as unknown as Record<string, unknown>;
    g.app = "mine";
    const r = setup({ files: [snip("01 Plain", "x")], pick: "Plain" });
    await insertSnippet(r.deps, r.editor);
    expect(g.app).toBe("mine");
    delete g.app;
    await insertSnippet(r.deps, r.editor);
    expect("app" in g).toBe(false);
  });

  it("the method's tag is written to the note's tags: target_file is the active TFile, as processFrontMatter needs", async () => {
    vi.useFakeTimers();
    try {
      const r = setup({ files: [], pick: "NMR samples", answers: { codes: "ABC0016-A" } });
      const note = new TFile({ path: "0016 - Test.md", basename: "0016 - Test" });
      const fm: Record<string, unknown> = { tags: ["lab"] };
      const app = r.deps.app as unknown as { workspace: { getActiveFile: () => TFile }; fileManager: { processFrontMatter: (f: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void> } };
      app.workspace.getActiveFile = () => note;
      // like Obsidian: anything but a TFile is refused
      app.fileManager.processFrontMatter = async (f, fn) => { if (!(f instanceof TFile)) throw new Error("not a TFile"); fn(fm); };
      const g = window as unknown as Record<string, unknown>;
      g.app = r.deps.app;   // Obsidian's window.app outlives the run; tag() writes 800 ms later
      await insertSnippet(r.deps, r.editor);
      expect(r.inserted[0]).toContain("name: nmr");
      await vi.advanceTimersByTimeAsync(800);
      expect(fm.tags).toEqual(["lab", "NMR"]);
      delete g.app;
    } finally { vi.useRealTimers(); }
  });

  it("snippetTp gives the active note itself as target_file, null without one", () => {
    const note = new TFile({ path: "a/0016 - Test.md", basename: "0016 - Test" });
    const app = (active: TFile | null) => ({ workspace: { getActiveFile: () => active } }) as never;
    const tp = snippetTp(app(note), async () => null, { labSnippets: async () => "", labMethods: () => ({ menuEntries: async () => [] }) } as never);
    expect(tp.config?.target_file).toBe(note);
    expect(tp.file?.title).toBe("0016 - Test");
    expect(snippetTp(app(null), async () => null, {} as never).config?.target_file).toBeNull();
  });

  it("the tp date follows Templater's tokens the kit scripts use", () => {
    expect(formatNow("YYYY-MM-DD", new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(formatNow("YYYY_MM_DD HH:mm", new Date(2026, 0, 2, 3, 4))).toBe("2026_01_02 03:04");
  });
});
