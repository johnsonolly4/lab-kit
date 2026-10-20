// Rig figure: the parts and links of a rig note laid out as a left-to-right flow in figure units. Pure (no Obsidian runtime).
// Plan: docs/plans/rig-figure.md, Phase 1. The SVG writer (Phase 2) and the hand layout (Phase 5) build on this.
import type { PartKind, RigLink, RigPart } from "./parts";

/** Figure units: the distance between layers (columns) and between rows, and the empty edge around the drawing. */
export const COL_W = 200;
export const ROW_H = 120;
export const MARGIN = 40;

/** One part in the figure. `kind` is "" for a part whose kind could not be worked out (drawn as a plain box). */
export interface FigNode {
  id: string; kind: PartKind | ""; detail: string;
  /** Column (0 = the start of the flow) and row inside it, counted in whole slots. */
  layer: number; row: number;
  /** Centre of the part in figure units. */
  x: number; y: number;
  /** The ID of the part this one is attached to (a heater on its reactor), or "" for a part in the flow. */
  host: string;
}
/** A connection. `attached` = not in the flow. `back` = the flow comes back to an earlier part (a cycle): it is drawn, but did not decide any layer. */
export interface FigEdge { from: string; to: string; attached: boolean; back: boolean }
/** The computer, drawn above the flow when any part has a `Control` or `Data` cell. */
export interface FigComputer { x: number; y: number; label: string }
/** A line between the computer and a part: `control` runs to the part (what the computer sets), `data` back from it. */
export interface FigControl { part: string; dir: "control" | "data"; label: string }
export interface Figure { nodes: FigNode[]; edges: FigEdge[]; width: number; height: number; computer: FigComputer | null; controls: FigControl[] }
export interface FigureOptions { /** The computer's label (the rig note's `Control:` property). */ computer?: string }

/** Room above the flow for the computer (its height, a gap) and one lane per direction: the control lines share one run, the data lines another. */
export const COMPUTER_BAND = 110;
export const LANE = 14;

/** Lay out the parts: layers by the `Feeds` graph (longest path from the start), order inside a layer by the rows of the parts that feed it. */
export function buildFigure(parts: RigPart[], links: RigLink[], opts: FigureOptions = {}): Figure {
  const index = new Map(parts.map((p, i) => [p.id, i]));
  const known = links.filter(l => index.has(l.from) && index.has(l.to));

  // Attached parts (a heater on its reactor) sit beside their host and take no part in the layering.
  const host = new Map<string, string>();
  for (const l of known) if (l.attached && l.from !== l.to && !host.has(l.from)) host.set(l.from, l.to);
  // A part that feeds a part which is itself attached has no usable host: it stays in the flow.
  for (const [a, h] of [...host]) if (host.has(h)) host.delete(a);

  const seen = new Set<string>();
  const edges: FigEdge[] = [];
  for (const l of known) {
    const key = `${l.from}\u0000${l.to}\u0000${l.attached}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: l.from, to: l.to, attached: l.attached, back: false });
  }

  // Flow edges between parts in the flow; a depth-first walk in part order marks the edges that close a cycle.
  const flow = edges.filter(e => !host.has(e.from) && !host.has(e.to));
  const out = new Map<string, FigEdge[]>();
  for (const e of flow) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e);
  const state = new Map<string, 1 | 2>();   // 1 = on the walk, 2 = finished
  const visit = (id: string): void => {
    state.set(id, 1);
    for (const e of out.get(id) ?? []) {
      const s = state.get(e.to);
      if (s === 1) e.back = true;
      else if (!s) visit(e.to);
    }
    state.set(id, 2);
  };
  for (const p of parts) if (!host.has(p.id) && !state.has(p.id)) visit(p.id);

  const into = new Map<string, FigEdge[]>();
  for (const e of flow) if (!e.back) (into.get(e.to) ?? into.set(e.to, []).get(e.to)!).push(e);
  const layerOf = new Map<string, number>();
  const layer = (id: string): number => {
    const done = layerOf.get(id);
    if (done !== undefined) return done;
    const n = Math.max(-1, ...(into.get(id) ?? []).map(e => layer(e.from))) + 1;
    layerOf.set(id, n);
    return n;
  };
  for (const p of parts) if (!host.has(p.id)) layer(p.id);

  // Order inside each layer: first layer by part order, then by the mean position of the feeding parts (ties: part order).
  // Positions are in row units and may be fractions: a part sits level with the parts that feed it, so a straight chain stays straight.
  const layerCount = layerOf.size ? Math.max(...layerOf.values()) + 1 : 0;
  const attachedTo = new Map<string, string[]>();
  for (const [a, h] of host) (attachedTo.get(h) ?? attachedTo.set(h, []).get(h)!).push(a);
  const pos = new Map<string, number>();
  const columns: string[][] = [];
  for (let c = 0; c < layerCount; c++) {
    const desired = (id: string): number | undefined => {
      const from = (into.get(id) ?? []).map(e => pos.get(e.from)).filter((r): r is number => r !== undefined);
      return from.length ? from.reduce((a, b) => a + b, 0) / from.length : undefined;
    };
    const ids = parts.filter(p => layerOf.get(p.id) === c).map(p => p.id);
    if (c > 0) ids.sort((a, b) => ((desired(a) ?? Infinity) - (desired(b) ?? Infinity)) || (index.get(a)! - index.get(b)!) || 0);
    // Place each part (with the parts attached under it) at its wanted position or just below the one before, then shift the column to sit as close as it can to what was wanted.
    let next = 0;
    const placed: [string, number][] = [];
    for (const id of ids) {
      const want = desired(id);
      const at = want === undefined ? next : Math.max(want, next);
      placed.push([id, at]);
      next = at + 1 + (attachedTo.get(id)?.length ?? 0);
    }
    const gaps = ids.map((id, i) => [desired(id), placed[i][1]] as const).filter((g): g is readonly [number, number] => g[0] !== undefined).map(([w, at]) => w - at);
    const shift = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const slots: string[] = [];
    for (const [id, at] of placed) {
      pos.set(id, at + shift);
      slots.push(id);
      (attachedTo.get(id) ?? []).forEach((a, k) => { pos.set(a, at + shift + 1 + k); slots.push(a); });
    }
    columns.push(slots);
  }

  const top = Math.min(0, ...pos.values());
  const bottom = Math.max(0, ...[...pos.values()].map(v => v + 1));
  const nodes: FigNode[] = [];
  columns.forEach((slots, c) => slots.forEach((id, r) => {
    const p = parts[index.get(id)!];
    nodes.push({
      id, kind: p.kind, detail: p.detail, layer: c, row: r, host: host.get(id) ?? "",
      x: MARGIN + c * COL_W + COL_W / 2, y: MARGIN + (pos.get(id)! - top) * ROW_H + ROW_H / 2,
    });
  }));

  const width = 2 * MARGIN + layerCount * COL_W;
  let height = 2 * MARGIN + (nodes.length ? bottom - top : 0) * ROW_H;

  // Control and data lines: the computer sits above the flow, which moves down to make room for the lines' lanes.
  const controls: FigControl[] = [];
  for (const n of nodes) {
    const p = parts[index.get(n.id)!];
    if (p.control) controls.push({ part: n.id, dir: "control", label: p.control });
    if (p.data) controls.push({ part: n.id, dir: "data", label: p.data });
  }
  let computer: FigComputer | null = null;
  if (controls.length) {
    const band = COMPUTER_BAND + new Set(controls.map(c => c.dir)).size * LANE;
    for (const n of nodes) n.y += band;
    height += band;
    computer = { x: width / 2, y: MARGIN + 35, label: opts.computer ?? "Control" };
  }
  return { nodes, edges, width, height, computer, controls };
}
