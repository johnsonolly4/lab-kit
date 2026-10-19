// To-do note without Templater (spike N1, docs/plans/templater-spike.md): the text kits/planning/Extras/Templates/To-do.md writes, built by the token engine.
// NOT wired into any command: New to-do still goes through the template.
import type { TFile, Vault } from "obsidian";
import { fillTemplate, type TemplateEnv } from "../kit/snippet-template";
import { todoFileName } from "./quick-todo";

/** What the entry window hands over (`window.vtTodo` in commands.ts). */
export interface TodoAnswer { text: string; project: string; meeting: string; due: string; priority: number | ""; experiment: string; waiting?: string }

export const TODO_DAYS = ["Backlog", "Mon", "Tue", "Wed", "Thu", "Fri"];

/** The note, line for line as To-do.md writes it (today's properties). `waiting` arrives as `waiting_json` because the engine has no JSON-escape token; an optional line is a `{{#if}}` block alone on its line, which takes its line break with it. */
export const TODO_TEMPLATE = `---
kind: todo
day: {{day}}
planned: {{today}}
done: false
rolled: false
project: {{#if project}}"[[{{project}}]]"{{/if}}
due: {{due}}
countdown: false
priority: {{priority}}
{{#if after}}
after: "[[{{after}}]]"
{{/if}}
meeting: {{#if meeting}}"[[{{meeting}}]]"{{else}}false{{/if}}
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

/** The new to-do's text. `day` is the board column the card was made in (anything not a column: Backlog); `after` the to-do it comes after (the template's boxes ask it; the entry window has no chip for it). */
export function todoNoteText(a: TodoAnswer, day: string | undefined, today: Date, after = ""): string {
  const col = (day ?? "").trim();
  const waiting = String(a.waiting ?? "").trim();
  return fillTemplate(TODO_TEMPLATE, {
    day: TODO_DAYS.includes(col) ? col : "Backlog",
    today: isoDay(today),
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
