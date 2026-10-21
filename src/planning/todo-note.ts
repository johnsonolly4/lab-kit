// To-do note without Templater (docs/plans/templater-replacement-and-live-snippets.md, Phase 3): the vault's To-do.md is a token template (`make: note`),
// filled by noteFromTemplate. The bundled copy below is what is used when the vault has none, or only an old Templater one (Q7, owner 2026-10-21).
import type { TFile, Vault } from "obsidian";
import { noteFromTemplate } from "../kit/note-template";
import { parseTemplate } from "../kit/snippet-template";
import { todoFileName } from "./quick-todo";
import { dateOf, weekdayOf, ymd } from "./todo";

/** What the entry window hands over (`todoFields` in todo-bar.ts). */
export interface TodoAnswer { text: string; project: string; meeting: string; due: string; priority: number | ""; experiment: string; waiting?: string; scheduled?: string }

/** The bundled To-do.md: the same text as kits/planning/Extras/Templates/To-do.md (a test keeps them equal). Optional lines are `{{#if}}` blocks alone on their line, which take their line break with them. */
export const TODO_TEMPLATE = `---
make: note
fields:
  - key: text
    label: To-do
  - key: scheduled
    label: Day
  - key: project
    label: Project
  - key: due
    label: Due
  - key: priority
    label: Priority
  - key: after
    label: Comes after
  - key: meeting
    label: Meeting
  - key: experiment
    label: Experiment
  - key: waiting
    label: Waiting for
---
---
kind: todo
{{#if scheduled != ""}}
scheduled: {{scheduled}}
{{/if}}
done: false
{{#if project != ""}}
project: "[[{{project}}]]"
{{/if}}
{{#if due != ""}}
due: {{due}}
{{/if}}
{{#if priority != ""}}
priority: {{priority}}
{{/if}}
{{#if after != ""}}
after: "[[{{after}}]]"
{{/if}}
{{#if meeting != ""}}
meeting: "[[{{meeting}}]]"
{{/if}}
{{#if experiment != ""}}
experiment: "[[{{experiment}}]]"
{{/if}}
{{#if waiting != ""}}
waiting: {{json:waiting}}
{{/if}}
cssclasses:
  - vt
---

\`\`\`vault-card
show: todo-bar
\`\`\`
`;

/** The template to use: the vault's text when it is a token template (`make: note`), else the bundled one (an old Templater To-do.md, or none). */
export function todoTemplate(vaultText: string | null, parseYaml: (yaml: string) => unknown): string {
  try { if (vaultText && parseTemplate(vaultText, parseYaml)?.header.make === "note") return vaultText; } catch { /* not a token template */ }
  return TODO_TEMPLATE;
}

/** `YYYY-MM-DD` of `d` in local time (Templater's `tp.date.now("YYYY-MM-DD")`). */
export function isoDay(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The planned date a new note starts with: a `scheduled` date already in it, or an old weekday `day` (a board column) as the next such day from today (today counts); "" for anything else (the Backlog). */
export function startDate(day: string | undefined, today: Date): string {
  const col = (day ?? "").trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(col) ? dateOf({ scheduled: col }, today) : dateOf({ day: col, planned: isoDay(today) }, today);
  return d ? ymd(d) : "";
}

/** What the entry window does with the board column a to-do was made in (`day`: its date, or an old weekday name): the date its Day chip opens with (only today or later; "" otherwise) and the heading that names the weekday. */
export function columnEntry(day: string | undefined, now: Date): { scheduled: string; heading: string } {
  const column = startDate(day, now), d = column ? dateOf({ scheduled: column }, now) : null;
  return { scheduled: column && column >= ymd(now) ? column : "", heading: d ? `New to-do \u00b7 ${weekdayOf(d)}` : "New to-do" };
}

/** The answers the template is filled with. `day` is what the note held before it was filled: a `scheduled` date or a board column's weekday (see `startDate`); `after` the to-do it comes after (the entry window has no chip for it). */
export function todoAnswers(a: TodoAnswer, day: string | undefined, today: Date, after = ""): Record<string, string> {
  return {
    text: a.text,
    scheduled: startDate(a.scheduled ?? day, today),   // the entry window's Day chip, else the board column
    project: a.project || "", due: a.due || "", priority: String(a.priority), after,
    meeting: a.meeting || "", experiment: a.experiment || "", waiting: String(a.waiting ?? ""),
  };
}

/** The new to-do's text from `template` (see `todoTemplate`). Throws a TemplateError for a template that cannot be filled. */
export function todoNoteText(template: string, parseYaml: (yaml: string) => unknown, a: TodoAnswer, day: string | undefined, today: Date, after = ""): string {
  return noteFromTemplate(template, todoAnswers(a, day, today, after), { parseYaml, now: today }).text;
}

/**
 * Whether the note `<folder>/<name>.md` is taken, ignoring capitals: macOS and Windows disks treat "Test.md" and "test.md" as one file, so
 * `vault.create` fails with "File already exists" although Obsidian's exact lookup says the name is free (owner's test 2026-10-21, T6).
 * `except` is a path that does not count (the note being renamed).
 */
export function nameTaken(vault: Pick<Vault, "getAbstractFileByPath"> & Partial<Pick<Vault, "getFolderByPath">>, folder: string, except?: string): (name: string) => boolean {
  return name => {
    const path = `${folder}/${name}.md`;
    if (path === except) return false;
    if (vault.getAbstractFileByPath(path)) return true;
    const low = path.toLowerCase();
    return (vault.getFolderByPath?.(folder)?.children ?? []).some(f => f.path !== except && f.path.toLowerCase() === low);
  };
}

/** Makes the to-do in `folder` (which exists) under the name rule of `todoFileName`; returns the file. */
export function createTodoNote(vault: Vault, folder: string, template: string, parseYaml: (yaml: string) => unknown, a: TodoAnswer, day: string | undefined, today: Date, after = ""): Promise<TFile> {
  const name = todoFileName(a.text, nameTaken(vault, folder));
  return vault.create(`${folder}/${name}.md`, todoNoteText(template, parseYaml, a, day, today, after));
}
