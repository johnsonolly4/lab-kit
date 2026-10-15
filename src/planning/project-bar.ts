// The chips in a project hub's top bar (`show: hub-bar` on a project): Status and Deadline, drawn like the to-do chips. Pure: the block draws them (blocks.ts).
import type { EntryField, EntryValues } from "./entry-fields";
import { PROJECT_STATUSES } from "./lists";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The bar's fields. A Status the list does not know (typed by hand in the properties) stays pickable, so showing the bar never loses it. */
export function projectBarFields(current: string): EntryField[] {
  const statuses = !current || PROJECT_STATUSES.includes(current) ? PROJECT_STATUSES : [...PROJECT_STATUSES, current];
  return [
    { key: "Status", name: "Status", icon: "circle-dot", kind: "pick", prompt: "Status?", required: true, options: statuses.map(s => ({ label: s, value: s })) },
    { key: "deadline", name: "Deadline", icon: "calendar", kind: "date", prompt: "Deadline? (fri, 15 nov, 15/11, in 3 days; empty clears)" },
  ];
}

/** A project hub's properties as entry values (a hub with no Status shows the first one, as the drop-down did). */
export function projectBarValues(fm: Record<string, unknown>): EntryValues {
  const deadline = text(fm.deadline).slice(0, 10);
  return { Status: text(fm.Status) || PROJECT_STATUSES[0], deadline };
}

/** Writes one chip's value into the frontmatter object; an emptied Deadline stays an empty property, as the Project hub template has it. */
export function applyProjectValue(fm: Record<string, unknown>, key: string, value: string | number | boolean): void {
  if (key === "Status") fm.Status = String(value);
  else if (key === "deadline") fm.deadline = String(value);
}
