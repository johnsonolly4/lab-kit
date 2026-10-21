import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { blockRange, parseBlock, writeInNote } from "../src/blocks/core";

// Phase 8: every saved solution note reads, and writing a line back with the value it already has changes no byte.
const DIR = join(__dirname, "fixtures", "solution");
const notes = readdirSync(DIR).filter(f => f.endsWith(".md")).map(f => [f, readFileSync(join(DIR, f), "utf8")] as const);

describe("live-block core: saved solution notes round-trip byte for byte", () => {
  it.each(notes)("%s", (_name, note) => {
    const lines = note.split("\n");
    let blocks = 0;
    lines.forEach((l, i) => {
      if (!/^```solution\s*$/.test(l)) return;
      const r = blockRange(note, i);
      expect(r).not.toBeNull();
      blocks++;
      const b = parseBlock(r!.source);
      if (b.newer) { expect(writeInNote(note, i, null, "x", "1")).toBeNull(); return; }
      for (const [k, v] of Object.entries(b.setup)) expect(writeInNote(note, i, null, k, v)).toBe(note);
      for (const s of b.steps) for (const [k, v] of Object.entries(s.values)) expect(writeInNote(note, i, s.name, k, v)).toBe(note);
    });
    expect(blocks).toBeGreaterThan(0);
  });
});
