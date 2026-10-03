// Two tables with the same name: both warn, refs to the shared name are #REF! (BACKLOG v0.4).
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { CalcRenderer, type CalcEntry } from "../src/calc/render";
import { extractBlocks } from "../src/calc/engine";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");

const DUP = [
  "```calc", "name: a", "| X | Y |", "|---|---|", "| 2 | =A2*3 |", "```", "",
  "```calc", "name: a", "| P | Q |", "|---|---|", "| 5 | =b!A2 |", "```", "",
  "```calc", "name: b", "| M | N |", "|---|---|", "| 1 | =a!A2 |", "```", ""
].join("\n");
const UNIQUE = DUP.replace("name: a\n| P", "name: a2\n| P");

const cells = (el: any): string[] => [...el.querySelectorAll("tbody td")].map((t: any) => t.textContent);
const warns = (el: any): number => el.querySelectorAll(".lab-kit-warn").length;

/** Renders block `n` of the note the way Obsidian does; `info` says what getSectionInfo returns. */
async function renderBlock(text: string, n: number, info: "real" | "null") {
  const file = { path: "n.md" };
  const plugin: any = { app: { vault: { getAbstractFileByPath: () => file, cachedRead: async () => text } }, registerEvent() { /* unused */ } };
  const found = extractBlocks(text)[n];
  const el = new El("div");
  const ctx: any = { sourcePath: "n.md", getSectionInfo: () => info === "null" ? null : { lineStart: found.lineStart, lineEnd: found.lineEnd } };
  const entry: CalcEntry = { el, ctx, source: found.source };
  await new CalcRenderer(plugin).render(entry);
  return el;
}

describe("duplicate table names", () => {
  for (const info of ["real", "null"] as const) {
    it(`both tables warn, refs to the shared name are #REF! (getSectionInfo ${info})`, async () => {
      const first = await renderBlock(DUP, 0, info), second = await renderBlock(DUP, 1, info), third = await renderBlock(DUP, 2, info);
      assert.strictEqual(warns(first), 1);
      assert.strictEqual(warns(second), 1);
      assert.strictEqual(warns(third), 0);
      assert.strictEqual(cells(first)[1], "6");     // own cells still work
      assert.strictEqual(cells(second)[1], "1");    // can still read the unique table
      assert.strictEqual(cells(third)[1], "#REF!");
    });
  }
  it("no warning and normal results when names are unique", async () => {
    for (let n = 0; n < 3; n++) assert.strictEqual(warns(await renderBlock(UNIQUE, n, "real")), 0);
    assert.strictEqual(cells(await renderBlock(UNIQUE, 2, "real"))[1], "2");
  });
});
