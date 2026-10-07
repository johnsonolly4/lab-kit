// Planning commands' rules (planning kit): shopping list text, which to-dos to archive, unique names, the meeting deck path.
// Pure (no Obsidian runtime). Ported from the planning suite's Action templates (2026-10-07); see docs/plans/phase-4b-planning-commands.md.
import { parseDay, type TodoFm } from "./todo";

/** Days after which a finished to-do is archived. */
export const ARCHIVE_AFTER = 30;

/** "a, b ,, c" -> ["a", "b", "c"]: the shopping list's text box takes commas between items. */
export const splitItems = (input: string): string[] => input.split(",").map(s => s.trim()).filter(Boolean);

/** The shopping list with `items` added at the end as unticked checkboxes (one line break before, one after; as the old template). */
export const shoppingAppend = (text: string, items: string[]): string =>
  text.replace(/\s*$/, "\n") + items.map(i => "- [ ] " + i).join("\n") + "\n";

/** `folder/base.ext`, else `folder/base 2.ext`, `base 3`, … : the first path `exists` says is free. */
export function uniquePath(folder: string, base: string, ext: string, exists: (path: string) => boolean): string {
  const at = (name: string): string => (folder ? `${folder}/` : "") + `${name}.${ext}`;
  let path = at(base), n = 2;
  while (exists(path)) path = at(`${base} ${n++}`);
  return path;
}

/** Finished: `done` ticked, or on the Done column. */
export const isFinished = (fm: TodoFm): boolean => fm.done === true || fm.day === "Done";

/**
 * A finished to-do whose finish date (`done_on`, else the note's last change) is more than ARCHIVE_AFTER days before `now`.
 * As the old template (moment().subtract(30, "days")): the cut-off keeps the time of day, so `done_on` exactly 30 days ago counts.
 */
export function isArchivable(fm: TodoFm, mtime: Date, now: Date): boolean {
  if (!isFinished(fm)) return false;
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ARCHIVE_AFTER, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const done = parseDay(fm.done_on) ?? mtime;
  return done.getTime() < cutoff.getTime();
}

/** The deck path for this computer from the meetings hub (`deck_mac` / `deck_windows`), without surrounding quotes; "" when not set. */
export function deckPath(fm: Record<string, unknown>, isMac: boolean): string {
  const v = isMac ? fm.deck_mac : fm.deck_windows;
  return (typeof v === "string" ? v : "").trim().replace(/^["']|["']$/g, "");
}
