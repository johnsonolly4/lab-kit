// Making and removing `after` links from the plan map (planning kit): the new value of a to-do's `after`, and whether a link is allowed.
// Pure (no Obsidian runtime). Used by src/planning/plan-map-render.ts.
import { linkTarget } from "./lists";
import type { Plan } from "./plan";

const items = (v: unknown): unknown[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);

/** `after` with `link` (like `[[Name]]`) added: nothing becomes the link, one value becomes a list of two, a list gets it at the end; already there, nothing changes. */
export function addAfter(value: unknown, link: string): unknown {
  const have = items(value);
  if (have.some(i => linkTarget(i) === linkTarget(link))) return value;
  return have.length === 0 ? link : [...have, link];
}

/** `after` without the items that point at `names` (the to-do's path without `.md` and its name). One item left becomes a single value; none left gives `undefined` (remove the property). */
export function removeAfter(value: unknown, names: string[]): unknown {
  const matches = (i: unknown): boolean => { const t = linkTarget(i); return names.some(n => t === n || t === n.slice(n.lastIndexOf("/") + 1) || n.endsWith("/" + t)); };
  const left = items(value).filter(i => !matches(i));
  return left.length === 0 ? undefined : left.length === 1 ? left[0] : left;
}

export type LinkVerdict = "ok" | "self" | "already" | "loop";

/** May `to` come after `from`? Not itself, not twice, and not when `to` already comes before `from` (that would make a loop). */
export function canLink(plan: Plan, from: string, to: string): LinkVerdict {
  if (from === to) return "self";
  const parents = new Map(plan.rows.map(r => [r.path, r.afterPaths]));
  if (parents.get(to)?.includes(from)) return "already";
  const seen = new Set<string>();
  const todo = [from];
  while (todo.length) {   // everything before `from`
    const p = todo.pop()!;
    if (p === to) return "loop";
    if (seen.has(p)) continue;
    seen.add(p);
    todo.push(...(parents.get(p) ?? []));
  }
  return "ok";
}

export type NestVerdict = "ok" | "self" | "already" | "has-subs" | "parent-is-sub";

/** May `child` become a subtask of `parent` (`sub`)? Not itself, not its current parent again, not when `child` has subtasks of its own, and not under a subtask (one level only, as `readPlan` reports). Its own `after` links do not matter. */
export function canNest(plan: Plan, child: string, parent: string): NestVerdict {
  if (child === parent) return "self";
  const c = plan.rows.find(r => r.path === child), p = plan.rows.find(r => r.path === parent);
  if (c?.parent === parent) return "already";
  if (c && c.subs.length > 0) return "has-subs";
  if (p && p.parent !== null) return "parent-is-sub";
  return "ok";
}

export type NestAction = { do: "nest"; to: string } | { do: "clear" } | { do: "refuse"; verdict: Exclude<NestVerdict, "ok"> } | { do: "none" };

/** What dropping the to-do `from` does: on a card (`target`) it becomes that card's subtask (or is refused); on the map background it stops being a subtask (a to-do that is not one: nothing); anywhere else nothing. */
export function nestAction(plan: Plan, from: string, target: string | null, onBackground: boolean): NestAction {
  if (target) { const v = canNest(plan, from, target); return v === "ok" ? { do: "nest", to: target } : { do: "refuse", verdict: v }; }
  return onBackground && plan.rows.find(r => r.path === from)?.parent ? { do: "clear" } : { do: "none" };
}

/** `child`'s `after` when the to-do it came after is deleted: the dead link goes, and the deleted to-do's own `after` items take its place (A → B → C becomes A → C).
 *  `deleted`: the names that `after` items use for it; `own`: its `after` value; `childNames`: the names of the child, so it never comes after itself. Nothing left gives `undefined`. */
export function bridgeAfter(value: unknown, deleted: string[], own: unknown, childNames: string[]): unknown {
  const left = items(removeAfter(value, deleted));
  for (const i of items(own)) {
    const itself = removeAfter(i, childNames) === undefined;
    if (!linkTarget(i) || itself || left.some(l => linkTarget(l) === linkTarget(i))) continue;
    left.push(i);
  }
  return left.length === 0 ? undefined : left.length === 1 ? left[0] : left;
}
