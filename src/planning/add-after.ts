// "+ add after this" on the plan map (planning kit): drop a dragged node on the box, search every open to-do of the vault, or type a name to make a new one.
// The rules are in src/planning/todo-picker.ts (pure); the picker is the planning kit's own `pick`.
import { Notice, type App } from "obsidian";
import { pick } from "./ask";
import { linkText, recordChange, runHistory, undoNotice } from "./after-write";
import type { NoteRec } from "./lists";
import type { Plan } from "./plan";
import type { PlanHistory } from "./plan-history";
import { addAfter } from "./plan-link";
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

/** Asks which to-do comes after `from` (search, or type a new name) and writes it. Every link written goes in Undo / Redo; a new to-do is a new note and is not undone from there. */
export async function addAfterFlow(env: AddAfterEnv, from: string): Promise<void> {
  const { app, history, hub } = env;
  const fromName = env.plan.rows.find(r => r.path === from)?.name ?? from;
  const offered = offeredTodos(env.todos, env.plan, hub.name, from);
  const picked = await pick<Choice>(app, offered.map(o => o.label), offered.map((item): Choice => ({ kind: "todo", item })), `Comes after "${fromName}": search a to-do, or type a name to make a new one`, false,
    { prefix: "Create new to-do: ", make: (text): Choice => ({ kind: "new", text }) });
  if (!picked) return;
  if (picked.kind === "new") { await createAfter(env, from, fromName, picked.text); return; }
  const it = picked.item;
  if (it.blocked) { new Notice(`"${it.name}" can't be moved to this project: ${it.blocked}. Open it and clear those links first.`, 10000); return; }
  if (!it.same) {
    const ok = await pick<boolean>(app, [`Move "${it.name}" to this project`, "Cancel"], [true, false], `"${it.name}" is in ${it.project ? `"${it.project}"` : "no project"}. Move it here?`);
    if (!ok) return;
  }
  const g = ++group, text = linkText(app, from, it.path);
  const step = await recordChange(app, history, it.path, "after", `Comes after "${fromName}"`, v => addAfter(v, text), g);
  if (!it.same) await recordChange(app, history, it.path, "project", `Moved "${it.name}" here`, () => `"[[${hub.name}]]"`, g);
  undoNotice(it.same ? `"${it.name}" now comes after "${fromName}".` : `Moved "${it.name}" here; it comes after "${fromName}".`, () => runHistory(app, history, "undo", step));
}

/** Makes the to-do `typed` in the project of this map, coming after `from`. */
async function createAfter(env: AddAfterEnv, from: string, fromName: string, typed: string): Promise<void> {
  const base = todoFileName(typed);
  if (!base) return;
  let name = base, n = 2;
  while (env.app.vault.getFileByPath(`${env.folder}/${name}.md`)) name = `${base} ${n++}`;
  const path = `${env.folder}/${name}.md`;
  await env.app.vault.create(path, newTodoText(env.hub.name, linkText(env.app, from, path), new Date()));
  new Notice(`Made the to-do "${name}", coming after "${fromName}". It is a new note, so Undo does not remove it.`, 8000);
}
