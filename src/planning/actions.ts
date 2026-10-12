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
 * `projectActive`: the to-do belongs to a project whose Status is not Done; it is never archived then.
 * As the old template (moment().subtract(30, "days")): the cut-off keeps the time of day, so `done_on` exactly 30 days ago counts.
 */
export function isArchivable(fm: TodoFm, mtime: Date, now: Date, projectActive = false): boolean {
  if (!isFinished(fm) || projectActive) return false;   // a to-do of a project that is not Done stays: the project plan reads it
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ARCHIVE_AFTER, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const done = parseDay(fm.done_on) ?? mtime;
  return done.getTime() < cutoff.getTime();
}

/** The deck path for this computer from the meetings hub (`deck_mac` / `deck_windows`), without surrounding quotes; "" when not set. */
export function deckPath(fm: Record<string, unknown>, isMac: boolean): string {
  const v = isMac ? fm.deck_mac : fm.deck_windows;
  return (typeof v === "string" ? v : "").trim().replace(/^["']|["']$/g, "");
}

/* ---- Sort inbox ---- */
/** A note name without the characters a file name or a wikilink can't hold (each becomes "-"), as the old Sort inbox template. */
export const cleanName = (s: string): string => s.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim();

/** The name a sorted note gets: the typed name cleaned, else (empty, or nothing left after cleaning) its current name. */
export const sortedName = (current: string, typed: string | null): string => cleanName(typed || current) || current;

/** `root` and every folder below it, sorted: the choices for "Knowledge…", "How-to…", "Meetings…". */
export const subfolders = (folders: string[], root: string): string[] =>
  folders.filter(p => p === root || p.startsWith(root + "/")).sort();

/** The topic folders directly under `root` that have no hub yet: no `<Topic>/<Topic>.md` and no note with `kind: hub` in them. */
export function topicsWithoutHub(folders: string[], notes: { path: string; kind: unknown }[], root: string): string[] {
  const direct = (path: string): string => path.slice(0, path.lastIndexOf("/"));
  return folders.filter(p => p.startsWith(root + "/") && !p.slice(root.length + 1).includes("/")).sort()
    .filter(p => !notes.some(n => direct(n.path) === p && (n.kind === "hub" || n.path === `${p}/${p.slice(root.length + 1)}.md`)));
}

/** An inbox note made into a to-do: on the Backlog, open; project / due / meeting added only when missing. */
export function todoFields(fm: Record<string, unknown>): void {
  fm.kind = "todo"; fm.day = "Backlog"; fm.done = false; fm.rolled = false;
  if (!("project" in fm)) fm.project = "";
  if (!("due" in fm)) fm.due = "";
  if (!("meeting" in fm)) fm.meeting = false;
}
