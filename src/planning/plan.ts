// The plan of one project (planning kit): its to-dos with `after` (links to the to-dos that come first), `result` (one line) and `order` (a number).
// Pure (no Obsidian runtime). Gives the rows in plan order, which are blocked, and what is wrong (missing links, cycles).
import { isFinishedTodo, parseDay, waitingOf } from "./todo";
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
  /** `priority` 1, 2 or 3 (1 = highest); none otherwise. */
  priority: number | null;
  /** Open, not waiting on something outside the plan (`waiting`), and some to-do before it (any number of `after` links back) is not done, even if its own `after` to-do was ticked out of order. */
  blocked: boolean;
  /** The to-do this one is a subtask of (`sub`; its path), or null. One level only. */
  parent: string | null;
  /** The to-do its `sub` names, found in this project, even when that `sub` is refused (a subtask of a subtask, a loop): null when `sub` is empty or names nothing found. */
  subOf: string | null;
  /** The subtasks of this to-do, in plan order. */
  subs: { path: string; name: string; done: boolean }[];
  /** The lab note named by `experiment` (its `Status` as written, "" when empty; path "" when no such lab note), or null. */
  experiment: { name: string; path: string; status: string } | null;
}
/** A one-click fix for an issue: clear `key` on the to-do `path` (`after`: only the item that names `target`). */
export interface PlanFix {
  path: string; key: "sub" | "after" | "experiment"; target?: string;
  /** The button: what it does, in a few words. */
  label: string;
  /** Its hover text: exactly what is changed. */
  does: string;
  /** The notice after it ran. */
  done: string;
}
/** Something wrong in the notes: the to-dos it is about (marked on the map), a plain sentence (what is wrong and what it means), and the fixes the map can offer. */
export interface PlanIssue { paths: string[]; text: string; fixes: PlanFix[] }
export interface Plan { rows: PlanRow[]; problems: string[]; issues: PlanIssue[] }

const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();
/** `order` as a number: a number, or text like "2"; anything else is none. */
function orderOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
/** `priority` as 1, 2 or 3 (a number or text); anything else is none. */
function priorityOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return n === 1 || n === 2 || n === 3 ? n : null;
}
/** The `due` of a to-do as YYYY-MM-DD (the date part of a date-time), "" when unreadable. */
const dueOf = (v: unknown): string => { const d = text(v).slice(0, 10); return parseDay(d) ? d : ""; };
/** The items of `after`: one link or a list; empty items dropped. */
const afterItems = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map(i => linkTarget(text(i))).filter(Boolean);

const byPathRow = (rows: PlanRow[], path: string): PlanRow | undefined => rows.find(r => r.path === path);

/** The fix for a `sub` that does not work: removes it, so the to-do is an ordinary one. `named`: the button names the to-do (when two buttons stand side by side). */
const unsub = (n: NoteRec, named = false): PlanFix => ({ path: n.path, key: "sub", label: named ? `Make "${n.name}" a normal to-do` : "Make it a normal to-do", does: `Removes the subtask setting from "${n.name}"; its other settings stay.`, done: `"${n.name}" is a normal to-do now.` });

/** The plan of `hub`: every to-do of the project (finished ones too). Parents come before their children; ties go by `order` (empty last), then by path.
 *  `labNotes`: the lab notes, for the `experiment` link; left out (lab folder not set), nothing is looked up and no message is written. */
export function readPlan(todos: NoteRec[], hub: NoteRec, labNotes?: NoteRec[]): Plan {
  const mine = todos.filter(t => t.fm.kind === "todo" && pointsTo(t.fm.project, hub))
    .sort((a, b) => a.path.localeCompare(b.path));
  const problems: string[] = [], issues: PlanIssue[] = [];
  const issue = (paths: string[], text: string, fixes: PlanFix[] = []): void => { problems.push(text); issues.push({ paths, text, fixes }); };
  const parents = new Map<string, NoteRec[]>();
  for (const t of mine) {
    const found: NoteRec[] = [];
    for (const target of afterItems(t.fm.after)) {
      const p = mine.find(m => m.path.replace(/\.md$/, "") === target || m.name === target.slice(target.lastIndexOf("/") + 1));
      if (!p) issue([t.path], `"${t.name}" comes after "${target}", which isn't in this project.`, [{ path: t.path, key: "after", target, label: `Remove the link to "${target}"`, does: `Removes "${target}" from the "comes after" list of "${t.name}"; its other links stay.`, done: `Removed the link to "${target}".` }]);
      else if (p === t) issue([t.path], `"${t.name}" comes after itself.`);
      else if (!found.includes(p)) found.push(p);
    }
    parents.set(t.path, found);
  }
  // `sub`: the to-do this one belongs to. A bad one (no such to-do, itself, a loop, or a subtask of a subtask) is reported and ignored.
  const match = (n: NoteRec, target: string): boolean => n.path.replace(/\.md$/, "") === target || n.name === target.slice(target.lastIndexOf("/") + 1);
  const wanted = new Map<NoteRec, NoteRec>();
  for (const t of mine) {
    const target = afterItems(t.fm.sub)[0];
    if (!target) continue;
    const p = mine.find(m => match(m, target));
    if (!p) issue([t.path], `"${t.name}" is a subtask of "${target}", which isn't in this project.`, [unsub(t)]);
    else if (p === t) issue([t.path], `"${t.name}" is a subtask of itself.`, [unsub(t)]);
    else wanted.set(t, p);
  }
  const parentOf = new Map<NoteRec, NoteRec>();
  for (const [t, p] of wanted) {
    if (!wanted.has(p)) { parentOf.set(t, p); continue; }
    if (wanted.get(p) === t) { if (t.path < p.path) issue([t.path, p.path], `"${t.name}" and "${p.name}" are subtasks of each other.`, [unsub(t, true), unsub(p, true)]); }
    else issue([t.path], `"${t.name}" is a subtask of "${p.name}", which is itself a subtask (one level only).`, [unsub(t)]);
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
    issue(left.map(t => t.path), `These wait on each other, so none can start: ${left.map(t => `"${t.name}"`).join(", ")}. Remove one "comes after" link.`);
    placed.push(...left);
  }
  const finished = (n: NoteRec): boolean => isFinishedTodo(n.fm);
  /** Some to-do before `t`, through any number of links, is not finished. */
  const openBefore = (t: NoteRec): boolean => {
    const seen = new Set<NoteRec>(), todo = [...parents.get(t.path)!];
    while (todo.length) {
      const n = todo.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      if (!finished(n)) return true;
      todo.push(...parents.get(n.path)!);
    }
    return false;
  };
  const rows = placed.map((t): PlanRow => {
    const ps = parents.get(t.path)!;
    const done = isFinishedTodo(t.fm);
    let experiment: PlanRow["experiment"] = null;
    const target = labNotes ? afterItems(t.fm.experiment)[0] : undefined;
    if (target) {
      const lab = labNotes!.find(n => n.path.replace(/\.md$/, "") === target || n.name === target.slice(target.lastIndexOf("/") + 1));
      experiment = lab ? { name: lab.name, path: lab.path, status: text(lab.fm.Status) } : { name: target, path: "", status: "" };
      if (!lab) issue([t.path], `"${t.name}" links to the experiment "${target}", which wasn't found.`, [{ path: t.path, key: "experiment", label: "Remove the experiment link", does: `Removes the experiment link from "${t.name}".`, done: `Removed the experiment link from "${t.name}".` }]);
    }
    return { path: t.path, name: t.name, done, experiment, parent: parentOf.get(t)?.path ?? null, subOf: wanted.get(t)?.path ?? null, subs: [], after: ps.map(p => p.name), afterPaths: ps.map(p => p.path), due: dueOf(t.fm.due), result: text(t.fm.result),
      order: orderOf(t.fm.order), priority: priorityOf(t.fm.priority), blocked: !done && !waitingOf(t.fm) && openBefore(t) };
  });
  for (const r of rows) if (r.parent) byPathRow(rows, r.parent)?.subs.push({ path: r.path, name: r.name, done: r.done });
  for (const r of rows) {   // ticked on the board, in the note or on the map without ticking the subtasks
    const open = r.subs.filter(s => !s.done).length;
    if (r.done && open) issue([r.path], `"${r.name}" is ticked, but ${open === r.subs.length && open === 1 ? "its subtask isn't" : open === 1 ? "1 of its subtasks isn't" : `${open} of its subtasks aren't`}.`);
  }
  // Only dates the user typed: an open to-do due before an open to-do it comes after.
  const byPath = new Map(rows.map(r => [r.path, r]));
  for (const r of rows) {
    if (r.done || !r.due) continue;
    for (const pp of r.afterPaths) {
      const p = byPath.get(pp)!;
      if (!p.done && p.due && r.due < p.due) issue([r.path], `"${r.name}" is due ${r.due}, before "${p.name}" (${p.due}), which it comes after.`);
    }
  }
  return { rows, problems, issues };
}

/** The project has a plan: some to-do comes after another, has an `order` or has subtasks, or a link is wrong (so the message shows). */
export const hasPlan = (plan: Plan): boolean => plan.rows.some(r => r.after.length > 0 || r.order !== null || r.subs.length > 0) || plan.problems.length > 0;

/** The plan map shows once the project has two to-dos (linked or not: the unlinked ones sit in the map's "Not linked" tiles, where the links are made), or as soon as `hasPlan`. The Plan list keeps `hasPlan`: with nothing linked it would only repeat the to-do list. */
export const hasMap = (plan: Plan): boolean => hasPlan(plan) || plan.rows.length >= 2;

/** The badge class of a lab note status: `vt-` plus the status in lower case with hyphens (Planned, Started, Processing results, Closed have colours in the theme); anything else is neutral. */
export function statusClass(status: string): string {
  const slug = status.trim().toLowerCase().replace(/\s+/g, "-");
  return ["planned", "started", "processing-results", "closed"].includes(slug) ? `vt-${slug}` : "vt-planned";
}

/** The hub's Experiments tile: the lab notes its to-dos name, each once, open ones first (Started, Processing results, Planned, others, Closed), then by name; with the status and the to-dos that name it. A link that finds no lab note is left out (it shows as a line under the plan). */
export function projectExperiments(plan: Plan): ListLine[] {
  const rank = (s: string): number => { const i = ["started", "processing results", "planned"].indexOf(s.trim().toLowerCase()); return s.trim().toLowerCase() === "closed" ? 4 : i < 0 ? 3 : i; };
  const byPath = new Map<string, { name: string; status: string; todos: string[] }>();
  for (const r of plan.rows) {
    const e = r.experiment;
    if (!e?.path) continue;
    const got = byPath.get(e.path) ?? { name: e.name, status: e.status, todos: [] };
    got.todos.push(r.name);
    byPath.set(e.path, got);
  }
  return [...byPath].sort(([, a], [, b]) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name))
    .map(([path, e]): ListLine => ({ path, text: e.name, badges: [
      ...(e.status ? [{ text: e.status, cls: `vt-badge ${statusClass(e.status)}` }] : []),
      { text: e.todos.length === 1 ? `· ${e.todos[0]}` : `· ${e.todos.length} to-dos`, cls: "vt-muted" }] }));
}

/** The Plan tile's lines: open ready rows (plan order), then blocked rows ("after X"), then finished rows (with "→ result"). `finished` counts the last group. */
export function planLines(plan: Plan): { lines: ListLine[]; finished: number } {
  const line = (r: PlanRow, badges: Badge[]): ListLine => ({ path: r.path, text: r.name,
    badges: r.experiment?.status ? [...badges, { text: r.experiment.status, cls: `vt-badge ${statusClass(r.experiment.status)}` }] : badges });
  const ready = plan.rows.filter(r => !r.done && !r.blocked).map(r => line(r, []));
  const blocked = plan.rows.filter(r => r.blocked).map(r => line(r, [{ text: `after ${r.after.join(", ")}`, cls: "vt-muted" }]));
  const done = plan.rows.filter(r => r.done).map(r => line(r, r.result ? [{ text: `→ ${r.result}`, cls: "vt-muted" }] : []));
  return { lines: [...ready, ...blocked, ...done], finished: done.length };
}
