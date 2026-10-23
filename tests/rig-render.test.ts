// Rig block (src/rig/render.ts): the ```rig block shows the figure of its note as an <img> of the SVG the Figure… window makes, and lists the problems.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 2. Obsidian stub: no Markdown renderer is involved at all.
import { describe, it, expect, vi, afterEach } from "vitest";
import { MarkdownRenderer, TFile } from "obsidian";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { buildFigure } from "../src/rig/figure";
import { figureSvg } from "../src/rig/figure-svg";
import { makeFigure } from "../src/rig/figure-make";
import { controlLabel, readRig } from "../src/rig/parts";
import { RigRenderer } from "../src/rig/render";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const DIR = "tests/fixtures/rigs/";
const NOTE = "Rigs/Rig A.md";
const FIXTURE = readFileSync(DIR + "single-tubular.md", "utf8");
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

function setup(text: string) {
  const notes: Record<string, string> = { [NOTE]: text };
  let modify: ((f: { path: string }) => void) | undefined;
  let proc: ((src: string, el: any, ctx: any) => void) | undefined;
  const app: any = { vault: {
    getAbstractFileByPath: (p: string) => p in notes ? new TFile({ path: p }) : null,
    cachedRead: async (f: TFile) => notes[f.path],
    on: (_evt: string, fn: typeof modify) => { modify = fn; return {}; },
  } };
  const plugin: any = { app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing to clean up */ } };
  // every Blob handed to an <img> by URL, so a test can read the SVG the block shows
  const blobs = new Map<string, Blob>();
  const revoked: string[] = [];
  let n = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation((b: any) => { const u = `blob:test/${++n}`; blobs.set(u, b); return u; });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => { revoked.push(u); });
  const render = vi.spyOn(MarkdownRenderer, "render");
  const renderer = new RigRenderer(plugin);
  renderer.register();
  const children: any[] = [];
  const mount = async (path = NOTE) => {
    const el = new El("div");
    proc!("", el, { sourcePath: path, addChild: (c: any) => { children.push(c); c.onload(); } });
    await tick();
    return el;
  };
  const shown = async (el: any): Promise<string> => blobs.get(el.querySelector(".lab-kit-rig-diagram img").getAttribute("src"))!.text();
  return { notes, render, revoked, renderer, children, mount, shown, modify: (path: string) => modify!({ path }) };
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const fixtures = readdirSync(DIR).filter(f => f.endsWith(".md"));

describe("rig block", () => {
  it("has the 7 made-up fixture rigs", () => { expect(fixtures).toHaveLength(7); });

  for (const name of fixtures) {
    it(`${name}: shows the engine's SVG as an image, one data-part per part, no Markdown renderer`, async () => {
      const text = readFileSync(DIR + name, "utf8");
      const rig = readRig(text);
      const { mount, shown, render } = setup(text);
      const el = await mount();
      const expected = figureSvg(buildFigure(rig.parts, rig.links, { computer: controlLabel(text) || undefined })).svg;
      const svg = await shown(el);
      expect(svg).toBe(expected);
      expect(svg).toBe(makeFigure(text)!.svg);
      expect(svg.match(/data-part="/g)).toHaveLength(rig.parts.length);
      expect(svg).not.toMatch(/mermaid/i);
      expect(render).not.toHaveBeenCalled();
      expect(el.querySelectorAll(".lab-kit-rig .lab-kit-rig-diagram .lab-kit-rig-img")).toHaveLength(1);
      expect(el.querySelector(".lab-kit-rig-img").getAttribute("alt")).toBeTruthy();
      expect(el.querySelector(".lab-kit-rig-figure")).not.toBeNull();   // the Figure… button
    });
  }

  it("lists the problems under the figure", async () => {
    const { mount } = setup("| ID | Part | Feeds |\n|---|---|---|\n| P1 | Pump | R9 |\n| | Mixer | |");
    const el = await mount();
    expect(el.querySelectorAll(".lab-kit-rig-diagram")).toHaveLength(1);
    expect(el.querySelectorAll(".lab-kit-rig-problems li").map((li: any) => li.textContent)).toEqual(["Row 2 of table 1 has no ID.", 'P1 feeds "R9", which is not the ID of a part.']);
  });
  it("says which parts are drawn as a plain box", async () => {
    const { mount } = setup("| ID | Part | Feeds |\n|---|---|---|\n| X1 | Zorblax | OUT |\n| OUT | Outlet | |");
    const el = await mount();
    expect(el.textContent).toContain("Drawn as a plain box (kind not known): X1");
  });
  it("a note without a parts table, or a note that is gone: the message, no image", async () => {
    const { mount, render } = setup("Nothing here yet.");
    for (const el of [await mount(), await mount("Rigs/Gone.md")]) {
      expect(el.querySelector(".lab-kit-rig-diagram")).toBeNull();
      expect(el.querySelector("img")).toBeNull();
      expect(el.textContent).toBe("No parts table found: a parts table has an ID and a Feeds column.");
    }
    expect(render).not.toHaveBeenCalled();
  });
  it("redraws when its note changes, once; not for other notes, not when the figure is the same, not after it is closed", async () => {
    vi.useFakeTimers();
    const { mount, modify, notes, children, shown, revoked } = setup(FIXTURE);
    const el = await (async () => { const p = mount(); await vi.advanceTimersByTimeAsync(1); return p; })();
    const urls = (): string[] => el.querySelectorAll(".lab-kit-rig-img").map((i: any) => i.getAttribute("src"));
    const edit = async (path: string, text?: string) => { if (text != null) notes[NOTE] = text; modify(path); await vi.advanceTimersByTimeAsync(300); };
    const first = urls();
    expect(first).toHaveLength(1);

    await edit("Other.md");
    await edit(NOTE, FIXTURE + "\nA new line of text.");
    expect(urls()).toEqual(first);
    expect(revoked).toEqual([]);

    const changed = FIXTURE.replace("| R1 |\n\n## Reactor line", "| BPR |\n\n## Reactor line");
    expect(changed).not.toBe(FIXTURE);
    await edit(NOTE, changed);
    expect(urls()).toHaveLength(1);
    expect(urls()[0]).not.toBe(first[0]);
    expect(el.querySelectorAll(".lab-kit-rig")).toHaveLength(1);
    expect(revoked).toEqual(first);   // the old picture's URL is released
    expect(await shown(el)).toBe(makeFigure(changed)!.svg);

    children[0].onunload();
    expect(revoked).toHaveLength(2);
    await edit(NOTE, "No table any more.");
    expect(el.querySelectorAll(".lab-kit-rig-diagram")).toHaveLength(1);
  });
});
