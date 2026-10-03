// Cross-table references where the referenced table comes later in the note (BACKLOG v0.4).
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { TFile } from "obsidian";
import { CalcRenderer, type CalcEntry } from "../src/calc/render";
import { extractBlocks } from "../src/calc/engine";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");

const NOTE = "intro\n```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |\n```\n\n```calc\nname: b\n| P | Q |\n| q | 5 |\n```\n";

function setup(text: string) {
  const file = new TFile({ path: "n.md" });
  const plugin: any = { app: { vault: { getAbstractFileByPath: () => file, cachedRead: async () => text } }, registerEvent() { /* unused */ } };
  return new CalcRenderer(plugin);
}
const cells = (el: any): string[] => [...el.querySelectorAll("tbody td")].map((t: any) => t.textContent);

/** Renders block `n` of the note the way Obsidian does; `info` says what getSectionInfo returns. */
async function renderBlock(text: string, n: number, info: "real" | "null") {
  const renderer = setup(text);
  const found = extractBlocks(text)[n];
  const el = new El("div");
  const ctx: any = { sourcePath: "n.md", getSectionInfo: () => info === "null" ? null : { lineStart: found.lineStart, lineEnd: found.lineEnd } };
  const entry: CalcEntry = { el, ctx, source: found.source };
  await renderer.render(entry);
  return el;
}

describe("cross-table refs to a later table", () => {
  it("first table reads the second (real section info)", async () => {
    assert.strictEqual(cells(await renderBlock(NOTE, 0, "real"))[1], "10");
  });
  it("first table reads the second (getSectionInfo null)", async () => {
    assert.strictEqual(cells(await renderBlock(NOTE, 0, "null"))[1], "10");
  });
  it("second table reads the first", async () => {
    const note = NOTE.replace("| q | 5 |", "| q | =a!A2*3 |");
    assert.strictEqual(cells(await renderBlock(note, 1, "real"))[1], "6");
  });
  it("tables that refer to each other (different cells)", async () => {
    const note = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |\n| 3 | =b!A2 |\n```\n\n```calc\nname: b\n| P | Q |\n| =a!A2+1 | 5 |\n```\n";
    const a = cells(await renderBlock(note, 0, "real"));
    assert.deepStrictEqual([a[1], a[3]], ["10", "3"]);
    assert.strictEqual(cells(await renderBlock(note, 1, "real"))[0], "3");
  });
  it("name typed with other capitals / quotes", async () => {
    const note = NOTE.replace("=A2*b!B2", "=A2*B!B2");
    assert.strictEqual(cells(await renderBlock(note, 0, "real"))[1], "10");
    const quoted = NOTE.replace("name: b", "name: My table").replace("=A2*b!B2", "=A2*'My table'!B2");
    assert.strictEqual(cells(await renderBlock(quoted, 0, "real"))[1], "10");
  });
  it("first table has no name", async () => {
    const note = NOTE.replace("name: a\n", "");
    assert.strictEqual(cells(await renderBlock(note, 0, "null"))[1], "10");
  });
});
