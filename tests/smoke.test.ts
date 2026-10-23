// S1 (docs/plans/obsidian-update-robustness.md): the pure parts of scripts/smoke.mjs. The run itself needs a real Obsidian (node scripts/smoke.mjs).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
// @ts-expect-error plain .mjs script
import { seedFiles, internalClasses, formatReport, CALLOUT_TYPES, PREFIX_ONLY, MUST_SEE } from "../scripts/smoke.mjs";

const rig = readFileSync("tests/fixtures/rigs/two-pumps-mixer.md", "utf8");
const files = seedFiles(rig) as Record<string, string>;

describe("smoke seed vault", () => {
  it("is deterministic and synthetic (no personal paths or names)", () => {
    expect(seedFiles(rig)).toEqual(files);
    for (const [path, text] of Object.entries(files)) expect(path + text).not.toMatch(/\/Users\/|@[a-z]+\.[a-z]+|oliver/i);
  });
  it("holds the 0011 known answer, 8 lab notes in the Lab book board's statuses, a to-do chain, a rig and a callout note", () => {
    expect(files["03 Lab Book/Notes/0011 Smoke experiment.md"]).toContain("| Reactor volume | =b8-0.21 |");
    const notes = Object.keys(files).filter(p => p.startsWith("03 Lab Book/Notes/"));
    expect(notes).toHaveLength(8);
    const statuses = new Set(notes.map(p => /^Status: (.*)$/m.exec(files[p])![1]));
    expect([...statuses].sort()).toEqual(["Closed", "Planned", "Processing results", "Started"]);
    expect(Object.keys(files).filter(p => p.startsWith("00 Planning/To-dos/"))).toHaveLength(5);
    expect(files["03 Lab Book/Rigs/Smoke rig.md"]).toContain("```rig");
    for (const t of CALLOUT_TYPES) expect(files["00 Smoke/Callouts.md"]).toContain(`[!${t}]`);
  });
  it("uses only callout types the kit stylesheet colours", () => {
    const css = readFileSync("kits/planning/.obsidian/snippets/vault-theme.css", "utf8");
    for (const t of CALLOUT_TYPES) expect(css).toContain(`data-callout="${t}"`);
  });
});

describe("smoke helpers", () => {
  it("takes the selectors from the S2 inventory, and the must-see / prefix-only names are in it", () => {
    const inv = JSON.parse(readFileSync("scripts/obsidian-internals.json", "utf8"));
    const names = (internalClasses(inv) as { name: string }[]).map(c => c.name);
    expect(names.length).toBeGreaterThan(10);
    for (const n of [...MUST_SEE, ...PREFIX_ONLY]) expect(names).toContain(n);
  });
  it("prints one line per step and a count line", () => {
    const text = formatReport("desktop", [{ name: "a", status: "PASS", ms: 5 }, { name: "b", status: "FAIL", detail: "x" }, { name: "c", status: "NOTE" }]);
    expect(text).toContain("PASS a  (5 ms)");
    expect(text).toContain("FAIL b : x");
    expect(text).toContain("-- 1 PASS, 1 FAIL, 1 NOTE");
  });
});
