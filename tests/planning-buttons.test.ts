// Every Meta Bind button id a planning kit note uses must be in the button templates Check setup adds.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PLANNING_BUTTONS } from "../src/planning/buttons";

const walk = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);

describe("planning buttons", () => {
  const known = new Set(PLANNING_BUTTONS.map(b => b.id));
  const used = new Map<string, string[]>();
  for (const f of walk("kits/planning").filter(p => p.endsWith(".md"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/BUTTON\[([^\]]*)\]/g)) {
      for (const id of m[1].split(",").map(s => s.trim()).filter(Boolean)) used.set(id, [...(used.get(id) ?? []), f]);
    }
  }

  it("finds the button ids the notes use", () => { expect(used.size).toBeGreaterThan(10); });

  it("has a template for every id used in a kit note", () => {
    const missing = [...used].filter(([id]) => !known.has(id) && id !== "id");
    expect(missing.map(([id, files]) => `${id} (${files[0]})`)).toEqual([]);
  });

  it("the New lab entry button calls the plugin command", () => {
    const lab = (PLANNING_BUTTONS as unknown as { id: string; actions: { command: string }[] }[]).find(b => b.id === "lab");
    expect(lab?.actions[0].command).toBe("lab-kit:new-lab-entry");
  });
});
