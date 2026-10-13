// Rig figure Phase 1: layers, order and positions from the parts and links (src/rig/figure.ts). Fictional rigs only.
import { describe, it, expect } from "vitest";
import { readRig } from "../src/rig/parts";
import { buildFigure, COL_W, MARGIN, ROW_H } from "../src/rig/figure";

const header = "| ID | Part | Type | Feeds |";
const rig = (...rows: string[]) => readRig([header, "|---|---|---|---|", ...rows.map(r => `| ${r} |`)].join("\n"));
const figure = (...rows: string[]) => { const r = rig(...rows); return buildFigure(r.parts, r.links); };
const layers = (f: ReturnType<typeof figure>) => Object.fromEntries(f.nodes.map(n => [n.id, n.layer]));
const node = (f: ReturnType<typeof figure>, id: string) => f.nodes.find(n => n.id === id)!;

const twoPumpTee = [
  "PA | Pump | syringe | T1", "PB | Pump | syringe | T1", "T1 | Mixer | tee | C1", "C1 | Reactor | coil | A1",
  "A1 | Analysis | inline probe | COL", "COL | Outlet | vial |",
];

describe("layers", () => {
  it("a two-pump tee into a coil into analysis into a collector runs left to right", () => {
    const f = figure(...twoPumpTee);
    expect(layers(f)).toEqual({ PA: 0, PB: 0, T1: 1, C1: 2, A1: 3, COL: 4 });
    expect(f.width).toBe(2 * MARGIN + 5 * COL_W);
    expect(f.height).toBe(2 * MARGIN + 2 * ROW_H);
  });
  it("a merge (tee): the two pumps sit above and below the line of the tee", () => {
    const f = figure(...twoPumpTee);
    expect(node(f, "PA").y).toBeLessThan(node(f, "PB").y);
    expect(node(f, "T1").y).toBe((node(f, "PA").y + node(f, "PB").y) / 2);
    expect(node(f, "T1").x).toBe(MARGIN + COL_W + COL_W / 2);
  });
  it("a branch with a bypass: the long path decides the layer of the merge, the bypass skips a layer", () => {
    const f = figure("P1 | Pump | | V1", "V1 | Valve | | R1, BP", "R1 | Reactor | | A1", "BP | Tubing | bypass | M1", "A1 | Analysis | | M1", "M1 | Mixer | tee | OUT", "OUT | Outlet | |");
    expect(layers(f)).toEqual({ P1: 0, V1: 1, R1: 2, BP: 2, A1: 3, M1: 4, OUT: 5 });
    expect(node(f, "R1").y).not.toBe(node(f, "BP").y);
    expect(f.edges.filter(e => e.to === "M1").map(e => e.from).sort()).toEqual(["A1", "BP"]);
  });
  it("a long edge may skip layers without moving the part it ends on", () => {
    const f = figure("P1 | Pump | | R1, OUT", "R1 | Reactor | | A1", "A1 | Analysis | | OUT", "OUT | Outlet | |");
    expect(layers(f)).toEqual({ P1: 0, R1: 1, A1: 2, OUT: 3 });
  });
});

describe("odd input", () => {
  it("a cycle does not hang: the edge that closes it is marked back and decides no layer", () => {
    const f = figure("P1 | Pump | | R1", "R1 | Reactor | | L1", "L1 | Valve | | R1, OUT", "OUT | Outlet | |");
    expect(layers(f)).toEqual({ P1: 0, R1: 1, L1: 2, OUT: 3 });
    expect(f.edges.filter(e => e.back).map(e => `${e.from}>${e.to}`)).toEqual(["L1>R1"]);
  });
  it("a part that feeds itself, and a loop of two with no start, still get a place", () => {
    const f = figure("A | Pump | | A", "B | Valve | | C", "C | Valve | | B");
    expect(f.nodes).toHaveLength(3);
    expect(f.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(f.edges.filter(e => e.back)).toHaveLength(2);
  });
  it("an unknown part kind is kept with an empty kind (drawn as a box later)", () => {
    const f = figure("P1 | Pump | | X1", "X1 | Gizmo | | OUT", "OUT | Outlet | |");
    expect(node(f, "X1").kind).toBe("");
    expect(layers(f).X1).toBe(1);
  });
  it("a feed to an ID that is not a part draws no edge; an empty table gives an empty figure", () => {
    const f = figure("P1 | Pump | | NOPE");
    expect(f.edges).toEqual([]);
    expect(f.nodes).toHaveLength(1);
    const e = buildFigure([], []);
    expect(e).toEqual({ nodes: [], edges: [], width: 2 * MARGIN, height: 2 * MARGIN });
  });
  it("a part with no links is placed in the first layer", () => {
    const f = figure("P1 | Pump | | R1", "R1 | Reactor | |", "LONE | Valve | |");
    expect(layers(f).LONE).toBe(0);
  });
});

describe("attached parts and repeatability", () => {
  it("a heater and a stirrer sit in their reactor's layer, one row under it, on dashed edges", () => {
    const f = figure("P1 | Pump | | R1", "R1 | Reactor | | OUT", "H1 | Heater | | R1", "S1 | Stirrer | | R1", "OUT | Outlet | |");
    expect(layers(f)).toEqual({ P1: 0, R1: 1, H1: 1, S1: 1, OUT: 2 });
    expect(node(f, "H1").host).toBe("R1");
    expect(node(f, "H1").y - node(f, "R1").y).toBe(ROW_H);
    expect(node(f, "S1").y - node(f, "H1").y).toBe(ROW_H);
    expect(f.edges.filter(e => e.attached).map(e => e.from).sort()).toEqual(["H1", "S1"]);
    const slots = f.nodes.map(n => `${n.layer}:${n.y}`);
    expect(new Set(slots).size).toBe(slots.length);
  });
  it("is deterministic: the same rig gives the same figure", () => {
    expect(figure(...twoPumpTee)).toEqual(figure(...twoPumpTee));
  });
  it("rows do not depend on the order the rows are written once the feeds fix them", () => {
    const f = figure("T1 | Mixer | | OUT", "PB | Pump | | T1", "PA | Pump | | T1", "OUT | Outlet | |");
    expect(node(f, "PB").y).toBeLessThan(node(f, "PA").y);   // part order is the tie-break in the first layer
  });
});
