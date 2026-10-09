// "Make my own copy": every kit snippet run headless gives a plain note; an existing file is never overwritten.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { canCopy, copyTokenTemplate, isStubSnippet, isTokenTemplate, snippetKey, copyPath, defaultCopyName, hasFixedCodes, makeSnippetCopy, renderCopy, withTitle, type HeadlessTp } from "../src/kit/snippet-copy";
import { parseTemplate } from "../src/kit/snippet-template";
import { miniYaml, shippedTemplate } from "./token-snippets";

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

const KEYS = ["nmr", "gpc", "dls", "results", "method", "solution", "recipe", "raft"];   // the six token-template snippets are not code any more (copying them: Phase 5)
const user = { labMethods };
const run = (key: string) => (tp: HeadlessTp) => labSnippets(tp, key) as Promise<string>;

describe("renderCopy", () => {
  it("gives a note for each of the 8 code snippets (the chemical ones from their example text)", async () => {
    stubApp();
    for (const key of KEYS) {
      const md = await renderCopy(run(key), user, TODAY);
      assert.ok(md.trim().length > 0, key);
      assert.ok(md.endsWith("\n"), key);
    }
  });

  it("fixes the 'Made on' date at copy time", async () => {
    stubApp();
    assert.ok((await renderCopy(run("solution"), user, TODAY)).includes("Made on: 2026-10-09"));
  });

  it("is what the snippet itself gives for the same answers (solution, defaults then examples)", async () => {
    stubApp();
    const md = await renderCopy(run("solution"), user, TODAY);
    assert.ok(!md.includes("e.g."), md);
    assert.ok(md.includes("solute 1"), md);
  });

  it("is empty when the snippet gives nothing even with examples", async () => {
    assert.strictEqual(await renderCopy(async () => "  ", user), "");
  });
});

describe("isStubSnippet", () => {
  it("is true for the stubs that call labSnippets.js and false for token templates, which the settings window can open", () => {
    const dir = "kits/lab/Templates/Snippets/";
    assert.ok(isStubSnippet(readFileSync(dir + "01 Solution prep.md", "utf8")));
    assert.ok(isStubSnippet(readFileSync(dir + "07 NMR samples.md", "utf8")));
    for (const f of ["04 Variant naming matrix", "05 Sample list", "06 Sampling timetable", "11 Flow column prep", "12 Residence times", "13 Blank calc table"]) {
      assert.ok(!isStubSnippet(readFileSync(`${dir}${f}.md`, "utf8")), f);
    }
  });
});

describe("copyPath", () => {
  it("is '<name>.md' in the folder, then '<name> 2', '<name> 3'", () => {
    assert.strictEqual(copyPath("Templates/Snippets", "My NMR", () => false), "Templates/Snippets/My NMR.md");
    const taken = new Set(["S/x.md", "S/x 2.md"]);
    assert.strictEqual(copyPath("S/", "x", p => taken.has(p)), "S/x 3.md");
  });

  it("offers '<name> (mine)' in the box", () => {
    assert.strictEqual(defaultCopyName("07 NMR samples"), "07 NMR samples (mine)");
  });
});

describe("makeSnippetCopy", () => {
  it("writes a new file and never overwrites an existing one", async () => {
    stubApp();
    const files = new Map<string, string>([["Snippets/01 Solution prep (mine).md", "my edits"]]);
    const base = { key: "solution", name: "01 Solution prep", copyName: "01 Solution prep (mine)", folder: "Snippets", user, run: run("solution"), today: TODAY,
      exists: (p: string) => files.has(p), write: async (p: string, t: string) => { files.set(p, t); } };
    const res = await makeSnippetCopy(base);
    assert.strictEqual(res.path, "Snippets/01 Solution prep (mine) 2.md");
    assert.strictEqual(files.get("Snippets/01 Solution prep (mine).md"), "my edits");
    assert.ok(files.get(res.path)!.includes("```calc"));
    assert.strictEqual(res.fixedCodes, false);
  });

  it("says when the copy holds fixed sample codes", async () => {
    stubApp();
    const res = await makeSnippetCopy({ key: "nmr", name: "07 NMR samples", copyName: "x", folder: "S", user, run: run("nmr"), today: TODAY, exists: () => false, write: async () => {} });
    assert.strictEqual(res.fixedCodes, true);
    assert.ok(hasFixedCodes("gpc") && !hasFixedCodes("blank"));
  });

  it("writes nothing when the snippet gives no text", async () => {
    let wrote = false;
    await assert.rejects(makeSnippetCopy({ key: "x", name: "X", copyName: "x", folder: "S", user, run: async () => "", exists: () => false, write: async () => { wrote = true; } }), /nothing to copy/);
    assert.strictEqual(wrote, false);
  });
});

describe("token template copy", () => {
  const dir = "kits/lab/Templates/Snippets/";
  const six = ["04 Variant naming matrix", "05 Sample list", "06 Sampling timetable", "11 Flow column prep", "12 Residence times", "13 Blank calc table"];

  it("is offered for the six token templates and not for stubs or plain notes", () => {
    for (const f of six) assert.ok(isTokenTemplate(readFileSync(`${dir}${f}.md`, "utf8"), miniYaml), f);
    assert.ok(!isTokenTemplate(readFileSync(dir + "01 Solution prep.md", "utf8"), miniYaml));
    assert.ok(!isTokenTemplate("just a plain snippet\n", miniYaml));
    assert.ok(!isTokenTemplate("---\nfields:\n  - key: a b\n---\nx", () => { throw new Error("bad"); }));
  });

  it("writes the template under the chosen title, never over an existing file, and the copy still fills like the original", async () => {
    const text = readFileSync(dir + "05 Sample list.md", "utf8");
    const files = new Map<string, string>([["S/05 Sample list (mine).md", "my edits"]]);
    const res = await copyTokenTemplate({ text, name: "05 Sample list", copyName: "05 Sample list (mine)", folder: "S",
      exists: p => files.has(p), write: async (p, t) => { files.set(p, t); } });
    assert.strictEqual(res.path, "S/05 Sample list (mine) 2.md");
    assert.strictEqual(res.fixedCodes, false);
    assert.strictEqual(files.get("S/05 Sample list (mine).md"), "my edits");
    const copy = files.get(res.path)!;
    assert.strictEqual(copy, text.replace("title: Sample list\n", "title: 05 Sample list (mine)\n"));
    const a = parseTemplate(copy, miniYaml)!, b = shippedTemplate("samples");
    assert.strictEqual(a.header.title, "05 Sample list (mine)");
    assert.deepStrictEqual({ ...a, header: { ...a.header, title: "" } }, { ...b, header: { ...b.header, title: "" } });
  });

  it("withTitle changes only the header's title, quotes odd names and adds a missing title", () => {
    const t = "---\ntitle: A\nicon: x\n---\n```calc\ntitle: A\n```\n";
    assert.strictEqual(withTitle(t, "B (mine)"), "---\ntitle: B (mine)\nicon: x\n---\n```calc\ntitle: A\n```\n");
    assert.ok(withTitle(t, "a: b").startsWith('---\ntitle: "a: b"\n'));
    assert.strictEqual(withTitle("---\nicon: x\n---\nbody", "N"), "---\ntitle: N\nicon: x\n---\nbody");
    assert.strictEqual(withTitle("no header", "N"), "no header");
  });

  it("writes nothing for an empty template", async () => {
    let wrote = false;
    await assert.rejects(copyTokenTemplate({ text: " \n", name: "X", copyName: "x", folder: "S", exists: () => false, write: async () => { wrote = true; } }), /nothing to copy/);
    assert.strictEqual(wrote, false);
  });

  it("no longer lists the token snippets among the code snippets with fixed codes", () => {
    for (const k of ["samples", "timetable", "matrix"]) assert.ok(!hasFixedCodes(k), k);
    for (const k of ["nmr", "gpc", "dls", "results"]) assert.ok(hasFixedCodes(k), k);
  });
});

describe("which rows get the button", () => {
  it("reads the snippet key from the stub and leaves out the Analysis table", () => {
    const stub = (k: string) => `<%*\n// icon: x\ntR += await tp.user.labSnippets(tp, "${k}");\n%>`;
    assert.strictEqual(snippetKey(stub("solution")), "solution");
    assert.ok(canCopy(snippetKey(stub("nmr"))));
    assert.ok(!canCopy(snippetKey(stub("method"))));
    assert.ok(!canCopy(snippetKey("no script call here")));
  });
});
