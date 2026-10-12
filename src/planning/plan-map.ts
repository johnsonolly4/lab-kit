// The card map of one project's plan (planning kit): which step and place each to-do has, the arrows, and the to-dos with no links.
// Pure (no DOM, no Obsidian runtime): steps and places are numbers; the drawing turns them into pixels.
import type { Plan, PlanRow } from "./plan";

export interface MapCard { path: string; row: PlanRow; step: number; place: number }
export interface MapArrow { from: string; to: string }
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

/** Steps left to right (0 = no parents, else 1 + the largest parent step); inside a step, near the parents, then plan order. */
export function layoutPlan(plan: Plan): PlanMap {
  const hasChild = new Set(plan.rows.flatMap(r => r.afterPaths));
  const linked = plan.rows.filter(r => r.afterPaths.length > 0 || hasChild.has(r.path));
  const unlinked = plan.rows.filter(r => !linked.includes(r));
  const arrows = linked.flatMap(r => r.afterPaths.map(from => ({ from, to: r.path })));

  // Rows are in plan order: parents first, except inside a cycle (a parent not yet placed).
  const step = new Map<string, number>();
  const cyclic = new Set<string>();
  for (const r of linked) {
    const known = r.afterPaths.filter(p => step.has(p));
    for (const p of r.afterPaths) if (!step.has(p)) { cyclic.add(r.path); cyclic.add(p); }
    step.set(r.path, known.length ? 1 + Math.max(...known.map(p => step.get(p)!)) : 0);
  }

  const place = new Map<string, number>();
  const last = linked.length ? Math.max(...step.values()) : 0;
  for (let s = 0; s <= last; s++) {
    const inStep = linked.filter(r => step.get(r.path) === s);
    // Stable sort keeps plan order for ties; rows without a placed parent go after those with one.
    const key = (r: PlanRow): number => {
      const ps = r.afterPaths.filter(p => place.has(p));
      return ps.length ? ps.reduce((a, p) => a + place.get(p)!, 0) / ps.length : Infinity;
    };
    [...inStep].sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1)).forEach((r, i) => place.set(r.path, i));
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

export interface MapGeometry {
  width: number; height: number;
  /** Top-left corner of each card, by path. */
  pos: Map<string, { x: number; y: number }>;
  /** One curve per arrow, from the right edge of the first card to the left edge of the second. */
  curves: { from: string; to: string; d: string }[];
  /** Scroll position that puts the start step at the left edge. */
  scrollLeft: number;
}

/** Pixels for a layout: steps go left to right, places top to bottom. */
export function mapGeometry(map: PlanMap): MapGeometry {
  const pos = new Map<string, { x: number; y: number }>();
  for (const c of map.cards) pos.set(c.path, { x: PAD + c.step * (CARD_W + GAP_X), y: PAD + c.place * (CARD_H + GAP_Y) });
  const steps = map.cards.length ? Math.max(...map.cards.map(c => c.step)) + 1 : 0;
  const places = map.cards.length ? Math.max(...map.cards.map(c => c.place)) + 1 : 0;
  const curves = map.arrows.flatMap(a => {
    const f = pos.get(a.from), t = pos.get(a.to);
    if (!f || !t) return [];
    const x1 = f.x + CARD_W, y1 = f.y + CARD_H / 2, x2 = t.x, y2 = t.y + CARD_H / 2, k = Math.max(GAP_X / 2, Math.abs(x2 - x1) / 2);
    return [{ from: a.from, to: a.to, d: `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}` }];
  });
  return {
    width: steps ? 2 * PAD + steps * CARD_W + (steps - 1) * GAP_X : 0,
    height: places ? 2 * PAD + places * CARD_H + (places - 1) * GAP_Y : 0,
    pos, curves, scrollLeft: Math.max(0, map.startStep * (CARD_W + GAP_X)),
  };
}

/** Ticks or unticks a to-do's properties. A to-do on the Done column goes back to Backlog when unticked (else the roll-over would tick it again); the to-do engine stamps or clears `done_on`. */
export function setDone(fm: Record<string, unknown>, done: boolean): void {
  fm.done = done;
  if (!done && fm.day === "Done") fm.day = "Backlog";
}
