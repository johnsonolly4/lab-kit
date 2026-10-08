// "Make my own copy": every kit snippet run headless gives a plain note; an existing file is never overwritten.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { copyPath, hasFixedCodes, makeSnippetCopy, renderCopy, type HeadlessTp } from "../src/kit/snippet-copy";

const require = createRequire(import.meta.url);
const labSnippets = require("../kits/lab/Extras/scripts/templater/labSnippets.js");
const labMethods = require("../kits/lab/Extras/scripts/templater/labMethods.js");

const DATA = ".obsidian/plugins/lab-kit/data.json";
const TODAY = new Date(2026, 9, 9);

function stubApp(): void {
  const g = globalThis as any;
  g.Notice = class { constructor(_m: string) { /* not under test */ } };
  g.app = {
    vault: {
      configDir: ".obsidian",
      adapter: { read: async (p: string) => { if (p === DATA) return JSON.stringify({ kit: { initials: "OLJ" } }); throw new Error("ENOENT " + p); } },
      getFolderByPath: () => null,
    },
    workspace: { activeEditor: { editor: { getValue: () => "" } } },
    metadataCache: { getFileCache: () => ({ frontmatter: {} }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
  };
}

const KEYS = ["samples", "timetable", "nmr", "gpc", "dls", "results", "column", "rt", "blank", "method", "solution", "recipe", "raft", "matrix"];
const user = { labMethods };
const run = (key: string) => (tp: HeadlessTp) => labSnippets(tp, key) as Promise<string>;

describe("renderCopy", () => {
  it("gives a note for each of the 14 snippets (the four chemical ones from their example text)", async () => {
    stubApp();
    for (const key of KEYS) {
      const md = await renderCopy(run(key), user, TODAY);
      assert.ok(md.trim().length > 0, key);
      assert.ok(md.endsWith("\n"), key);
    }
  });

  it("holds fixed sample codes from a neutral note name", async () => {
    stubApp();
    const md = await renderCopy(run("samples"), user, TODAY);
    assert.ok(md.includes("OLJXXXX-A"), md);
  });

  it("fixes the 'Made on' date at copy time", async () => {
    stubApp();
    assert.ok((await renderCopy(run("solution"), user, TODAY)).includes("Made on: 2026-10-09"));
  });

  it("is what the snippet itself gives for the same answers (matrix, defaults then examples)", async () => {
    stubApp();
    const md = await renderCopy(run("matrix"), user, TODAY);
    assert.ok(!md.includes("e.g."), md);
    assert.ok(md.includes("acid 1") && md.includes("alcohol 1"), md);
  });

  it("is empty when the snippet gives nothing even with examples", async () => {
    assert.strictEqual(await renderCopy(async () => "  ", user), "");
  });
});

describe("copyPath", () => {
  it("is '<name> (mine).md' in the folder, then (mine 2), (mine 3)", () => {
    assert.strictEqual(copyPath("Templates/Snippets", "07 NMR samples", () => false), "Templates/Snippets/07 NMR samples (mine).md");
    const taken = new Set(["S/x (mine).md", "S/x (mine 2).md"]);
    assert.strictEqual(copyPath("S/", "x", p => taken.has(p)), "S/x (mine 3).md");
  });
});

describe("makeSnippetCopy", () => {
  it("writes a new file and never overwrites an existing one", async () => {
    stubApp();
    const files = new Map<string, string>([["Snippets/01 Solution prep (mine).md", "my edits"]]);
    const base = { key: "solution", name: "01 Solution prep", folder: "Snippets", user, run: run("solution"), today: TODAY,
      exists: (p: string) => files.has(p), write: async (p: string, t: string) => { files.set(p, t); } };
    const res = await makeSnippetCopy(base);
    assert.strictEqual(res.path, "Snippets/01 Solution prep (mine 2).md");
    assert.strictEqual(files.get("Snippets/01 Solution prep (mine).md"), "my edits");
    assert.ok(files.get(res.path)!.includes("```calc"));
    assert.strictEqual(res.fixedCodes, false);
  });

  it("says when the copy holds fixed sample codes", async () => {
    stubApp();
    const res = await makeSnippetCopy({ key: "nmr", name: "07 NMR samples", folder: "S", user, run: run("nmr"), today: TODAY, exists: () => false, write: async () => {} });
    assert.strictEqual(res.fixedCodes, true);
    assert.ok(hasFixedCodes("samples") && !hasFixedCodes("blank"));
  });

  it("writes nothing when the snippet gives no text", async () => {
    let wrote = false;
    await assert.rejects(makeSnippetCopy({ key: "x", name: "X", folder: "S", user, run: async () => "", exists: () => false, write: async () => { wrote = true; } }), /nothing to copy/);
    assert.strictEqual(wrote, false);
  });
});
