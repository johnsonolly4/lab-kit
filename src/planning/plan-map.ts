// The card map of one project's plan (planning kit): which step and place each to-do has, the arrows, and the to-dos with no links.
// Pure (no DOM, no Obsidian runtime): steps and places are numbers; the drawing turns them into pixels.
import type { Plan, PlanRow } from "./plan";

export interface MapCard { path: string; row: PlanRow; step: number; place: number }
export interface MapArrow {
  from: string; to: string;
  /** Set when `to` really comes after this subtask of `from`: the arrow is drawn to the parent card instead, dashed, and is not a link to remove. */
  via?: string;
}
export interface PlanMap {
  /** Linked to-dos (a parent or a child), by step then place. */
  cards: MapCard[];
  arrows: MapArrow[];
  /** To-dos with no links, in plan order; not on the map. */
  unlinked: PlanRow[];
  /** The step to scroll to: the first ready open to-do's, else the last step; 0 when there is no map. */
  startStep: number;
  /** Paths of the to-dos waiting on each other in a circle. */
  cyclic: Set<string>;
}

/** The subtasks of a to-do that are not done yet. */
export const openSubs = (row: { subs: { path: string; name: string; done: boolean }[] }): { path: string; name: string }[] => row.subs.filter(s => !s.done).map(s => ({ path: s.path, name: s.name }));

/** The subtask count of a to-do: "2/3", and whether all are done (no subtasks: empty and false). */
export function subsLabel(row: { subs: { done: boolean }[] }): { text: string; allDone: boolean } {
  const n = row.subs.length, done = row.subs.filter(s => s.done).length;
  return { text: n ? `${done}/${n}` : "", allDone: n > 0 && done === n };
}

/** Where the cards were the last time the map was drawn (step and place), kept by the block while the note is open. */
export type PlaceMemory = Map<string, { step: number; place: number }>;

/** Steps left to right (0 = no parents, else 1 + the largest parent step); inside a step, near the parents, then plan order.
 *  `memory`: a card that was already in this step keeps its order in it, and a new card goes next to its parent (or at the bottom), so adding or linking a to-do does not shuffle the others. */
export function layoutPlan(plan: Plan, memory?: PlaceMemory): PlanMap {
  const onMap = new Set(plan.rows.filter(r => !r.parent).map(r => r.path));
  // A subtask lives inside its parent's card, not on the map: a to-do that comes after a subtask comes after that card (drawn dashed, `via`), so a chain does not break when a card is nested. Never to itself.
  const parentOf = new Map(plan.rows.filter(r => r.parent).map(r => [r.path, r.parent!]));
  const via = new Map<string, string>();   // `from→to` -> the subtask, only when no direct link says the same
  const top = plan.rows.filter(r => !r.parent).map(r => {
    const afterPaths: string[] = [];
    for (const p of r.afterPaths) {
      const from = parentOf.get(p) ?? p;
      if (from === r.path || !onMap.has(from)) continue;
      if (from !== p) { if (!afterPaths.includes(from) && !r.afterPaths.includes(from)) via.set(`${from}\u2192${r.path}`, p); } else via.delete(`${from}\u2192${r.path}`);
      if (!afterPaths.includes(from)) afterPaths.push(from);
    }
    return { ...r, afterPaths };
  });
  const hasChild = new Set(top.flatMap(r => r.afterPaths));
  const linked = top.filter(r => r.afterPaths.length > 0 || hasChild.has(r.path));
  const unlinked = top.filter(r => !linked.includes(r));
  const arrows = linked.flatMap(r => r.afterPaths.map((from): MapArrow => { const v = via.get(`${from}\u2192${r.path}`); return v ? { from, to: r.path, via: v } : { from, to: r.path }; }));

  // Rows are in plan order: parents first, except inside a cycle (a parent not yet placed).
  const step = new Map<string, number>();
  const cyclic = new Set<string>();
  for (const r of linked) {
    const known = r.afterPaths.filter(p => step.has(p));
    for (const p of r.afterPaths) if (!step.has(p)) { cyclic.add(r.path); cyclic.add(p); }
    step.set(r.path, known.length ? 1 + Math.max(...known.map(p => step.get(p)!)) : 0);
  }

  // A card with nothing before it sits just before its earliest child, so its arrow stays short (not all the way back at step 0).
  const childStep = new Map<string, number>();
  for (const r of linked) for (const p of r.afterPaths) childStep.set(p, Math.min(childStep.get(p) ?? Infinity, step.get(r.path)!));
  for (const r of linked) if (r.afterPaths.length === 0 && childStep.has(r.path)) step.set(r.path, Math.max(0, childStep.get(r.path)! - 1));

  const place = new Map<string, number>();
  const last = linked.length ? Math.max(...step.values()) : 0;
  for (let s = 0; s <= last; s++) {
    const inStep = linked.filter(r => step.get(r.path) === s);
    // Stable sort keeps plan order for ties; rows without a placed parent go after those with one.
    const key = (r: PlanRow): number => {
      const ps = r.afterPaths.filter(p => place.has(p));
      return ps.length ? ps.reduce((a, p) => a + place.get(p)!, 0) / ps.length : Infinity;
    };
    const oldPlace = (r: PlanRow): number => memory?.get(r.path)?.place ?? Infinity;
    const order = inStep.filter(r => memory?.get(r.path)?.step === s).sort((a, b) => oldPlace(a) - oldPlace(b) || a.path.localeCompare(b.path));   // the ones that were here keep their order
    const fresh = inStep.filter(r => !order.includes(r)).sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1));
    const kept = [...order];
    for (const r of fresh) {   // a new one goes before the first kept card that was lower than its parents, else at the bottom
      const k = key(r), at = k === Infinity ? -1 : kept.findIndex(c => oldPlace(c) > k);
      order.splice(at < 0 ? order.length : order.indexOf(kept[at]), 0, r);
    }
    let prev = -1;   // each card sits level with the average row of its parents when that row is free, else just below the card above: a short arrow matters more than fewer rows
    for (const r of order) {
      const k = key(r), want = k === Infinity ? prev + 1 : Math.floor(k);   // half a row off both parents: the upper row, as before
      prev = Math.max(prev + 1, want);
      place.set(r.path, prev);
    }
  }

  const cards = linked.map(r => ({ path: r.path, row: r, step: step.get(r.path)!, place: place.get(r.path)! }))
    .sort((a, b) => a.step - b.step || a.place - b.place);
  const firstReady = cards.find(c => !c.row.done && !c.row.blocked);
  return { cards, arrows, unlinked, startStep: cards.length ? (firstReady ? firstReady.step : last) : 0, cyclic };
}

/** Every to-do before and after `path`, through any number of links; the to-do itself only when it is in a circle. */
export function chainOf(plan: Plan, path: string): Set<string> {
  const up = new Map<string, string[]>(), down = new Map<string, string[]>();
  for (const r of plan.rows) for (const p of r.afterPaths) {
    up.set(r.path, [...(up.get(r.path) ?? []), p]);
    down.set(p, [...(down.get(p) ?? []), r.path]);
  }
  const walk = (edges: Map<string, string[]>, seen: Set<string>): void => {
    const todo = [...(edges.get(path) ?? [])];
    while (todo.length) {
      const p = todo.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      todo.push(...(edges.get(p) ?? []));
    }
  };
  const out = new Set<string>();
  walk(up, out); walk(down, out);
  return out;
}

export const CARD_W = 190, CARD_H = 108, GAP_X = 56, GAP_Y = 14, PAD = 12;

/** `across`: steps run left to right; `down`: steps run top to bottom. */
/** The zoom limits and step of the zoom buttons (1 = the size the map has always had). */
export const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6, ZOOM_STEP = 0.1;
/** `z` kept inside the limits and rounded to a tenth, so repeated steps do not drift (0.7000000000000001). */
export const clampZoom = (z: number): number => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1)) * 100) / 100;
/** The zoom that makes a map `mapWidth` wide fit in `available` pixels: never larger than 1, never under the minimum. */
export const fitZoom = (available: number, mapWidth: number): number => mapWidth > 0 && available > 0 ? clampZoom(Math.min(1, available / mapWidth)) : 1;

export type Direction = "across" | "down";
export interface Pt { x: number; y: number }
export interface MapCurve {
  from: string; to: string;
  /** The subtask a dashed arrow stands for (see `MapArrow`). */
  via?: string;
  /** The SVG path: from the first card's outgoing edge to the second's incoming edge. */
  d: string;
  /** True when the arrow skips steps and was sent through a lane between cards instead of straight across them. */
  routed: boolean;
  /** Points along the path (for tests and the check that no card is crossed). */
  samples: Pt[];
}

export interface MapGeometry {
  width: number; height: number;
  /** Top-left corner of each card, by path. */
  pos: Map<string, Pt>;
  curves: MapCurve[];
  /** Scroll position that puts the start step at the left edge (`across`; 0 in `down`). */
  scrollLeft: number;
  /** Scroll position that puts the start step at the top (`down`; 0 in `across`). */
  scrollTop: number;
}

const cubic = (p: Pt, q: Pt, r: Pt, s: Pt, t: number): Pt => {
  const u = 1 - t;
  return { x: u * u * u * p.x + 3 * u * u * t * q.x + 3 * u * t * t * r.x + t * t * t * s.x, y: u * u * u * p.y + 3 * u * u * t * q.y + 3 * u * t * t * r.y + t * t * t * s.y };
};
const line = (p: Pt, q: Pt, n: number): Pt[] => Array.from({ length: n + 1 }, (_, i) => ({ x: p.x + (q.x - p.x) * i / n, y: p.y + (q.y - p.y) * i / n }));

/** Pixels for a layout. `across`: steps left to right, places top to bottom. `down`: steps top to bottom, places left to right.
 *  An arrow that skips steps and would run behind a card in between is sent through a lane between rows (columns in `down`). `extraHeight`: room under the lowest card.
 *  `room`: pixels an open subtask list needs under a card; the rows below move down by the most any card of the row above needs (rows run top to bottom in `across`, steps in `down`). */
export function mapGeometry(map: PlanMap, extraHeight = 0, direction: Direction = "across", room?: ReadonlyMap<string, number>): MapGeometry {
  const across = direction === "across";
  const rows = map.cards.length ? Math.max(...map.cards.map(c => (across ? c.place : c.step))) + 1 : 0;
  const rowRoom = Array.from({ length: rows + 1 }, () => 0);
  for (const c of map.cards) { const r = across ? c.place : c.step; rowRoom[r] = Math.max(rowRoom[r], room?.get(c.path) ?? 0); }
  const off = [0];   // off[k]: room taken by the rows above row k
  for (let k = 0; k < rows; k++) off.push(off[k] + rowRoom[k]);
  const pos = new Map<string, Pt>();
  for (const c of map.cards) {
    pos.set(c.path, across ? { x: PAD + c.step * (CARD_W + GAP_X), y: PAD + c.place * (CARD_H + GAP_Y) + off[c.place] } : { x: PAD + c.place * (CARD_W + GAP_Y), y: PAD + c.step * (CARD_H + GAP_X) + off[c.step] });
  }
  const steps = map.cards.length ? Math.max(...map.cards.map(c => c.step)) + 1 : 0;
  const places = map.cards.length ? Math.max(...map.cards.map(c => c.place)) + 1 : 0;
  const stepOf = new Map(map.cards.map(c => [c.path, c.step]));
  const alongOf = (p: Pt): number => (across ? p.x : p.y);   // position along the step axis
  const crossOf = (p: Pt): number => (across ? p.y : p.x);
  const at = (a: number, c: number): Pt => (across ? { x: a, y: c } : { x: c, y: a });
  const crossSize = across ? CARD_H : CARD_W;
  const lane = (k: number): number => PAD + k * (crossSize + GAP_Y) - GAP_Y / 2 + (across ? off[k] : 0);   // between rows (columns); k = 0 above the first, `places` below the last

  const hitsCard = (pts: Pt[], f: string, t: string): boolean => {
    const lo = Math.min(stepOf.get(f)!, stepOf.get(t)!), hi = Math.max(stepOf.get(f)!, stepOf.get(t)!);
    return map.cards.some(c => {
      const st = stepOf.get(c.path)!;
      if (c.path === f || c.path === t || st <= lo || st >= hi) return false;
      const p = pos.get(c.path)!;
      return pts.some(q => q.x > p.x - 4 && q.x < p.x + CARD_W + 4 && q.y > p.y - 4 && q.y < p.y + CARD_H + 4);
    });
  };

  const inLane = new Map<number, number>();   // routed arrows so far per lane: each gets its own line, so two do not merge into one
  const curves = map.arrows.flatMap((a): MapCurve[] => {
    const f = pos.get(a.from), t = pos.get(a.to);
    if (!f || !t) return [];
    const o = across ? { x: f.x + CARD_W, y: f.y + CARD_H / 2 } : { x: f.x + CARD_W / 2, y: f.y + CARD_H };
    const i = across ? { x: t.x, y: t.y + CARD_H / 2 } : { x: t.x + CARD_W / 2, y: t.y };
    const k = Math.max(GAP_X / 2, Math.abs(alongOf(i) - alongOf(o)) / 2);
    const c1 = at(alongOf(o) + k, crossOf(o)), c2 = at(alongOf(i) - k, crossOf(i));
    const straight = Array.from({ length: 25 }, (_, n) => cubic(o, c1, c2, i, n / 24));
    const skips = stepOf.get(a.to)! - stepOf.get(a.from)! >= 2;
    if (!skips || !hitsCard(straight, a.from, a.to)) return [{ from: a.from, to: a.to, d: `M${o.x} ${o.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${i.x} ${i.y}`, routed: false, samples: straight, via: a.via }];
    // Out into the gap after the first card, along the nearest lane between rows, in through the gap before the last card.
    const mid = (crossOf(o) + crossOf(i)) / 2;
    let best = 0;
    for (let n = 1; n <= places; n++) if (Math.abs(lane(n) - mid) < Math.abs(lane(best) - mid)) best = n;
    const seen = inLane.get(best) ?? 0;
    inLane.set(best, seen + 1);
    const cor = lane(best) + [0, 3, -3][seen % 3], a0 = alongOf(o), a1 = alongOf(i), g = GAP_X * 0.35, q = g / 2;   // out and in at different places of a shared gap, else an arrow leaving and one arriving there look like one bump
    const p1 = at(a0 + g, cor), p2 = at(a1 - g, cor);
    const out1 = at(a0 + q, crossOf(o)), out2 = at(a0 + q, cor), in1 = at(a1 - q, cor), in2 = at(a1 - q, crossOf(i));
    const d = `M${o.x} ${o.y} C${out1.x} ${out1.y} ${out2.x} ${out2.y} ${p1.x} ${p1.y} L${p2.x} ${p2.y} C${in1.x} ${in1.y} ${in2.x} ${in2.y} ${i.x} ${i.y}`;
    const samples = [...Array.from({ length: 13 }, (_, n) => cubic(o, out1, out2, p1, n / 12)), ...line(p1, p2, 12), ...Array.from({ length: 13 }, (_, n) => cubic(p2, in1, in2, i, n / 12))];
    return [{ from: a.from, to: a.to, d, routed: true, samples, via: a.via }];
  });
  return {
    width: steps ? (across ? 2 * PAD + steps * CARD_W + (steps - 1) * GAP_X : 2 * PAD + places * CARD_W + (places - 1) * GAP_Y) : 0,
    height: steps ? (across ? 2 * PAD + places * CARD_H + (places - 1) * GAP_Y : 2 * PAD + steps * CARD_H + (steps - 1) * GAP_X) + off[rows] + extraHeight : 0,
    pos, curves,
    scrollLeft: across ? Math.max(0, map.startStep * (CARD_W + GAP_X)) : 0,
    scrollTop: across ? 0 : Math.max(0, map.startStep * (CARD_H + GAP_X)),
  };
}

/** Ticks or unticks a to-do's properties. A to-do on the Done column goes back to Backlog when unticked (else the roll-over would tick it again); the to-do engine stamps or clears `done_on`. */
export function setDone(fm: Record<string, unknown>, done: boolean): void {
  fm.done = done;
  if (!done && fm.day === "Done") fm.day = "Backlog";
}
