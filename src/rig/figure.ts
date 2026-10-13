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
export interface Figure { nodes: FigNode[]; edges: FigEdge[]; width: number; height: number }

/** Lay out the parts: layers by the `Feeds` graph (longest path from the start), order inside a layer by the rows of the parts that feed it. */
export function buildFigure(parts: RigPart[], links: RigLink[]): Figure {
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

  // Order inside each layer: first layer by part order, then by the mean row of the feeding parts (ties: part order).
  const layerCount = layerOf.size ? Math.max(...layerOf.values()) + 1 : 0;
  const attachedTo = new Map<string, string[]>();
  for (const [a, h] of host) (attachedTo.get(h) ?? attachedTo.set(h, []).get(h)!).push(a);
  const slotRow = new Map<string, number>();
  const columns: string[][] = [];
  for (let c = 0; c < layerCount; c++) {
    const ids = parts.filter(p => layerOf.get(p.id) === c).map(p => p.id);
    const mean = (id: string): number => {
      const from = (into.get(id) ?? []).map(e => slotRow.get(e.from)).filter((r): r is number => r !== undefined);
      return from.length ? from.reduce((a, b) => a + b, 0) / from.length : Infinity;
    };
    if (c > 0) ids.sort((a, b) => (mean(a) - mean(b)) || (index.get(a)! - index.get(b)!) || 0);
    const slots: string[] = [];
    for (const id of ids) {
      slotRow.set(id, slots.length);
      slots.push(id);
      for (const a of attachedTo.get(id) ?? []) { slotRow.set(a, slots.length); slots.push(a); }
    }
    columns.push(slots);
  }

  const maxRows = Math.max(0, ...columns.map(c => c.length));
  const nodes: FigNode[] = [];
  columns.forEach((slots, c) => slots.forEach((id, r) => {
    const p = parts[index.get(id)!];
    const offset = (maxRows - slots.length) / 2;
    nodes.push({
      id, kind: p.kind, detail: p.detail, layer: c, row: r, host: host.get(id) ?? "",
      x: MARGIN + c * COL_W + COL_W / 2, y: MARGIN + (r + offset) * ROW_H + ROW_H / 2,
    });
  }));

  return { nodes, edges, width: 2 * MARGIN + layerCount * COL_W, height: 2 * MARGIN + maxRows * ROW_H };
}
