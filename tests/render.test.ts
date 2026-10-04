// Ported from the v0.3 plain-Node test of the same name.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { TFile } from "obsidian";
import { CalcRenderer, type CalcEntry } from "../src/calc/render";
import { parseBlock } from "../src/calc/engine";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");

describe("render", () => {
  it("renders cross-block calcs, writes edits back, +Row, grid and copy", async () => {
    let clip = "";
    Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (t: string) => { clip = t; } } }, configurable: true });

    let fileText = "intro\n```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |\n```\n\n```calc\nname: b\n| P | Q |\n| q | 5 |\n```\n";
    const file = new TFile({ path: "n.md" });
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
    assert.ok(el.querySelector(".lab-kit-caption").textContent.length > 0);

    // simulate editing A2 = 3
    assert.ok(parseBlock(entry.source).cells.length > 0);
    await renderer.writeCell(entry, 1, 0, "3");
    assert.ok(fileText.includes("| 3 | =A2*b!B2 |"), "write-back failed");

    // grid toggle, copy, then +Row
    const btns = el.querySelectorAll(".lab-kit-btn");
    btns[1].dispatch("click"); btns[2].dispatch("click");
    btns[0].dispatch("click"); await new Promise(r => setTimeout(r, 10));
    assert.ok(fileText.includes("|  | =A3*b!B3 |"), "+Row failed");
    await new Promise(r => setTimeout(r, 10));
    assert.ok(clip.length > 0, "nothing copied");
    assert.ok([...el.querySelectorAll(".lab-kit-grid-row th")].map((t: any) => t.textContent).join(" ").includes("A"), "grid header missing");
  });

  it("marks empty body cells so they can be made taller", async () => {
    const source = "name: t\n| X | Y |\n|---|---|\n| 2 |  |";
    const plugin: any = { app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => "```calc\n" + source + "\n```\n" } }, registerEvent() { /* unused */ } };
    const el = new El("div");
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    await new CalcRenderer(plugin).render({ el, ctx, source });
    const blank = [...el.querySelectorAll("tbody td.is-blank")];
    assert.strictEqual(blank.length, 1);
    assert.strictEqual(el.querySelectorAll("th.is-blank").length, 0);
  });

  it("moves from one edited cell to the next with a single click", async () => {
    let fileText = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n";
    const plugin: any = { app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText,
      process: async (_f: unknown, fn: (d: string) => string) => { fileText = fn(fileText); } } }, registerEvent() { /* unused */ } };
    const renderer = new CalcRenderer(plugin);
    const el = new El("div");
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    const entry: CalcEntry = { el, ctx, source: "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |" };
    renderer.live.set("n.md", new Set([entry]));
    await renderer.render(entry);

    for (const typed of ["3", "2"]) { // changed value (saves + redraws), then unchanged (redraws only)
      const a = entry.tds!.get("1|0")!;
      a.dispatch("click");
      const input = a.querySelector("input");
      assert.ok(input, "editor did not open");
      input.value = typed;
      const b = entry.tds!.get("1|1")!;
      b.dispatch("mousedown"); // pressing the next cell blurs the editor, which redraws the table
      input.dispatch("blur");
      await new Promise(r => setTimeout(r, 10));
      assert.ok(fileText.includes(`| ${typed} | 5 |`), "edit not saved");
      const b2 = entry.tds!.get("1|1")!;
      assert.notStrictEqual(b2, b, "table was not redrawn");
      assert.ok(b2.querySelector("input"), "second cell did not open after one click");
      b2.querySelector("input").dispatch("keydown", { key: "Escape" });
      await new Promise(r => setTimeout(r, 10));
    }
  });

  it("Tab saves the typed text, Escape discards it, and neither key reaches Obsidian", async () => {
    let fileText = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n";
    const plugin: any = { app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText,
      process: async (_f: unknown, fn: (d: string) => string) => { fileText = fn(fileText); } } }, registerEvent() { /* unused */ } };
    const renderer = new CalcRenderer(plugin);
    const el = new El("div");
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    const entry: CalcEntry = { el, ctx, source: "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |" };
    renderer.live.set("n.md", new Set([entry]));
    await renderer.render(entry);

    for (const [key, typed, saved] of [["Escape", "9", false], ["Tab", "7", true]] as const) {
      const td = entry.tds!.get("1|0")!;
      td.dispatch("click");
      const input = td.querySelector("input");
      assert.ok(input, "editor did not open");
      input.value = typed;
      let stopped = false;
      for (const f of input.listeners.keydown) f({ key, preventDefault() { /* unused */ }, stopPropagation() { stopped = true; } });
      await new Promise(r => setTimeout(r, 10));
      assert.ok(stopped, `${key} was not kept from Obsidian`);
      assert.strictEqual(fileText.includes(`| ${typed} | 5 |`), saved, `${key}: wrong save result`);
    }
  });

  it("opens the clicked cell even when Obsidian rebuilds the block after the save", async () => {
    let fileText = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n";
    let processor: (s: string, el: unknown, ctx: unknown) => Promise<void> = async () => { /* set by register() */ };
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    const source = "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |";
    const el = new El("div");
    let el2: any = null;
    const plugin: any = {
      app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText, on: () => ({}),
        process: async (_f: unknown, fn: (d: string) => string) => {
          fileText = fn(fileText);
          Object.defineProperty(el, "isConnected", { value: false }); // the old block is gone
          el2 = new El("div");
          void processor(source, el2, ctx); // Obsidian renders the replacement a moment later
        } } },
      registerEvent() { /* unused */ },
      registerMarkdownCodeBlockProcessor(_lang: string, fn: typeof processor) { processor = fn; }
    };
    const renderer = new CalcRenderer(plugin);
    renderer.register();
    const entry: CalcEntry = { el, ctx, source };
    renderer.live.set("n.md", new Set([entry]));
    await renderer.render(entry);

    const a = entry.tds!.get("1|0")!;
    a.dispatch("click");
    const input = a.querySelector("input");
    input.value = "3";
    entry.tds!.get("1|1")!.dispatch("mousedown");
    input.dispatch("blur");
    await new Promise(r => setTimeout(r, 30));
    assert.ok(fileText.includes("| 3 | 5 |"), "edit not saved");
    const second = [...renderer.live.get("n.md")!].find(e => e.el === el2);
    assert.ok(second?.tds?.get("1|1")?.querySelector("input"), "second cell did not open in the rebuilt block");
  });

  it("opens the clicked cell when the rebuilt block is attached to the page late", async () => {
    let fileText = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n";
    let processor: (s: string, el: unknown, ctx: unknown) => Promise<void> = async () => { /* set by register() */ };
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    const source = "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |";
    const el = new El("div");
    let el2: any = null;
    const plugin: any = {
      app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText, on: () => ({}),
        process: async (_f: unknown, fn: (d: string) => string) => {
          fileText = fn(fileText);
          Object.defineProperty(el, "isConnected", { value: false }); // the old block is gone
          el2 = new El("div");
          const t0 = Date.now();
          Object.defineProperty(el2, "isConnected", { get: () => Date.now() > t0 + 120 }); // Obsidian attaches the new block a moment later
          void processor(source, el2, ctx); // Obsidian renders the replacement a moment later
        } } },
      registerEvent() { /* unused */ },
      registerMarkdownCodeBlockProcessor(_lang: string, fn: typeof processor) { processor = fn; }
    };
    const renderer = new CalcRenderer(plugin);
    renderer.register();
    const entry: CalcEntry = { el, ctx, source };
    renderer.live.set("n.md", new Set([entry]));
    await renderer.render(entry);

    const a = entry.tds!.get("1|0")!;
    a.dispatch("click");
    const input = a.querySelector("input");
    input.value = "3";
    entry.tds!.get("1|1")!.dispatch("mousedown");
    input.dispatch("blur");
    await new Promise(r => setTimeout(r, 400));
    assert.ok(fileText.includes("| 3 | 5 |"), "edit not saved");
    const second = [...renderer.live.get("n.md")!].find(e => e.el === el2);
    assert.ok(second?.tds?.get("1|1")?.querySelector("input"), "second cell did not open in the rebuilt block");
  });

  it("keeps the page where it was when an edited cell is saved and the block is rebuilt", async () => {
    let fileText = "```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | 5 |\n```\n";
    const scroller = new El("div"); scroller.className = "cm-scroller";
    scroller.scrollTop = 480;
    const el = new El("div"); scroller.appendChild(el);
    const ctx: any = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 0, lineEnd: 5 }) };
    const source = "name: a\n| X | Y |\n|---|---|\n| 2 | 5 |";
    const plugin: any = { app: { vault: { getAbstractFileByPath: () => new TFile({ path: "n.md" }), cachedRead: async () => fileText,
      process: async (_f: unknown, fn: (d: string) => string) => {
        fileText = fn(fileText);
        scroller.scrollTop = 0; // the redraw collapses the block and drags the page to the top
      } } }, registerEvent() { /* unused */ } };
    const renderer = new CalcRenderer(plugin);
    const entry: CalcEntry = { el, ctx, source };
    renderer.live.set("n.md", new Set([entry]));
    await renderer.render(entry);

    const a = entry.tds!.get("1|0")!;
    a.dispatch("click");
    const input = a.querySelector("input");
    input.value = "3";
    input.dispatch("blur");
    await new Promise(r => setTimeout(r, 30));
    assert.ok(fileText.includes("| 3 | 5 |"), "edit not saved");
    assert.strictEqual(scroller.scrollTop, 480, "page jumped");

    // a later redraw of any block while the hold lasts (a big note redraws slowly) is corrected too
    scroller.scrollTop = 0;
    await renderer.render(entry);
    assert.strictEqual(scroller.scrollTop, 480, "late redraw dragged the page");

    // a wheel turn by the user ends the hold
    entry.tds!.get("1|0")!.dispatch("click");
    const input2 = entry.tds!.get("1|0")!.querySelector("input");
    input2.value = "4";
    input2.dispatch("blur");
    await new Promise(r => setTimeout(r, 10));
    scroller.dispatch("wheel");
    scroller.scrollTop = 900;
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(scroller.scrollTop, 900, "fought the user's own scrolling");
  });
});
