// The chip bar on a to-do note (`show: todo-bar`): what each chip shows, and the property each one writes. Pure: the block draws it (blocks.ts).
import { linkTarget } from "./lists";
import { parseDue } from "./due-words";
import type { EntryField, EntryValues } from "./entry-fields";

export type ChipKey = "project" | "meeting" | "due" | "priority";

export interface Chip {
  key: ChipKey;
  /** The value to show; empty when nothing is set (the chip then shows "+ <name>"). */
  value: string;
  /** Plain name of the property, for the empty chip and the tooltip. */
  name: string;
}

export const PRIORITY_LABELS = ["1 high", "2 medium", "3 low"] as const;

const NAMES: Record<ChipKey, string> = { project: "Project", meeting: "Meeting", due: "Due", priority: "Priority" };

/** The note's own name for a link value ("Polymer A"), else "" (empty, `false`, a list). */
const target = (v: unknown): string => {
  const t = typeof v === "string" ? linkTarget(v) : "";
  return t ? t.split("/").pop() ?? "" : "";
};

/** The chips for a to-do's properties, in order. (The due-date countdown is one setting for all to-dos, not a chip.) */
export function todoChips(fm: Record<string, unknown>): Chip[] {
  const due = typeof fm.due === "string" ? fm.due.slice(0, 10) : "";
  const p = Number(fm.priority);
  const chips: Chip[] = [
    { key: "project", value: target(fm.project), name: NAMES.project },
    { key: "meeting", value: target(fm.meeting), name: NAMES.meeting },
    { key: "due", value: due, name: NAMES.due },
    { key: "priority", value: p >= 1 && p <= 3 ? PRIORITY_LABELS[p - 1] : "", name: NAMES.priority },
  ];
  return chips;
}

type Fm = Record<string, unknown>;
const link = (name: string): string => `[[${name}]]`;

/** The writes, as functions of the frontmatter object (for `processFrontMatter`). An empty value clears the property the way the To-do template leaves it. */
export const setProject = (fm: Fm, name: string | null): void => { fm.project = name ? link(name) : null; };
export const setMeeting = (fm: Fm, name: string | null): void => { fm.meeting = name ? link(name) : false; };
export const setPriority = (fm: Fm, n: 1 | 2 | 3 | null): void => { fm.priority = n; };
/** `due` as YYYY-MM-DD, or cleared. */
export const setDue = (fm: Fm, date: string | null): void => { fm.due = date; };

/** What was typed in the Due box: "" clears, a date or words (see `parseDue`) sets, anything else is refused (null). */
export function readDueText(text: string, now: Date): { date: string | null } | null {
  const t = text.trim();
  if (!t) return { date: null };
  const date = parseDue(t, now);
  return date ? { date } : null;
}

/** Project names for the pick list: by name, projects whose Status is Done at the bottom. */
export function projectNames(hubs: { name: string; fm: Record<string, unknown> }[]): string[] {
  const done = (h: { fm: Record<string, unknown> }): boolean => typeof h.fm.Status === "string" && h.fm.Status.trim().toLowerCase() === "done";
  return [...hubs].sort((a, b) => Number(done(a)) - Number(done(b)) || a.name.localeCompare(b.name)).map(h => h.name);
}

/** The Project chip: `projects` are the names to pick from; `required` takes away "(none)" and Enter waits for a pick. */
export function projectField(projects: string[], required = false): EntryField {
  const options = projects.map(p => ({ label: p, value: p }));
  return { key: "project", name: "Project", icon: "folder", kind: "pick", prompt: "Project?", required, options: required ? options : [{ label: "(none)", value: "" }, ...options] };
}

/** The fields of a to-do (the entry window and the in-note bar): `projects` and `series` are the names to pick from. */
export function todoFields(projects: string[], series: string[]): EntryField[] {
  const none = (label: string): { label: string; value: string } => ({ label, value: "" });
  return [
    projectField(projects),
    { key: "meeting", name: "Meeting", icon: "users", kind: "pick", prompt: "Raise at which meeting?", options: [none("(none)"), ...series.map(p => ({ label: p, value: p }))] },
    { key: "due", name: "Due", icon: "calendar", kind: "date", prompt: "Due date? (fri, 15 nov, 15/11, in 3 days; empty clears)" },
    { key: "priority", name: "Priority", icon: "flag", kind: "pick", prompt: "Priority? (1 = high, 3 = low)", options: [none("No priority"), ...PRIORITY_LABELS.map((label, i) => ({ label, value: i + 1 }))] },
  ];
}

/** A to-do's properties as entry values (what the in-note bar starts from). */
export function todoValues(fm: Record<string, unknown>): EntryValues {
  const chips = todoChips(fm), at = (k: string): string => chips.find(c => c.key === k)?.value ?? "";
  const p = Number(fm.priority);
  return { project: at("project"), meeting: at("meeting"), due: at("due"), priority: p >= 1 && p <= 3 ? p : "" };
}

/** Writes one entry value into the frontmatter object. */
export function applyTodoValue(fm: Record<string, unknown>, key: string, value: string | number | boolean): void {
  if (key === "project") setProject(fm, String(value) || null);
  else if (key === "meeting") setMeeting(fm, String(value) || null);
  else if (key === "due") setDue(fm, String(value) || null);
  else if (key === "priority") setPriority(fm, value === "" ? null : (Number(value) as 1 | 2 | 3));
}
