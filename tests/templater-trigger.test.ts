// Kit writes vs Templater's "Trigger on new file creation", and the user scripts folder both kits share.
import { describe, it, expect, vi } from "vitest";
import { withoutTemplaterTrigger } from "../src/kit/obsidian-private";
import { templaterScriptsTarget } from "../src/kit/managed";

describe("kit writes are hidden from Templater's file-creation trigger", () => {
  it("paths sit in Templater's pending set while writing and a while after, then leave", async () => {
    vi.useFakeTimers();
    (globalThis as any).window = globalThis;
    const pending = new Set<string>(["mine.md"]);
    const app = { plugins: { plugins: { "templater-obsidian": { templater: { files_with_pending_templates: pending } } } } } as any;
    let during: string[] = [];
    await withoutTemplaterTrigger(app, ["a.md", "mine.md"], async () => { during = [...pending]; });
    expect(during).toEqual(expect.arrayContaining(["a.md", "mine.md"]));
    expect(pending.has("a.md")).toBe(true);           // still there right after (Templater looks 300 ms later)
    vi.advanceTimersByTime(3000);
    expect([...pending]).toEqual(["mine.md"]);        // only ours removed
    vi.useRealTimers();
  });

  it("without Templater it just writes", async () => {
    expect(await withoutTemplaterTrigger({} as any, ["a.md"], async () => 7)).toBe(7);
  });
});

describe("Templater user scripts folder target", () => {
  it("is the folder above either kit's subfolder", () => {
    expect(templaterScriptsTarget("Extras/scripts/templater/lab-kit")).toBe("Extras/scripts/templater");
    expect(templaterScriptsTarget("Extras/scripts/templater/vault")).toBe("Extras/scripts/templater");
    expect(templaterScriptsTarget("vault")).toBe("vault");
  });
});
