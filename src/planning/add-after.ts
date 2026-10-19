// "+ add after this" on the plan map (planning kit): drop a dragged node on the box, search every open to-do of the vault, or type a name to make a new one.
// The rules are in src/planning/todo-picker.ts (pure); the picker is the planning kit's own `pick`.
import { openEntry, pointerAnchor, type EntryAnswer } from "./entry-window";
import { todoFields } from "./todo-bar";
import { Notice, type App } from "obsidian";
import { pick } from "./ask";
import { linkText, namesOf, recordChange, recordCreate, runHistory, undoNotice } from "./after-write";
import type { NoteRec } from "./lists";
import type { Plan } from "./plan";
import type { HistoryStep, PlanHistory } from "./plan-history";
import { addAfter, planInsert, removeAfter } from "./plan-link";
import { newTodoText, offeredTodos, todoFileName, type Offered } from "./todo-picker";

export interface AddAfterEnv {
  app: App;
  history: PlanHistory;
  /** The project hub of this map. */
  hub: NoteRec;
  /** The to-do folder (a new to-do goes here). */
  folder: string;
  /** Every to-do of the vault, as notes. */
  todos: NoteRec[];
  plan: Plan;
  /** The lab notes to pick an experiment from (`experimentOptions`); left out when there is no lab folder: no Experiment chip. */
  experiments?: { label: string; value: string }[];
}

type Choice = { kind: "todo"; item: Offered } | { kind: "new"; text: string };
let group = 0;
/** A new group number for the history steps of one action (shared with the plan map's drags). */
export const nextGroup = (): number => ++group;

const NO_LOOP = "That would make a loop: the other to-do already comes before this one.";

/** Puts the to-do `n` between `a` and `b` (the arrow a → b): `n` comes after `a`, `b` comes after `n` instead of `a`. One Undo step for both writes; returns its first step. */
export function insertBetween(app: App, history: PlanHistory, plan: Plan, a: string, b: string, n: string, group: number): Promise<HistoryStep | null> {
  return insertBetweenMany(app, history, plan, a, [b], n, group);
}

/** The to-dos that come directly after `a` on the map (a subtask's link is drawn to its parent card, so subtasks are not followers here). */
export const followersOf = (plan: Plan, a: string): string[] => plan.rows.filter(r => r.parent === null && r.afterPaths.includes(a)).map(r => r.path);

/** Puts the to-do `n` between `a` and all of `bs` (each an arrow a → b): `n` comes after `a`, every `b` comes after `n` instead of `a`. Nothing is written unless every one is allowed. One Undo step for all the writes; returns its first step. */
export async function insertBetweenMany(app: App, history: PlanHistory, plan: Plan, a: string, bs: string[], n: string, group: number): Promise<HistoryStep | null> {
  const checks = bs.map(b => planInsert(plan, a, b, n));
  const bad = checks.find(c => c.verdict !== "ok");
  if (bad || !bs.length) { new Notice(bad?.verdict === "loop" ? NO_LOOP : bad?.verdict === "self" ? "Pick a to-do other than the ones it goes between." : "Those to-dos are not linked any more."); return null; }
  const nameOf = (p: string): string => plan.rows.find(r => r.path === p)?.name ?? p;
  const label = `Inserted "${nameOf(n)}" between "${nameOf(a)}" and ${quoted(bs.map(nameOf))}`;
  const first = checks[0].nAfterA ? await recordChange(app, history, n, "after", label, v => addAfter(v, linkText(app, a, n)), group) : null;
  let firstB: HistoryStep | null = null;
  for (const [i, b] of bs.entries()) {
    const step = await recordChange(app, history, b, "after", label, v => { const rest = removeAfter(v, namesOf(a)); return checks[i].bAfterN ? addAfter(rest, linkText(app, n, b)) : rest; }, group);
    firstB ??= step;
  }
  return first ?? firstB;
}

/** `"B"`, `"B" and "C"`, `"B", "C" and "D"`. */
const quoted = (names: string[]): string => names.length < 2 ? names.map(n => `"${n}"`).join("") : `${names.slice(0, -1).map(n => `"${n}"`).join(", ")} and "${names[names.length - 1]}"`;

/** Asks which to-do comes after `from` (search, or type a new name) and writes it. With `before` (the to-do `from` → `before` is an arrow of) the chosen one goes between the two instead. Every link written and every new to-do goes in Undo / Redo (undoing a new to-do removes the note, if nobody has written in it since). */
export async function addAfterFlow(env: AddAfterEnv, from: string, before?: string | string[], at?: { left: number; bottom: number }): Promise<void> {
  const fromName = env.plan.rows.find(r => r.path === from)?.name ?? from;
  const befores = before === undefined ? [] : Array.isArray(before) ? before : [before];
  const answer = await openEntry(env.app, "New to-do", entryFields(env), { requireTitle: true, alt: "Pick existing…", anchor: at ?? null });
  if (!answer) return;
  if (answer.alt) { await pickFlow(env, from, befores); return; }
  await createFrom(env, from, fromName, answer, befores);
}

/** The + after button on a card: a new to-do goes between the card and everything that comes after it (or just after it, when nothing does). Dragging the card's dot into "+ add after this" keeps the old meaning: the new to-do is one more branch, the followers stay linked to the card. */
export async function insertAfterFlow(env: AddAfterEnv, from: string, at?: { left: number; bottom: number }): Promise<void> {
  const followers = followersOf(env.plan, from);
  await addAfterFlow(env, from, followers.length ? followers : undefined, at);
}

/** The search list: an existing to-do of the vault (moved here if it is in another project), or a typed name that makes a new one. */
async function pickFlow(env: AddAfterEnv, from: string, befores: string[]): Promise<void> {
  const { app, history, hub } = env;
  const fromName = env.plan.rows.find(r => r.path === from)?.name ?? from;
  const offered = offeredTodos(env.todos, env.plan, hub.name, from);
  const beforeName = quoted(befores.map(b => env.plan.rows.find(r => r.path === b)?.name ?? b));
  const picked = await pick<Choice>(app, offered.map(o => o.label), offered.map((item): Choice => ({ kind: "todo", item })), befores.length ? `Between "${fromName}" and ${beforeName}: search a to-do, or type a name to make a new one` : `Comes after "${fromName}": search a to-do, or type a name to make a new one`, false,
    { prefix: "Create new to-do: ", make: (text): Choice => ({ kind: "new", text }) });
  if (!picked) return;
  if (picked.kind === "new") { await createAfter(env, from, fromName, picked.text, befores); return; }
  const it = picked.item;
  if (it.blocked) { new Notice(`"${it.name}" can't be moved to this project: ${it.blocked}. Open it and clear those links first.`, 10000); return; }
  if (!it.same) {
    const ok = await pick<boolean>(app, [`Move "${it.name}" to this project`, "Cancel"], [true, false], `"${it.name}" is in ${it.project ? `"${it.project}"` : "no project"}. Move it here?`);
    if (!ok) return;
  }
  const g = ++group;
  if (befores.length) {
    if (befores.some(b => planInsert(env.plan, from, b, it.path).verdict !== "ok")) { await insertBetweenMany(app, history, env.plan, from, befores, it.path, g); return; }   // says why in a notice, before anything is moved
    if (!it.same) await recordChange(app, history, it.path, "project", `Moved "${it.name}" here`, () => `[[${hub.name}]]`, g);
    const done = await insertBetweenMany(app, history, env.plan, from, befores, it.path, g);
    if (done) undoNotice(`"${it.name}" now sits between "${fromName}" and ${beforeName}.`, () => runHistory(app, history, "undo", done));
    return;
  }
  const text = linkText(app, from, it.path);
  const step = await recordChange(app, history, it.path, "after", `Comes after "${fromName}"`, v => addAfter(v, text), g);
  if (!it.same) await recordChange(app, history, it.path, "project", `Moved "${it.name}" here`, () => `[[${hub.name}]]`, g);
  undoNotice(it.same ? `"${it.name}" now comes after "${fromName}".` : `Moved "${it.name}" here; it comes after "${fromName}".`, () => runHistory(app, history, "undo", step));
}

/** Makes a to-do in the project of this map, coming after `from`: the entry window (the name typed in the search is the title; the project is this map's, so no Project chip) sets its meeting, due date and priority. */
async function createAfter(env: AddAfterEnv, from: string, fromName: string, typed: string, befores: string[]): Promise<void> {
  const answer = await openEntry(env.app, "New to-do", entryFields(env), { title: typed, requireTitle: true, alt: "Pick existing…", anchor: pointerAnchor() });   // where the cursor is: the search list had no spot to point at
  if (!answer) return;
  if (answer.alt) { await pickFlow(env, from, befores); return; }
  await createFrom(env, from, fromName, answer, befores);
}

/** The chips of the window: a to-do's, without Project (this map's project is the project). */
function entryFields(env: AddAfterEnv): ReturnType<typeof todoFields> {
  const series = env.app.vault.getMarkdownFiles().filter(f => env.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "meeting-series").map(f => f.basename).sort((a, b) => a.localeCompare(b));
  return todoFields([], series, env.experiments).filter(f => f.key !== "project" && f.key !== "scheduled");
}

/** Makes the note of a new to-do in this map's project from the window's answer: its file name (a number added when taken) and text, coming after the to-dos `after` (paths). Null when the title is empty. */
async function makeTodo(env: AddAfterEnv, answer: EntryAnswer, after: string[]): Promise<{ name: string; path: string; text: string } | null> {
  const base = todoFileName(answer.title);
  if (!base) return null;
  const v = answer.values;
  let name = base, n = 2;
  while (env.app.vault.getFileByPath(`${env.folder}/${name}.md`)) name = `${base} ${n++}`;
  const path = `${env.folder}/${name}.md`;
  const text = newTodoText(env.hub.name, after.map(a => linkText(env.app, a, path)), { due: String(v.due ?? ""), priority: typeof v.priority === "number" ? v.priority : "", meeting: String(v.meeting ?? ""), experiment: String(v.experiment ?? ""), waiting: String(v.waiting ?? "") });
  await env.app.vault.create(path, text);
  return { name, path, text };
}

/** The + before button on a card: a new to-do goes between the card's predecessors and the card (the card with nothing before it gets the new to-do as its first step). Window under the +; every link and the new note is one Undo step. */
export async function insertBeforeFlow(env: AddAfterEnv, b: string, at?: { left: number; bottom: number }): Promise<void> {
  const answer = await openEntry(env.app, "New to-do", entryFields(env), { requireTitle: true, anchor: at ?? null });
  if (!answer) return;
  const parents = env.plan.rows.find(r => r.path === b)?.afterPaths ?? [];
  const made = await makeTodo(env, answer, parents);
  if (!made) return;
  const nameOf = (p: string): string => env.plan.rows.find(r => r.path === p)?.name ?? p;
  const g = ++group;
  const step = recordCreate(env.history, made.path, made.text, `Made "${made.name}"`, g);
  await recordChange(env.app, env.history, b, "after", `Inserted "${made.name}" before "${nameOf(b)}"`, v => addAfter(removeAfter(v, parents.flatMap(namesOf)), linkText(env.app, made.path, b)), g);
  undoNotice(parents.length ? `Made the to-do "${made.name}" between ${quoted(parents.map(nameOf))} and "${nameOf(b)}".` : `Made the to-do "${made.name}", now the step before "${nameOf(b)}".`, () => runHistory(env.app, env.history, "undo", step));
}

async function createFrom(env: AddAfterEnv, from: string, fromName: string, answer: EntryAnswer, befores: string[]): Promise<void> {
  const made = await makeTodo(env, answer, [from]);
  if (!made) return;
  const { name, path, text } = made;
  const g = ++group;
  const step = recordCreate(env.history, path, text, `Made "${name}"`, befores.length ? g : undefined);
  if (befores.length) {   // the new to-do already comes after `from`; each of `befores` now comes after it instead of after `from`
    const beforeName = quoted(befores.map(b => env.plan.rows.find(r => r.path === b)?.name ?? b));
    for (const before of befores) await recordChange(env.app, env.history, before, "after", `Inserted "${name}" before ${quoted([env.plan.rows.find(r => r.path === before)?.name ?? before])}`, v => addAfter(removeAfter(v, namesOf(from)), linkText(env.app, path, before)), g);
    undoNotice(`Made the to-do "${name}" between "${fromName}" and ${beforeName}.`, () => runHistory(env.app, env.history, "undo", step));
    return;
  }
  undoNotice(`Made the to-do "${name}", coming after "${fromName}".`, () => runHistory(env.app, env.history, "undo", step));
}
