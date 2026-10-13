// Rig notes Phase 2: the ```rig block (src/rig/render.ts) hands the diagram text to Obsidian's renderer and lists the problems. Obsidian stub: nothing is drawn.
import { describe, it, expect, vi, afterEach } from "vitest";
import { MarkdownRenderer, TFile } from "obsidian";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { readRig } from "../src/rig/parts";
import { RigRenderer } from "../src/rig/render";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const NOTE = "Rigs/Rig A.md";
const FIXTURE = readFileSync("tests/fixtures/rigs/single-tubular.md", "utf8");
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
  const rendered: string[] = [];
  vi.spyOn(MarkdownRenderer, "render").mockImplementation(async (_app, md, el) => { rendered.push(md); (el as any).createDiv({ cls: "drawn" }); });
  const renderer = new RigRenderer(plugin);
  renderer.register();
  const children: any[] = [];
  const mount = async (path = NOTE) => {
    const el = new El("div");
    proc!("", el, { sourcePath: path, addChild: (c: any) => { children.push(c); c.onload(); } });
    await tick();
    return el;
  };
  return { notes, rendered, renderer, children, mount, modify: (path: string) => modify!({ path }) };
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("rig block", () => {
  it("passes the note's diagram as a mermaid block to Obsidian's renderer", async () => {
    const { mount, rendered } = setup(FIXTURE);
    const el = await mount();
    expect(rendered).toEqual(["```mermaid\n" + readRig(FIXTURE).mermaid + "\n```"]);
    expect(el.querySelectorAll(".lab-kit-rig .lab-kit-rig-diagram .drawn")).toHaveLength(1);
    expect(el.querySelector(".lab-kit-rig-problems")).toBeNull();
  });
  it("lists the problems under the diagram", async () => {
    const { mount } = setup("| ID | Part | Feeds |\n|---|---|---|\n| P1 | Pump | R9 |\n| | Mixer | |");
    const el = await mount();
    expect(el.querySelectorAll(".lab-kit-rig-diagram")).toHaveLength(1);
    expect(el.querySelectorAll(".lab-kit-rig-problems li").map((li: any) => li.textContent)).toEqual(["Row 2 of table 1 has no ID.", 'P1 feeds "R9", which is not the ID of a part.']);
  });
  it("a note without a parts table, or a note that is gone: the message, no diagram", async () => {
    const { mount, rendered } = setup("Nothing here yet.");
    for (const el of [await mount(), await mount("Rigs/Gone.md")]) {
      expect(el.querySelector(".lab-kit-rig-diagram")).toBeNull();
      expect(el.textContent).toBe("No parts table found: a parts table has an ID and a Feeds column.");
    }
    expect(rendered).toEqual([]);
  });
  it("redraws when its note changes, once; not for other notes, not when the diagram is the same, not after it is closed", async () => {
    vi.useFakeTimers();
    const { mount, modify, notes, rendered, children } = setup(FIXTURE);
    const el = await (async () => { const p = mount(); await vi.advanceTimersByTimeAsync(1); return p; })();
    const edit = async (path: string, text?: string) => { if (text != null) notes[NOTE] = text; modify(path); await vi.advanceTimersByTimeAsync(300); };

    await edit("Other.md");
    await edit(NOTE, FIXTURE + "\nA new line of text.");
    expect(rendered).toHaveLength(1);

    await edit(NOTE, FIXTURE.replace("| R1 |\n\n## Reactor line", "| BPR |\n\n## Reactor line"));
    expect(rendered).toHaveLength(2);
    expect(rendered[1]).toContain("P1 --> BPR");
    expect(el.querySelectorAll(".lab-kit-rig")).toHaveLength(1);

    children[0].onunload();
    await edit(NOTE, "No table any more.");
    expect(el.querySelectorAll(".lab-kit-rig-diagram")).toHaveLength(1);
  });
});
