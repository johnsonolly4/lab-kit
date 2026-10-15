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
}

type Choice = { kind: "todo"; item: Offered } | { kind: "new"; text: string };
let group = 0;
/** A new group number for the history steps of one action (shared with the plan map's drags). */
export const nextGroup = (): number => ++group;

const NO_LOOP = "That would make a loop: the other to-do already comes before this one.";

/** Puts the to-do `n` between `a` and `b` (the arrow a → b): `n` comes after `a`, `b` comes after `n` instead of `a`. One Undo step for both writes; returns its first step. */
export async function insertBetween(app: App, history: PlanHistory, plan: Plan, a: string, b: string, n: string, group: number): Promise<HistoryStep | null> {
  const ins = planInsert(plan, a, b, n);
  if (ins.verdict !== "ok") { new Notice(ins.verdict === "loop" ? NO_LOOP : ins.verdict === "self" ? "Pick a to-do other than the two it goes between." : "Those two are not linked any more."); return null; }
  const nameOf = (p: string): string => plan.rows.find(r => r.path === p)?.name ?? p;
  const label = `Inserted "${nameOf(n)}" between "${nameOf(a)}" and "${nameOf(b)}"`;
  const first = ins.nAfterA ? await recordChange(app, history, n, "after", label, v => addAfter(v, linkText(app, a, n)), group) : null;
  const last = await recordChange(app, history, b, "after", label, v => { const rest = removeAfter(v, namesOf(a)); return ins.bAfterN ? addAfter(rest, linkText(app, n, b)) : rest; }, group);
  return first ?? last;
}

/** Asks which to-do comes after `from` (search, or type a new name) and writes it. With `before` (the to-do `from` → `before` is an arrow of) the chosen one goes between the two instead. Every link written and every new to-do goes in Undo / Redo (undoing a new to-do removes the note, if nobody has written in it since). */
export async function addAfterFlow(env: AddAfterEnv, from: string, before?: string, at?: { left: number; bottom: number }): Promise<void> {
  const fromName = env.plan.rows.find(r => r.path === from)?.name ?? from;
  const answer = await openEntry(env.app, "New to-do", entryFields(env), { requireTitle: true, alt: "Pick existing…", anchor: at ?? null });
  if (!answer) return;
  if (answer.alt) { await pickFlow(env, from, before); return; }
  await createFrom(env, from, fromName, answer, before);
}

/** The search list: an existing to-do of the vault (moved here if it is in another project), or a typed name that makes a new one. */
async function pickFlow(env: AddAfterEnv, from: string, before?: string): Promise<void> {
  const { app, history, hub } = env;
  const fromName = env.plan.rows.find(r => r.path === from)?.name ?? from;
  const offered = offeredTodos(env.todos, env.plan, hub.name, from);
  const beforeName = before ? env.plan.rows.find(r => r.path === before)?.name ?? before : "";
  const picked = await pick<Choice>(app, offered.map(o => o.label), offered.map((item): Choice => ({ kind: "todo", item })), before ? `Between "${fromName}" and "${beforeName}": search a to-do, or type a name to make a new one` : `Comes after "${fromName}": search a to-do, or type a name to make a new one`, false,
    { prefix: "Create new to-do: ", make: (text): Choice => ({ kind: "new", text }) });
  if (!picked) return;
  if (picked.kind === "new") { await createAfter(env, from, fromName, picked.text, before); return; }
  const it = picked.item;
  if (it.blocked) { new Notice(`"${it.name}" can't be moved to this project: ${it.blocked}. Open it and clear those links first.`, 10000); return; }
  if (!it.same) {
    const ok = await pick<boolean>(app, [`Move "${it.name}" to this project`, "Cancel"], [true, false], `"${it.name}" is in ${it.project ? `"${it.project}"` : "no project"}. Move it here?`);
    if (!ok) return;
  }
  const g = ++group;
  if (before) {
    if (planInsert(env.plan, from, before, it.path).verdict !== "ok") { await insertBetween(app, history, env.plan, from, before, it.path, g); return; }   // says why in a notice, before anything is moved
    if (!it.same) await recordChange(app, history, it.path, "project", `Moved "${it.name}" here`, () => `[[${hub.name}]]`, g);
    const done = await insertBetween(app, history, env.plan, from, before, it.path, g);
    if (done) undoNotice(`"${it.name}" now sits between "${fromName}" and "${beforeName}".`, () => runHistory(app, history, "undo", done));
    return;
  }
  const text = linkText(app, from, it.path);
  const step = await recordChange(app, history, it.path, "after", `Comes after "${fromName}"`, v => addAfter(v, text), g);
  if (!it.same) await recordChange(app, history, it.path, "project", `Moved "${it.name}" here`, () => `[[${hub.name}]]`, g);
  undoNotice(it.same ? `"${it.name}" now comes after "${fromName}".` : `Moved "${it.name}" here; it comes after "${fromName}".`, () => runHistory(app, history, "undo", step));
}

/** Makes a to-do in the project of this map, coming after `from`: the entry window (the name typed in the search is the title; the project is this map's, so no Project chip) sets its meeting, due date and priority. */
async function createAfter(env: AddAfterEnv, from: string, fromName: string, typed: string, before?: string): Promise<void> {
  const answer = await openEntry(env.app, "New to-do", entryFields(env), { title: typed, requireTitle: true, alt: "Pick existing…", anchor: pointerAnchor() });   // where the cursor is: the search list had no spot to point at
  if (!answer) return;
  if (answer.alt) { await pickFlow(env, from, before); return; }
  await createFrom(env, from, fromName, answer, before);
}

/** The chips of the window: a to-do's, without Project (this map's project is the project). */
function entryFields(env: AddAfterEnv): ReturnType<typeof todoFields> {
  const series = env.app.vault.getMarkdownFiles().filter(f => env.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "meeting-series").map(f => f.basename).sort((a, b) => a.localeCompare(b));
  return todoFields([], series).filter(f => f.key !== "project");
}

async function createFrom(env: AddAfterEnv, from: string, fromName: string, answer: EntryAnswer, before?: string): Promise<void> {
  const base = todoFileName(answer.title);
  if (!base) return;
  const v = answer.values;
  let name = base, n = 2;
  while (env.app.vault.getFileByPath(`${env.folder}/${name}.md`)) name = `${base} ${n++}`;
  const path = `${env.folder}/${name}.md`;
  const text = newTodoText(env.hub.name, linkText(env.app, from, path), new Date(), { due: String(v.due ?? ""), priority: typeof v.priority === "number" ? v.priority : "", meeting: String(v.meeting ?? "") });
  await env.app.vault.create(path, text);
  const g = ++group;
  const step = recordCreate(env.history, path, text, `Made "${name}"`, before ? g : undefined);
  if (before) {   // the new to-do already comes after `from`; `before` now comes after it instead of after `from`
    const beforeName = env.plan.rows.find(r => r.path === before)?.name ?? before;
    await recordChange(env.app, env.history, before, "after", `Inserted "${name}" before "${beforeName}"`, v => addAfter(removeAfter(v, namesOf(from)), linkText(env.app, path, before)), g);
    undoNotice(`Made the to-do "${name}" between "${fromName}" and "${beforeName}".`, () => runHistory(env.app, env.history, "undo", step));
    return;
  }
  undoNotice(`Made the to-do "${name}", coming after "${fromName}".`, () => runHistory(env.app, env.history, "undo", step));
}
