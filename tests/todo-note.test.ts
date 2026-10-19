// The Templater-free To-do note (src/planning/todo-note.ts) equals what kits/planning/Extras/Templates/To-do.md writes (lines 100-120; Templater's `-%>` trims the newline after it).
import { describe, it } from "vitest";
import assert from "node:assert";
import { TODO_TEMPLATE, createTodoNote, isoDay, todoNoteText, type TodoAnswer } from "../src/planning/todo-note";

const TODAY = new Date(2026, 9, 19);   // 2026-10-19, local
const F = "```";
const base: TodoAnswer = { text: "Buy vials", project: "", meeting: "", due: "", priority: "", experiment: "", waiting: "" };

/** The template's output for these values, written out by hand: each optional line is there only when its value is. */
function expected(o: { day?: string; project?: string; due?: string; priority?: number | ""; after?: string; meeting?: string; experiment?: string; waiting?: string }): string {
  return [
    "---", "kind: todo", `day: ${o.day ?? "Backlog"}`, "planned: 2026-10-19", "done: false", "rolled: false",
    `project: ${o.project ? `"[[${o.project}]]"` : ""}`, `due: ${o.due ?? ""}`, "countdown: false", `priority: ${o.priority ?? ""}`,
    ...(o.after ? [`after: "[[${o.after}]]"`] : []),
    `meeting: ${o.meeting ? `"[[${o.meeting}]]"` : "false"}`,
    ...(o.experiment ? [`experiment: "[[${o.experiment}]]"`] : []),
    ...(o.waiting ? [`waiting: ${o.waiting}`] : []),
    "cssclasses:", "  - vt", "---", "", `${F}vault-card`, "show: todo-bar", F, "",
  ].join("\n");
}

describe("todo-note: same text as To-do.md", () => {
  it("no project: empty values keep their trailing space", () => {
    const t = todoNoteText(base, undefined, TODAY);
    assert.equal(t, expected({}));
    assert.ok(t.includes("\nproject: \n") && t.includes("\ndue: \n") && t.includes("\npriority: \n"));
  });
  it("project and comes-after", () => {
    assert.equal(todoNoteText({ ...base, project: "Alpha" }, undefined, TODAY, "Order solvent"), expected({ project: "Alpha", after: "Order solvent" }));
  });
  it("meeting", () => {
    assert.equal(todoNoteText({ ...base, meeting: "Group meeting" }, undefined, TODAY), expected({ meeting: "Group meeting" }));
  });
  it("due and priority", () => {
    assert.equal(todoNoteText({ ...base, due: "2026-10-23", priority: 2 }, undefined, TODAY), expected({ due: "2026-10-23", priority: 2 }));
  });
  it("experiment", () => {
    assert.equal(todoNoteText({ ...base, experiment: "ABC0014" }, undefined, TODAY), expected({ experiment: "ABC0014" }));
  });
  it("waiting: written as a JSON string", () => {
    assert.equal(todoNoteText({ ...base, waiting: "  supplier's \"quote\"  " }, undefined, TODAY), expected({ waiting: JSON.stringify("supplier's \"quote\"") }));
  });
  it("a board column day; anything else is Backlog", () => {
    assert.equal(todoNoteText(base, "Wed", TODAY), expected({ day: "Wed" }));
    assert.equal(todoNoteText(base, "Done", TODAY), expected({}));
    assert.equal(todoNoteText(base, " Fri ", TODAY), expected({ day: "Fri" }));
  });
  it("everything set", () => {
    const a: TodoAnswer = { text: "x", project: "Alpha", meeting: "Group meeting", due: "2026-11-01", priority: 1, experiment: "ABC0014", waiting: "reply" };
    assert.equal(todoNoteText(a, "Mon", TODAY, "Other"), expected({ day: "Mon", project: "Alpha", due: "2026-11-01", priority: 1, after: "Other", meeting: "Group meeting", experiment: "ABC0014", waiting: '"reply"' }));
  });
  it("text of a value is never read as a token", () => {
    assert.ok(todoNoteText({ ...base, project: "A {{day}} B" }, undefined, TODAY).includes('project: "[[A {{day}} B]]"'));
  });
});

describe("todo-note: engine limits (recorded in docs/plans/templater-spike.md)", () => {
  it("a note name of only commas reads as empty to {{#if}} (To-do.md would link it)", () => {
    assert.equal(todoNoteText({ ...base, project: "," }, undefined, TODAY), expected({}));
  });
  it("the template has no tag the engine could not parse", () => {
    assert.ok(TODO_TEMPLATE.includes("{{#if waiting_json}}"));
  });
});

describe("todo-note: create", () => {
  const vault = (files: string[]) => {
    const made: [string, string][] = [];
    return { made, v: { getAbstractFileByPath: (p: string) => files.includes(p) ? {} : null, create: async (p: string, d: string) => { made.push([p, d]); return {}; } } as never };
  };
  it("makes the note under the name rule", async () => {
    const { made, v } = vault(["00 Planning/To-dos/Buy vials.md"]);
    await createTodoNote(v, "00 Planning/To-dos", { ...base, text: "Buy: vials" }, "Tue", TODAY);
    assert.equal(made[0][0], "00 Planning/To-dos/Buy- vials.md");
    const { made: m2, v: v2 } = vault(["00 Planning/To-dos/Buy vials.md"]);
    await createTodoNote(v2, "00 Planning/To-dos", base, undefined, TODAY);
    assert.equal(m2[0][0], "00 Planning/To-dos/Buy vials 2.md");
    assert.equal(m2[0][1], expected({}));
  });
  it("isoDay is local and zero-padded", () => { assert.equal(isoDay(new Date(2026, 0, 5)), "2026-01-05"); });
});
