// The ```rig-layout block (hand layout, rig plan Phase 6): read, write, merge with the automatic layout, and the figure drawn from it.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 6.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { COL_W, MARGIN, ROW_H, buildFigure } from "../src/rig/figure";
import { makeFigure } from "../src/rig/figure-make";
import { GRID, LAYOUT_FORMAT, findLayout, readLayout, setLayoutInNote, snap, writeLayout } from "../src/rig/layout";
import { readRig } from "../src/rig/parts";
import { readSnapshotMeta, rigRecord, snapshotSvg } from "../src/rig/snapshot";

const DIR = "tests/fixtures/rigs/";
const FIXTURE = readFileSync(DIR + "two-pumps-mixer.md", "utf8");
const SAVED = readFileSync(DIR + "saved/layout-v1.md", "utf8");
const IDS = ["P1", "P2", "M1", "R1", "OUT"];
const pos = (o: Record<string, [number, number]>): Map<string, { x: number; y: number }> => new Map(Object.entries(o).map(([k, [x, y]]) => [k, { x, y }]));

describe("the block text", () => {
  it("is format 1 on a 20-unit grid (owner, 1a)", () => {
    expect(LAYOUT_FORMAT).toBe(1);
    expect(GRID).toBe(20);
    expect(snap(129)).toBe(120);
    expect(snap(131)).toBe(140);
  });

  it("finds the block in a note and reads `ID: x, y` lines", () => {
    const text = FIXTURE + "\n```rig-layout\nformat: 1\nP1: 120, 40\nM1: 200, -20\n```\n";
    const b = findLayout(text)!;
    expect(b.body).toBe("format: 1\nP1: 120, 40\nM1: 200, -20");
    const l = readLayout(b.body, IDS);
    expect(l.status).toBe("ok");
    expect([...l.fixed]).toEqual([["P1", { x: 120, y: 40 }], ["M1", { x: 200, y: -20 }]]);
    expect(l.problems).toEqual([]);
    expect(findLayout(FIXTURE)).toBeNull();
  });

  it("round trip: writing the places it read gives the same bytes, in the block and in the note", () => {
    for (const body of ["format: 1\nP1: 140, 100\nP2: 240, 280", "format: 1\r\nP1: 140, 100\r\nP2 :  240,280\r", SAVED.slice(SAVED.indexOf("format: 1"), SAVED.indexOf("\n```", SAVED.indexOf("format: 1")))]) {
      const l = readLayout(body, IDS);
      expect(writeLayout(body, l.fixed, IDS)).toBe(body);
    }
    const b = findLayout(SAVED)!;
    expect(setLayoutInNote(SAVED, b.body)).toBe(SAVED);
    const crlf = SAVED.replace(/\n/g, "\r\n");
    expect(setLayoutInNote(crlf, findLayout(crlf)!.body)).toBe(crlf);
  });

  it("a hand-typed line (odd spaces, a note line) is read and kept byte-equal when its place does not change", () => {
    const b = findLayout(SAVED)!;
    const l = readLayout(b.body, IDS);
    expect(l.fixed.get("P2")).toEqual({ x: 240, y: 280 });
    const moved = new Map(l.fixed); moved.set("R1", { x: 560, y: 160 });
    const out = writeLayout(b.body, moved, IDS)!;
    expect(out).toContain("P2 :  240,280\n% moved P2 below the mixer by hand\n");
    expect(out).toContain("\nR1: 560, 160\n");
    expect(out.split("\n").length).toBe(b.body.split("\n").length);
  });

  it("a line naming a part that is gone is kept as text and listed as a problem, never dropped", () => {
    const b = findLayout(SAVED)!;
    const l = readLayout(b.body, IDS);
    expect(l.fixed.has("R9")).toBe(false);
    expect(l.problems).toEqual(['The layout names "R9", which is not in the parts tables (its line is kept).']);
    expect(writeLayout(b.body, pos({ P1: [140, 100] }), IDS)).toContain("\nR9: 900, 100");
  });

  it("a part added to the tables gets a line at the end; Reset to automatic drops the lines of the parts it manages", () => {
    const body = "format: 1\nP1: 140, 100\nR9: 1, 2";
    expect(writeLayout(body, pos({ P1: [140, 100], P2: [140, 220] }), IDS)).toBe("format: 1\nP1: 140, 100\nR9: 1, 2\nP2: 140, 220");
    expect(writeLayout(body, new Map(), IDS)).toBe("format: 1\nR9: 1, 2");
    expect(writeLayout(null, pos({ P1: [140.4, 99.6] }), IDS)).toBe("format: 1\nP1: 140, 100");
  });

  it("a line it cannot read is kept and listed; note lines (% or #) and blank lines are kept without a problem", () => {
    const l = readLayout("format: 1\n\n% note\n# note\nP1 at 3, 4", IDS);
    expect(l.problems).toEqual(['Layout line not read: "P1 at 3, 4".']);
    expect(writeLayout("format: 1\n\n% note\nP1 at 3, 4", pos({ P1: [0, 0] }), IDS)).toBe("format: 1\n\n% note\nP1 at 3, 4\nP1: 0, 0");
  });

  it("a newer format is shown, not edited: no places used, nothing written", () => {
    const l = readLayout("format: 2\nP1: 140, 100", IDS);
    expect(l.status).toBe("newer");
    expect(l.fixed.size).toBe(0);
    expect(l.problems[0]).toMatch(/newer Lab Kit/);
    expect(writeLayout("format: 2\nP1: 140, 100", pos({ P1: [0, 0] }), IDS)).toBeNull();
  });

  it("a block without a format line is read as format 1; writing adds the line", () => {
    expect(readLayout("P1: 1, 2", IDS).status).toBe("ok");
    expect(writeLayout("P1: 1, 2", pos({ P1: [3, 4] }), IDS)).toBe("format: 1\nP1: 3, 4");
  });

  it("a new block goes directly under the ```rig block (owner, 5a), or at the end of a note without one", () => {
    const note = "Intro\n\n```rig\n```\n\n## Pumps\n";
    expect(setLayoutInNote(note, "format: 1\nP1: 1, 2")).toBe("Intro\n\n```rig\n```\n\n```rig-layout\nformat: 1\nP1: 1, 2\n```\n\n## Pumps\n");
    expect(setLayoutInNote("Intro", "format: 1")).toBe("Intro\n\n```rig-layout\nformat: 1\n```\n");
    const old = "a\n```rig-layout\nformat: 1\nP1: 1, 2\n```\nb";
    expect(setLayoutInNote(old, "format: 1\nP1: 5, 6")).toBe("a\n```rig-layout\nformat: 1\nP1: 5, 6\n```\nb");
  });
});

describe("the figure with fixed places", () => {
  const rig = readRig(FIXTURE);
  const auto = buildFigure(rig.parts, rig.links);
  const at = (f: typeof auto, id: string) => { const n = f.nodes.find(m => m.id === id)!; return { x: n.x, y: n.y }; };

  it("no places = the automatic figure, unchanged", () => {
    expect(buildFigure(rig.parts, rig.links, { fixed: new Map() })).toEqual(auto);
  });

  it("listed parts sit at their place, the others where the automatic layout puts them; the frame fits the parts", () => {
    const f = buildFigure(rig.parts, rig.links, { fixed: pos({ P2: [240, 280] }) });
    expect(at(f, "P2")).toEqual({ x: 240, y: 280 });
    for (const id of ["P1", "M1", "R1", "OUT"]) expect(at(f, id)).toEqual(at(auto, id));
    expect(f.height).toBe(280 + ROW_H / 2 + MARGIN);
    expect(f.width).toBe(auto.width);
    const far = buildFigure(rig.parts, rig.links, { fixed: pos({ OUT: [1000, 160] }) });
    expect(far.width).toBe(1000 + COL_W / 2 + MARGIN);
  });

  it("a part added later is placed automatically in free room; the listed parts do not move", () => {
    const every = pos({ P1: [140, 100], P2: [140, 220], M1: [340, 160], R1: [540, 160], OUT: [740, 160] });
    const more = FIXTURE.replace("| P2 | syringe pump | initiator | | | | M1 |", "| P2 | syringe pump | initiator | | | | M1 |\n| P3 | syringe pump | quench | | | | M1 |");
    const r = readRig(more);
    const f = buildFigure(r.parts, r.links, { fixed: every });
    for (const [id, p] of every) expect(at(f, id)).toEqual(p);
    const p3 = at(f, "P3");
    for (const [, p] of every) expect(Math.abs(p.x - p3.x) < COL_W / 2 && Math.abs(p.y - p3.y) < ROW_H / 2).toBe(false);
  });

  it("an attached part moves with its host", () => {
    const text = readFileSync(DIR + "single-tubular.md", "utf8");
    const r = readRig(text);
    const a = buildFigure(r.parts, r.links);
    const f = buildFigure(r.parts, r.links, { fixed: pos({ R1: [360, 160] }) });
    const h = (g: typeof a) => g.nodes.find(n => n.host === "R1")!;
    expect(h(f).x - h(a).x).toBe(20);
    expect(h(f).y - h(a).y).toBe(60);
  });

  it("makeFigure reads the note's block; its problems come with the figure", () => {
    const m = makeFigure(SAVED)!;
    expect(m.problems).toEqual(['The layout names "R9", which is not in the parts tables (its line is kept).']);
    expect(m.places.get("P2")).toEqual({ x: 240, y: 280 });
    expect(m.svg).toContain('data-part="P2" transform="translate(240 280)"');
    // the window passes its own places, which win over the block; an empty map is the automatic figure
    expect(makeFigure(SAVED, new Map())!.svg).toBe(makeFigure(FIXTURE)!.svg);
  });

  it("the snapshot <metadata> carries the layout block text", () => {
    const rec = rigRecord(SAVED);
    expect(rec.layout).toBe(findLayout(SAVED)!.body.split("\n").map(l => l.trim()).join("\n"));
    const read = readSnapshotMeta(snapshotSvg(makeFigure(SAVED)!.svg, { rig: "Saved", date: "2026-10-21", version: "x", record: rec }));
    expect(read.status === "ok" && read.meta.record.layout).toContain("P2 :  240,280");
  });
});
