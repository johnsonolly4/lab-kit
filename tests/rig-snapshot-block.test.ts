// The rig block and snapshots: the Save snapshot… button and the "changed since the last snapshot (date)" line. Plan: docs/plans/rig-block-no-mermaid.md, Phase 4.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { RigRenderer } from "../src/rig/render";
import { takeSnapshot } from "../src/rig/snapshot-io";
import { rigVault } from "./helpers/rig-vault";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const NOTE = "Rigs/Rig A.md";
const FIXTURE = readFileSync("tests/fixtures/rigs/single-tubular.md", "utf8");
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

function setup(text: string) {
  const v = rigVault({ [NOTE]: text });
  let proc: ((src: string, el: any, ctx: any) => void) | undefined;
  v.app.vault.on = () => ({});
  const plugin: any = { app: v.app, manifest: { version: "9.9.9" }, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing to clean up */ } };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const renderer = new RigRenderer(plugin);
  renderer.register();
  const mount = async () => {
    const el = new El("div");
    proc!("", el, { sourcePath: NOTE, addChild: (c: any) => { c.onload(); } });
    await tick(); await tick();
    return el;
  };
  return { v, renderer, mount, plugin };
}
const buttons = (el: any): string[] => el.querySelectorAll("button").map((b: any) => b.textContent);

afterEach(() => { vi.restoreAllMocks(); });

describe("rig block snapshots", () => {
  it("has Figure… and Save snapshot…; no 'changed since' line while there is no snapshot", async () => {
    const { mount } = setup(FIXTURE);
    const el = await mount();
    expect(buttons(el)).toEqual(["Figure…", "Save snapshot…"]);
    expect(el.textContent).not.toMatch(/Changed since/);
  });
  it("no buttons for a note without parts", async () => {
    const { mount } = setup("Nothing.");
    expect(buttons(await mount())).toEqual([]);
  });
  it("says 'changed since the last snapshot (date)' after a table edit, and not right after a snapshot", async () => {
    const { v, mount, renderer } = setup(FIXTURE);
    await takeSnapshot(v.app, v.file(NOTE), "9.9.9", new Date(2026, 9, 20, 12));
    let el = await mount();
    expect(el.textContent).not.toMatch(/Changed since/);
    v.files.set(NOTE, FIXTURE.replace("2.0 mL", "5.0 mL"));
    el = await mount();
    expect(el.textContent).toContain("Changed since the last snapshot (2026-10-20)");
    await takeSnapshot(v.app, v.file(NOTE), "9.9.9", new Date(2026, 10, 3, 12));
    renderer.refreshFile(NOTE);
    el = await mount();
    expect(el.textContent).not.toMatch(/Changed since/);
  });
  it("redraws the block when the line appears (the redraw key holds the snapshot state)", async () => {
    const { v, mount, renderer } = setup(FIXTURE);
    await takeSnapshot(v.app, v.file(NOTE), "9.9.9", new Date(2026, 9, 20, 12));
    const el = await mount();
    v.files.set(NOTE, FIXTURE.replace("2.0 mL", "5.0 mL"));
    renderer.refreshFile(NOTE);
    await tick(); await tick();
    expect(el.textContent).toContain("Changed since the last snapshot (2026-10-20)");
  });
});
