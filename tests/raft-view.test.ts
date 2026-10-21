// RAFT block as a view model and as DOM (div rows, no <table>, collapsed fold). Fixtures: tests/fixtures/raft/.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "node:module";
import { readReagent } from "../src/solution/reagent";
import { blockRange } from "../src/blocks/core";
import { buildRaftView, type MwLookup } from "../src/blocks/raft/view";
import { drawRaft } from "../src/blocks/raft/render";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const fm = (name: string): Record<string, unknown> | null => {
  let text: string;
  try { text = readFileSync(`tests/fixtures/raft/chemicals/${name}.md`, "utf8"); } catch { return null; }
  const out: Record<string, unknown> = {};
  for (const line of text.split("\n---\n")[0].replace(/^---\n/, "").split("\n")) { const m = /^([^:]+):\s*(.*)$/.exec(line); if (m) out[m[1].trim()] = /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2]; }
  return out;
};
const lookup = (name: string): MwLookup => {
  const f = fm(name);
  if (!f) return { name, mw: null, state: "no-note" };
  const r = readReagent(f);
  return { name, mw: r.reagent.mw ?? null, state: r.reagent.mw !== undefined ? "ok" : r.invalid.includes("mw") ? "bad-mw" : "no-mw" };
};
const note = (f: string): string => readFileSync(`tests/fixtures/raft/${f}`, "utf8");
const sourceOf = (f: string): string => blockRange(note(f), note(f).split("\n").findIndex(l => l.startsWith("```raft")))!.source;

function textOf(el: any): string[] {
  const out: string[] = [];
  const walk = (e: any): void => {
    if (e.classList.contains("lk-sol-row")) { out.push(e.children.map((c: any) => c.textContent).join(" | ")); return; }
    if (!e.children.length) { out.push(e.textContent); return; }
    e.children.forEach(walk);
  };
  walk(el);
  return out;
}

describe("fixture note raft-0005.md (R-C of the page)", () => {
  const view = buildRaftView(sourceOf("raft-0005.md"), lookup);
  it("has the page's numbers", () => {
    expect(view.errors).toEqual([]);
    expect(view.title).toBe("RAFT: P(DAAm), DP 105");
    expect(view.status).toBe("3 of 4 weighed");
    expect(view.summary).toBe("DAAm 2.50 g · DP 105 · PDMA 76 · CTA : initiator 20 · 20 % solids in water · Mn 19\u202f990.14 g/mol");
    expect(view.rows.map(r => [r.label, r.sub, r.target, r.actual])).toEqual([
      ["DAAm", "monomer · 14.773 mmol", "2.5000 g", "2.5012 g"],
      ["PDMA 76", "CTA · 0.1407 mmol", "0.3125 g", "0.3131 g"],
      ["Water", "solvent", "11.259 g", "11.2630 g"],
      ["VA-044", "initiator · 0.00703 mmol", "2.27 mg", ""],
    ]);
    expect(view.estimate).toEqual({ mn: "19 963 g/mol", range: "(DP 104.8 · solids 20.00 %)" });
  });
  it("the fold holds the sums of the note's # lines", () => {
    const inNote = sourceOf("raft-0005.md").split("\n").filter(l => l.startsWith("# ")).slice(3).map(l => l.slice(2));   // after the hand comment, the head and the MW line
    expect(view.worked).toEqual(inNote);
    expect(view.worked.length).toBe(5);
  });
  it("a fresh block has no estimate and is on step 1", () => {
    const v = buildRaftView(sourceOf("raft-0005-fresh.md"), lookup);
    expect(v.estimate).toBeNull();
    expect(v.status).toBe("0 of 4 weighed");
    expect(v.title).toBe("RAFT: P(DAAm), DP 105");
  });
  it("a done block says done", () => {
    const v = buildRaftView(sourceOf("raft-0005.md").replace("  VA-044:", "  VA-044: 2.31 mg"), lookup);
    expect(v.status).toBe("done");
  });
  it("a bare number takes the row's unit", () => {
    const v = buildRaftView(sourceOf("raft-0005.md").replace("  VA-044:", "  VA-044: 2.31"), lookup);
    expect(v.rows[3].actual).toBe("2.31 mg");
  });
});

describe("what is wrong is said, nothing is guessed", () => {
  const src = sourceOf("raft-0005-fresh.md");
  it("a newer format shows one line", () => {
    expect(buildRaftView(src.replace("format: 1", "format: 2"), lookup).newer).toMatch(/newer Lab Kit/);
  });
  it("no note, no MW (can be asked), a missing number", () => {
    expect(buildRaftView(src.replace("[[DAAm]]", "[[Nope]]"), lookup).errors).toEqual([{ text: 'no note called "Nope"' }]);
    expect(buildRaftView(src.replace("[[VA-044]]", "[[Blank]]"), lookup).errors).toEqual([{ text: '"Blank" has no MW: type it once, it is saved in the chemical note.', ask: "Blank" }]);
    expect(buildRaftView(src.replace("DP: 105\n", ""), lookup).errors).toEqual([{ text: "DP is missing" }]);
    expect(buildRaftView(src.replace("DP: 105", "DP: many"), lookup).errors).toEqual([{ text: "DP is missing or not a number" }]);
  });
  it("two monomers and a co-solvent get their own rows", () => {
    const v = buildRaftView(src.replace('  "[[DAAm]]": 1', '  "[[DAAm]]": 1\n  "[[PDMA 76]]": 1').replace('solvent: "[[Water]]"', 'solvent: "[[Water]]"\ncosolvent: "[[Water]]"\ncosolvent-pct: 20 %'), lookup);
    expect(v.errors).toEqual([]);
    expect(v.rows.map(r => r.label)).toEqual(["DAAm", "PDMA 76", "PDMA 76", "Water", "Water", "VA-044"]);
  });
});

describe("drawn", () => {
  const view = buildRaftView(sourceOf("raft-0005.md"), lookup);
  it("div rows with roles, no table, the fold closed", () => {
    const host = new El("div");
    drawRaft(host, view);
    const lines = textOf(host);
    expect(lines).toContain("DAAmmonomer · 14.773 mmol | 2.5000 g | 2.5012 g");
    expect(lines).toContain(" | Target | Actual");
    expect(host.querySelector?.("table") ?? null).toBeNull();
    const fold = host.querySelector(".lk-sol-fold");
    expect(fold.classList.contains("is-open")).toBe(false);
    expect(host.querySelector(".lk-sol-fold-head").textContent).toContain("How it's worked out");
  });
});
