// "+ add after this" on the plan map (planning kit): which to-dos the search offers, and the text of a new to-do.
// Pure (no Obsidian runtime). Used by src/planning/add-after.ts.
import { isFinished } from "./actions";
import { linkTarget, type NoteRec } from "./lists";
import { canLink } from "./plan-link";
import type { Plan } from "./plan";
import { ymd } from "./todo";

export interface Offered {
  path: string; name: string;
  /** The project it belongs to now (a hub name), "" when none. */
  project: string;
  /** In the project of this map: only a link is written. */
  same: boolean;
  /** Why it cannot be taken into this project (it has links in its own), or null. */
  blocked: string | null;
  /** The line in the search. */
  label: string;
}

const lastName = (v: unknown): string => linkTarget(v).split("/").pop() ?? "";
const has = (v: unknown): boolean => Array.isArray(v) ? v.some(i => linkTarget(i)) : !!linkTarget(v);

/** The open to-dos of the vault the search offers for "comes after `from`": this project's first (not itself, not already after it, not making a loop), then other projects' and the ones with no project, with the project named. A to-do of another project that has its own `after`, `sub` or subtasks is listed but cannot be moved here. */
export function offeredTodos(all: NoteRec[], plan: Plan, hubName: string, from: string): Offered[] {
  const todos = all.filter(t => t.fm.kind === "todo" && !isFinished({ done: t.fm.done, day: t.fm.day }) && t.path !== from);
  const subtasksOf = new Set(todos.map(t => linkTarget(t.fm.sub).split("/").pop() ?? "").filter(Boolean));   // names that some to-do names as its parent
  const out: Offered[] = [];
  for (const t of todos) {
    const project = lastName(t.fm.project), same = project === hubName;
    if (same) {
      if (canLink(plan, from, t.path) !== "ok") continue;
      out.push({ path: t.path, name: t.name, project, same, blocked: null, label: t.name });
      continue;
    }
    const blocked = has(t.fm.after) || has(t.fm.sub) || subtasksOf.has(t.name) ? "it has links in its own project" : null;
    out.push({ path: t.path, name: t.name, project, same, blocked, label: `${t.name} · ${project || "no project"}${blocked ? " (has links in its own project)" : ""}` });
  }
  return out.sort((a, b) => Number(b.same) - Number(a.same) || a.project.localeCompare(b.project) || a.name.localeCompare(b.name));
}

/** A name safe for a file: the characters notes cannot have become "-", at most 80 long (as the To-do template does). */
export const todoFileName = (typed: string): string => typed.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-").slice(0, 80).trim();

const afterLines = (after: string | string[]): string => {
  const links = (Array.isArray(after) ? after : [after]).filter(Boolean);
  return links.length === 0 ? "" : links.length === 1 ? `after: "${links[0]}"\n` : `after:\n${links.map(l => `  - "${l}"`).join("\n")}\n`;
};

/** The text of a new to-do, with the same properties as the To-do template makes with nothing asked: in Backlog, no due date or priority, in `project`, coming after `after` (a link like `[[Name]]`; several make a list, none leaves the line out like the To-do template does). */
export function newTodoText(project: string, after: string | string[], today: Date, set: { due?: string; priority?: number | ""; meeting?: string; experiment?: string } = {}): string {
  return `---
kind: todo
day: Backlog
planned: ${ymd(today)}
done: false
rolled: false
project: ${project ? `"[[${project}]]"` : ""}
due: ${set.due ?? ""}
countdown: false
priority: ${set.priority ?? ""}
${afterLines(after)}meeting: ${set.meeting ? `"[[${set.meeting}]]"` : "false"}
${set.experiment ? `experiment: "[[${set.experiment}]]"\n` : ""}cssclasses:
  - vt
---

\`\`\`vault-card
show: todo-bar
\`\`\`

`;
}
