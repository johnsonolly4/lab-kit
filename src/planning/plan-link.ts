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
