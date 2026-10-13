// Writing a to-do's `after` (planning kit): shared by the plan map (drag a link) and the Link to-dos in order command.
// The values come from src/planning/plan-link.ts (pure).
import { Notice, type App } from "obsidian";

/** A notice with an Undo button. */
export function undoNotice(text: string, undo: () => Promise<void>): void {
  const n = new Notice("", 8000);
  n.messageEl.createSpan({ text: `${text} ` });
  n.messageEl.createEl("button", { text: "Undo" }).addEventListener("click", () => { n.hide(); undo().catch(() => { new Notice("Could not undo that."); }); });
}

/** Changes `after` on the to-do `to`. `change` gets the old value and returns the new one (undefined removes the property). */
export const changeAfter = (app: App, to: string, change: (value: unknown) => unknown): Promise<void> => changeKey(app, to, "after", change);

/** Changes `sub` (the to-do this one is a subtask of) on the to-do `child`: same as `changeAfter`; `undefined` removes the property. */
export const changeSub = (app: App, child: string, change: (value: unknown) => unknown): Promise<void> => changeKey(app, child, "sub", change);

async function changeKey(app: App, path: string, key: "after" | "sub", change: (value: unknown) => unknown): Promise<void> {
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
