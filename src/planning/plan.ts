// The plan of one project (planning kit): its to-dos with `after` (links to the to-dos that come first), `result` (one line) and `order` (a number).
// Pure (no Obsidian runtime). Gives the rows in plan order, which are blocked, and what is wrong (missing links, cycles).
import { isFinished } from "./actions";
import { parseDay } from "./todo";
import { linkTarget, pointsTo, type Badge, type ListLine, type NoteRec } from "./lists";

export interface PlanRow {
  path: string; name: string;
  /** Ticked or on the Done column. */
  done: boolean;
  /** Names of the to-dos in `after` that were found. */
  after: string[];
  /** Paths of those to-dos (same order as `after`). */
  afterPaths: string[];
  /** The `due` date as YYYY-MM-DD, "" when none or unreadable. */
  due: string;
  /** The one-line `result`, "" when none. */
  result: string;
  order: number | null;
  /** Open, and at least one of its `after` to-dos is not done. */
  blocked: boolean;
}
export interface Plan { rows: PlanRow[]; problems: string[] }

const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();
/** `order` as a number: a number, or text like "2"; anything else is none. */
function orderOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
/** The items of `after`: one link or a list; empty items dropped. */
/** The `due` of a to-do as YYYY-MM-DD (the date part of a date-time), "" when unreadable. */
const dueOf = (v: unknown): string => { const d = text(v).slice(0, 10); return parseDay(d) ? d : ""; };
const afterItems = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map(i => linkTarget(text(i))).filter(Boolean);

/** The plan of `hub`: every to-do of the project (finished ones too). Parents come before their children; ties go by `order` (empty last), then by path. */
export function readPlan(todos: NoteRec[], hub: NoteRec): Plan {
  const mine = todos.filter(t => t.fm.kind === "todo" && pointsTo(t.fm.project, hub))
    .sort((a, b) => a.path.localeCompare(b.path));
  const problems: string[] = [];
  const parents = new Map<string, NoteRec[]>();
  for (const t of mine) {
    const found: NoteRec[] = [];
    for (const target of afterItems(t.fm.after)) {
      const p = mine.find(m => m.path.replace(/\.md$/, "") === target || m.name === target.slice(target.lastIndexOf("/") + 1));
      if (!p) problems.push(`"${t.name}" comes after "${target}", which is not a to-do of this project.`);
      else if (p === t) problems.push(`"${t.name}" comes after itself.`);
      else if (!found.includes(p)) found.push(p);
    }
    parents.set(t.path, found);
  }
  const orderOfNote = (t: NoteRec): number => orderOf(t.fm.order) ?? Infinity;
  const byOrder = (a: NoteRec, b: NoteRec): number => (orderOfNote(a) === orderOfNote(b) ? 0 : orderOfNote(a) < orderOfNote(b) ? -1 : 1) || a.path.localeCompare(b.path);

  // Repeatedly take the first row (by order) whose parents are all placed; what is left is in or behind a cycle.
  const placed: NoteRec[] = [];
  let left = [...mine].sort(byOrder);
  while (left.length) {
    const next = left.find(t => parents.get(t.path)!.every(p => placed.includes(p)));
    if (!next) break;
    placed.push(next);
    left = left.filter(t => t !== next);
  }
  if (left.length) {
    problems.push(`These to-dos wait on each other in a circle: ${left.map(t => `"${t.name}"`).join(", ")}.`);
    placed.push(...left);
  }
  const rows = placed.map((t): PlanRow => {
    const ps = parents.get(t.path)!;
    const done = isFinished({ done: t.fm.done, day: t.fm.day });
    return { path: t.path, name: t.name, done, after: ps.map(p => p.name), afterPaths: ps.map(p => p.path), due: dueOf(t.fm.due), result: text(t.fm.result),
      order: orderOf(t.fm.order), blocked: !done && ps.some(p => !isFinished({ done: p.fm.done, day: p.fm.day })) };
  });
  // Only dates the user typed: an open to-do due before an open to-do it comes after.
  const byPath = new Map(rows.map(r => [r.path, r]));
  for (const r of rows) {
    if (r.done || !r.due) continue;
    for (const pp of r.afterPaths) {
      const p = byPath.get(pp)!;
      if (!p.done && p.due && r.due < p.due) problems.push(`"${r.name}" is due ${r.due}, before "${p.name}" (${p.due}), which it comes after.`);
    }
  }
  return { rows, problems };
}

/** The project has a plan: some to-do comes after another or has an `order`, or a link is wrong (so the message shows). */
export const hasPlan = (plan: Plan): boolean => plan.rows.some(r => r.after.length > 0 || r.order !== null) || plan.problems.length > 0;

/** The Plan tile's lines: open ready rows (plan order), then blocked rows ("after X"), then finished rows (with "→ result"). `finished` counts the last group. */
export function planLines(plan: Plan): { lines: ListLine[]; finished: number } {
  const line = (r: PlanRow, badges: Badge[]): ListLine => ({ path: r.path, text: r.name, badges });
  const ready = plan.rows.filter(r => !r.done && !r.blocked).map(r => line(r, []));
  const blocked = plan.rows.filter(r => r.blocked).map(r => line(r, [{ text: `after ${r.after.join(", ")}`, cls: "vt-muted" }]));
  const done = plan.rows.filter(r => r.done).map(r => line(r, r.result ? [{ text: `→ ${r.result}`, cls: "vt-muted" }] : []));
  return { lines: [...ready, ...blocked, ...done], finished: done.length };
}
