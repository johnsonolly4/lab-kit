// Writing a to-do's `after` (planning kit): shared by the plan map (drag a link) and the Link to-dos in order command.
// The values come from src/planning/plan-link.ts (pure).
import { Notice, type App } from "obsidian";
import { sameValue, type HistoryStep, type PlanHistory, type Side } from "./plan-history";
import { setDone } from "./plan-map";

/** A notice with an Undo button. */
export function undoNotice(text: string, undo: () => Promise<void>): void {
  const n = new Notice("", 8000);
  n.messageEl.createSpan({ text: `${text} ` });
  n.messageEl.createEl("button", { text: "Undo" }).addEventListener("click", () => { n.hide(); undo().catch(() => { new Notice("Could not undo that."); }); });
}

/** Changes `after` on the to-do `to`. `change` gets the old value and returns the new one (undefined removes the property). */
export const changeAfter = (app: App, to: string, change: (value: unknown) => unknown): Promise<void> => changeKey(app, to, "after", change);

/** A change to `after`, `sub`, `experiment` or `project` that is also put in `history` (with the old and the new value), so Undo and Redo can run it again. Returns the step. */
export async function recordChange(app: App, history: PlanHistory, path: string, key: "after" | "sub" | "experiment" | "project", label: string, change: (value: unknown) => unknown, group?: number): Promise<HistoryStep> {
  let before: unknown, after: unknown;
  await changeKey(app, path, key, v => { before = v; after = change(v); return after; });
  const step: HistoryStep = { path, key, before, after, label, group };
  history.push(step);
  return step;
}

/** Ticks or unticks a to-do (as `setDone`) and puts it in `history`; the to-do engine stamps or clears `done_on` when it sees the change. `group`: steps of one action (Tick all) share it. */
export async function recordTick(app: App, history: PlanHistory, path: string, done: boolean, label: string, group?: number): Promise<HistoryStep> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error("to-do not found");
  let before: unknown, after: unknown;
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    before = { done: fm.done, day: fm.day };
    setDone(fm, done);
    after = { done: fm.done, day: fm.day };
  });
  const step: HistoryStep = { path, key: "tick", before, after, label, group };
  history.push(step);
  return step;
}

/** Undo of a made note removes it (to the trash, as the user's setting says) when it still has the text it was made with; Redo makes it again. False when the note was changed since. */
async function applyCreate(app: App, s: HistoryStep, side: Side): Promise<boolean> {
  const file = app.vault.getFileByPath(s.path);
  if (side === "redo") { if (!file) await app.vault.create(s.path, String(s.after)); return true; }
  if (!file) return true;   // already gone
  if ((await app.vault.read(file)) !== s.after) return false;   // written in since: not deleted
  await app.fileManager.trashFile(file);
  return true;
}

/** Writes `want` (the `done` and `day` of a tick step) if the to-do still has `expect`; false when it was changed since. */
async function applyTick(app: App, path: string, expect: unknown, want: unknown): Promise<boolean> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error("to-do not found");
  let same = true;
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    same = sameValue({ done: fm.done, day: fm.day }, expect);
    if (!same) return;
    const w = want as { done?: unknown; day?: unknown };
    for (const k of ["done", "day"] as const) { if (w[k] === undefined) delete fm[k]; else fm[k] = w[k]; }
  });
  return same;
}

/** A note made by the map (a new to-do) as a history step, so Undo can remove it again. */
export function recordCreate(history: PlanHistory, path: string, text: string, label: string): HistoryStep {
  const step: HistoryStep = { path, key: "create", before: undefined, after: text, label };
  history.push(step);
  return step;
}

/** Undo (or Redo) one step, with the steps of its group: the latest on that side, or `step` (from a notice's Undo button) when it is still there. The value must still be what the step wrote (else the to-do was changed since: nothing is overwritten and the step is dropped). Says what went wrong in a notice. */
export async function runHistory(app: App, history: PlanHistory, side: Side, step?: HistoryStep): Promise<void> {
  const first = step ?? history.peek(side);
  if (!first || !history.has(side, first)) return;
  const steps = history.withGroup(side, first);
  for (const s of steps) history.remove(side, s);
  const ordered = side === "undo" ? [...steps].reverse() : steps;   // undo the last made first
  for (const s of ordered) {
    const want = side === "undo" ? s.after : s.before, to = side === "undo" ? s.before : s.after;
    let same = true;
    try {
      if (s.key === "tick") same = await applyTick(app, s.path, want, to);
      else if (s.key === "create") same = await applyCreate(app, s, side);
      else await changeKey(app, s.path, s.key, v => { same = sameValue(v, want); return same ? to : v; });
    } catch { new Notice("That to-do is not there any more."); continue; }
    if (!same) { new Notice("That to-do was changed since, so it was left as it is."); continue; }
    history.put(side === "undo" ? "redo" : "undo", s);
  }
}

/** Changes `sub` (the to-do this one is a subtask of) on the to-do `child`: same as `changeAfter`; `undefined` removes the property. */
export const changeSub = (app: App, child: string, change: (value: unknown) => unknown): Promise<void> => changeKey(app, child, "sub", change);

async function changeKey(app: App, path: string, key: "after" | "sub" | "project" | "experiment", change: (value: unknown) => unknown): Promise<void> {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error("to-do not found");
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    const v = change(fm[key]);
    if (v === undefined) delete fm[key]; else fm[key] = v;
  });
}

/** The names that `after` items use for the to-do at `path`: its path without `.md` and its name. */
export const namesOf = (path: string): string[] => { const p = path.replace(/\.md$/, ""); return [p, p.slice(p.lastIndexOf("/") + 1)]; };

/** The link text to write in `to`'s `after` for the to-do `from`: `[[…]]`, as short as Obsidian can make it. */
export function linkText(app: App, from: string, to: string): string {
  const file = app.vault.getFileByPath(from);
  if (!file) throw new Error("to-do not found");
  return `[[${app.metadataCache.fileToLinktext(file, to)}]]`;
}
