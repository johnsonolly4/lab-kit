// The chip bar on a to-do note (`show: todo-bar`): what each chip shows, and the property each one writes. Pure: the block draws it (blocks.ts).
import { linkTarget } from "./lists";
import { parseDue } from "./due-words";

export type ChipKey = "project" | "meeting" | "due" | "priority" | "countdown";

export interface Chip {
  key: ChipKey;
  /** The value to show; empty when nothing is set (the chip then shows "+ <name>"). */
  value: string;
  /** Plain name of the property, for the empty chip and the tooltip. */
  name: string;
}

export const PRIORITY_LABELS = ["1 high", "2 medium", "3 low"] as const;

const NAMES: Record<ChipKey, string> = { project: "Project", meeting: "Meeting", due: "Due", priority: "Priority", countdown: "Countdown" };

/** The note's own name for a link value ("Polymer A"), else "" (empty, `false`, a list). */
const target = (v: unknown): string => {
  const t = typeof v === "string" ? linkTarget(v) : "";
  return t ? t.split("/").pop() ?? "" : "";
};

/** The chips for a to-do's properties, in order. Countdown shows only once a due date is set. */
export function todoChips(fm: Record<string, unknown>): Chip[] {
  const due = typeof fm.due === "string" ? fm.due.slice(0, 10) : "";
  const p = Number(fm.priority);
  const chips: Chip[] = [
    { key: "project", value: target(fm.project), name: NAMES.project },
    { key: "meeting", value: target(fm.meeting), name: NAMES.meeting },
    { key: "due", value: due, name: NAMES.due },
    { key: "priority", value: p >= 1 && p <= 3 ? PRIORITY_LABELS[p - 1] : "", name: NAMES.priority },
  ];
  if (due) chips.push({ key: "countdown", value: fm.countdown === true ? "on" : "", name: NAMES.countdown });
  return chips;
}

type Fm = Record<string, unknown>;
const link = (name: string): string => `[[${name}]]`;

/** The writes, as functions of the frontmatter object (for `processFrontMatter`). An empty value clears the property the way the To-do template leaves it. */
export const setProject = (fm: Fm, name: string | null): void => { fm.project = name ? link(name) : null; };
export const setMeeting = (fm: Fm, name: string | null): void => { fm.meeting = name ? link(name) : false; };
export const setPriority = (fm: Fm, n: 1 | 2 | 3 | null): void => { fm.priority = n; };
export const setCountdown = (fm: Fm, on: boolean): void => { fm.countdown = on; };
/** `due` as YYYY-MM-DD, or cleared (then the countdown goes off: it has nothing to count to). */
export const setDue = (fm: Fm, date: string | null): void => {
  fm.due = date;
  if (!date) fm.countdown = false;
};

/** What was typed in the Due box: "" clears, a date or words (see `parseDue`) sets, anything else is refused (null). */
export function readDueText(text: string, now: Date): { date: string | null } | null {
  const t = text.trim();
  if (!t) return { date: null };
  const date = parseDue(t, now);
  return date ? { date } : null;
}
