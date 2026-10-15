// Every Meta Bind button id a planning kit note uses must be in the button templates Check setup adds.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PLANNING_BUTTONS } from "../src/planning/buttons";
import { BAR_BUTTONS } from "../src/planning/button-bar";

const walk = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);

describe("planning buttons", () => {
  const known = new Set(PLANNING_BUTTONS.map(b => b.id));
  const used = new Map<string, string[]>();
  for (const f of walk("kits/planning").filter(p => p.endsWith(".md"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/BUTTON\[([^\]]*)\]/g)) {
      for (const id of m[1].split(",").map(s => s.trim()).filter(Boolean)) used.set(id, [...(used.get(id) ?? []), f]);
    }
  }

  const inBlocks = new Map<string, string[]>();   // ids named in `show: button-bar` blocks
  for (const f of walk("kits/planning").filter(p => p.endsWith(".md"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/show: button-bar\r?\n(?:[^`]*?\r?\n)?ids: ([^\r\n]*)/g)) {
      for (const id of m[1].split(/[,\s]+/).filter(Boolean)) inBlocks.set(id, [...(inBlocks.get(id) ?? []), f]);
    }
  }

  it("finds the button ids the notes use", () => { expect(used.size + inBlocks.size).toBeGreaterThan(10); expect(inBlocks.size).toBeGreaterThan(10); });

  it("every id in a button-bar block is in the plugin's table and not an unknown action", () => {
    for (const id of inBlocks.keys()) expect(BAR_BUTTONS.get(id)?.kind, id).toMatch(/^(command|open|edit)$/);
  });

  it("only the Weekly review and the ZotLit note template still use Meta Bind buttons (to be reworked, BACKLOG)", () => {
    const files = new Set([...used.values()].flat().map(f => f.replace(/\\/g, "/").replace(/^kits\/planning\//, "")));
    expect([...files].sort()).toEqual(["00 Planning/Weekly review.md", "Extras/Templates/ZotLit/zotlit-note.liquid.md"]);
  });

  it("has a template for every id used in a kit note", () => {
    const missing = [...used].filter(([id]) => !known.has(id) && id !== "id");
    expect(missing.map(([id, files]) => `${id} (${files[0]})`)).toEqual([]);
  });

  it("the New lab entry button calls the plugin command", () => {
    const lab = (PLANNING_BUTTONS as unknown as { id: string; actions: { command: string }[] }[]).find(b => b.id === "lab");
    expect(lab?.actions[0].command).toBe("lab-kit:new-lab-entry");
  });
});
