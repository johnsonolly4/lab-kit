// Snippets that read other tables must find numbered copies (samples2, nmr2…) and combine them (BACKLOG v0.4).
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { extractBlocks, parseBlock, Workbook } from "../src/calc/engine";

const require = createRequire(import.meta.url);
const labSnippets = require("../kit/Extras/scripts/templater/labSnippets.js");

const table = (name: string, codes: string[]) =>
  "```calc\nname: " + name + "\n| Code | Description | Notes |\n|---|---|---|\n" + codes.map(c => `| ${c} |  |  |`).join("\n") + "\n```\n";

function harness(initial: string) {
  let note = initial;
  const g = globalThis as any;
  g.Notice = class { constructor(_m: string) { /* silent */ } };
  g.app = {
    vault: { adapter: { read: async () => JSON.stringify({ initials: "ABC" }) } },
    workspace: { activeEditor: { editor: { getValue: () => note } } },
    metadataCache: { getFileCache: () => ({ frontmatter: {} }), getFirstLinkpathDest: () => null },
    fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
  };
  const run = async (key: string, overrides: Record<string, unknown> = {}): Promise<string> => {
    const tp = {
      config: { target_file: { basename: "0001 - Test", path: "0001 - Test.md" } },
      file: { title: "0001 - Test" },
      date: { now: () => "2026_10_03" },
      user: {
        labForm: async (_tp: unknown, _t: string, fields: any[]) => {
          const v: Record<string, unknown> = {};
          for (const f of fields) if (f.key) v[f.key] = f.key in overrides ? overrides[f.key] : (f.type === "toggle" ? !!f.value : String(f.value ?? ""));
          return v;
        }
      }
    };
    const md: string = await labSnippets(tp, key);
    note += "\n" + md;
    return md;
  };
  const evaluate = () => {
    const blocks = extractBlocks(note).map(b => parseBlock(b.source));
    const wb = new Workbook(blocks, {});
    const cell = (name: string, addr: string): any => {
      const m = addr.match(/^([A-Z]+)(\d+)$/)!;
      return wb.cell(blocks.findIndex(b => b.name === name), +m[2] - 1, m[1].charCodeAt(0) - 65);
    };
    return { cell, names: blocks.map(b => b.name) };
  };
  return { run, evaluate, get note() { return note; }, set note(v: string) { note = v; } };
}

describe("snippets read numbered tables", () => {
  it("takes codes from samples2 when samples was deleted, and from all numbered copies", async () => {
    const h = harness(table("samples2", ["ABC0001-A", "ABC0001-B"]) + table("samples3", ["ABC0001-C"]));
    for (const key of ["nmr", "gpc", "dls"]) {
      const md = await h.run(key);
      for (const code of ["ABC0001-A", "ABC0001-B", "ABC0001-C"]) assert.ok(md.includes(code), `${key}: missing ${code}`);
    }
  });

  it("also accepts a singular sample table and a numbered sampling timetable", async () => {
    const h = harness(table("sample", ["ABC0001-A"]) + table("sample2", ["ABC0001-B"]));
    assert.ok((await h.run("nmr")).includes("ABC0001-B"));
    const h2 = harness(table("sampling2", ["ABC0001-A10", "ABC0001-A20"]) + table("sampling2_start", ["ignored"]));
    const md = await h2.run("gpc");
    assert.ok(md.includes("ABC0001-A20") && !md.includes("ignored"));
  });

  it("results table links every nmr table (nmr, nmr2)", async () => {
    const h = harness(table("samples2", ["ABC0001-A", "ABC0001-B", "ABC0001-C"]));
    await h.run("nmr");                                     // nmr: A B C
    h.note = h.note.replace("| 1 | ABC0001-A | CDCl3 | 1H |  |  |", "| 1 | ABC0001-A | CDCl3 | 1H | 42 |  |");
    const md2 = await h.run("nmr", { codes: "ABC0001-D" }); // nmr2: D only
    assert.ok(md2.includes("name: nmr2"));
    const res = await h.run("results", { codes: "ABC0001-A, ABC0001-D", gpc: false });
    assert.ok(res.includes("nmr!B$2:B$4") && res.includes("nmr2!B$2:B$2"), res);
    assert.strictEqual(h.evaluate().cell("results", "B2"), 42);
  });

  it("falls through to the next table when a code is not in the first", async () => {
    const h = harness(table("samples", ["ABC0001-A", "ABC0001-B"]));
    await h.run("nmr", { codes: "ABC0001-A" });           // nmr: A only
    h.note = h.note.replace("| 1 | ABC0001-A | CDCl3 | 1H |  |  |", "| 1 | ABC0001-A | CDCl3 | 1H | 42 |  |");
    const md2 = await h.run("nmr", { codes: "ABC0001-B" }); // nmr2: B only
    h.note = h.note.replace(md2, md2.replace("| 1 | ABC0001-B | CDCl3 | 1H |  |  |", "| 1 | ABC0001-B | CDCl3 | 1H | 77 |  |"));
    await h.run("results", { gpc: false });
    const ev = h.evaluate();
    assert.strictEqual(ev.cell("results", "B2"), 42);
    assert.strictEqual(ev.cell("results", "B3"), 77);
  });
});
