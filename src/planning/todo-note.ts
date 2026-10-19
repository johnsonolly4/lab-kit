// To-do note without Templater (spike N1, docs/plans/templater-spike.md): the text kits/planning/Extras/Templates/To-do.md writes, built by the token engine.
// NOT wired into any command: New to-do still goes through the template.
import type { TFile, Vault } from "obsidian";
import { fillTemplate, type TemplateEnv } from "../kit/snippet-template";
import { todoFileName } from "./quick-todo";
import { dateOf, weekdayOf, ymd } from "./todo";

/** What the entry window hands over (`window.vtTodo` in commands.ts). */
export interface TodoAnswer { text: string; project: string; meeting: string; due: string; priority: number | ""; experiment: string; waiting?: string; scheduled?: string }

/** The note, line for line as To-do.md writes it (I2 slim model: only set values). `waiting` arrives as `waiting_json` because the engine has no JSON-escape token; an optional line is a `{{#if}}` block alone on its line, which takes its line break with it. */
export const TODO_TEMPLATE = `---
kind: todo
{{#if scheduled}}
scheduled: {{scheduled}}
{{/if}}
done: false
{{#if project}}
project: "[[{{project}}]]"
{{/if}}
{{#if due}}
due: {{due}}
{{/if}}
{{#if priority}}
priority: {{priority}}
{{/if}}
{{#if after}}
after: "[[{{after}}]]"
{{/if}}
{{#if meeting}}
meeting: "[[{{meeting}}]]"
{{/if}}
{{#if experiment}}
experiment: "[[{{experiment}}]]"
{{/if}}
{{#if waiting_json}}
waiting: {{waiting_json}}
{{/if}}
cssclasses:
  - vt
---

\`\`\`vault-card
show: todo-bar
\`\`\`
`;

/** The engine reads nothing from the vault for this template. */
const NO_ENV: TemplateEnv = {
  prefix: "", nextFreeIndex: () => 0, uniqueTable: b => b, tableRows: () => 0, noteProperty: () => "", noteText: () => "",
  rigTables: () => "", rigDiagram: () => "", rigSummary: () => "",
};

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

/** The new to-do's text. `day` is what the note held before the template ran: a `scheduled` date or a board column's weekday (see `startDate`); `after` the to-do it comes after (the template's boxes ask it; the entry window has no chip for it). */
export function todoNoteText(a: TodoAnswer, day: string | undefined, today: Date, after = ""): string {
  const waiting = String(a.waiting ?? "").trim();
  return fillTemplate(TODO_TEMPLATE, {
    scheduled: startDate(a.scheduled ?? day, today),   // the entry window's Day chip, else the board column
    project: a.project || "",
    due: a.due || "",
    priority: String(a.priority),
    after,
    meeting: a.meeting || "",
    experiment: a.experiment || "",
    waiting_json: waiting ? JSON.stringify(waiting) : "",
  }, NO_ENV);
}

/** Makes the to-do in `folder` (which exists) under the name rule of `todoFileName`; returns the file. */
export function createTodoNote(vault: Vault, folder: string, a: TodoAnswer, day: string | undefined, today: Date, after = ""): Promise<TFile> {
  const name = todoFileName(a.text, n => !!vault.getAbstractFileByPath(`${folder}/${n}.md`));
  return vault.create(`${folder}/${name}.md`, todoNoteText(a, day, today, after));
}
