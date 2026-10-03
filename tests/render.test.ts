// Ported from the v0.3 plain-Node test of the same name.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { CalcRenderer, type CalcEntry } from "../src/calc/render";
import { parseBlock } from "../src/calc/engine";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");

describe("render", () => {
  it("renders cross-block calcs, writes edits back, +Row, grid and copy", async () => {
    let clip = "";
    Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (t: string) => { clip = t; } } }, configurable: true });

    let fileText = "intro\n```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |\n```\n\n```calc\nname: b\n| P | Q |\n| q | 5 |\n```\n";
    const file = { path: "n.md" };
    const plugin: any = { app: { vault: { getAbstractFileByPath: () => file, cachedRead: async () => fileText,
      process: async (_f: unknown, fn: (d: string) => string) => { fileText = fn(fileText); } } }, registerEvent() { /* unused */ } };
    const renderer = new CalcRenderer(plugin);

    const el = new El("div");
    const blk = { source: "name: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |" };
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 1, lineEnd: 6 }) };
    const entry: CalcEntry = { el, ctx, source: blk.source };
    await renderer.render(entry);
    const tds = [...el.querySelectorAll("tbody td")].map((t: any) => t.textContent);
    assert.strictEqual(tds[1], "10", "cross-block calc failed");
    assert.ok(el.querySelector(".lab-calc-caption").textContent.length > 0);

    // simulate editing A2 = 3
    assert.ok(parseBlock(entry.source).cells.length > 0);
    await renderer.writeCell(entry, 1, 0, "3");
    assert.ok(fileText.includes("| 3 | =A2*b!B2 |"), "write-back failed");

    // grid toggle, copy, then +Row
    const btns = el.querySelectorAll(".lab-calc-btn");
    btns[1].dispatch("click"); btns[2].dispatch("click");
    btns[0].dispatch("click"); await new Promise(r => setTimeout(r, 10));
    assert.ok(fileText.includes("|  | =A3*b!B3 |"), "+Row failed");
    await new Promise(r => setTimeout(r, 10));
    assert.ok(clip.length > 0, "nothing copied");
    assert.ok([...el.querySelectorAll(".lab-calc-grid-row th")].map((t: any) => t.textContent).join(" ").includes("A"), "grid header missing");
  });
});
