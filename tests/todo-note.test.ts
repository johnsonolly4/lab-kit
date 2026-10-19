// The Templater-free To-do note (src/planning/todo-note.ts) equals what kits/planning/Extras/Templates/To-do.md writes (its frontmatter block; Templater's `-%>` trims the newline after it).
import { readFileSync } from "node:fs";
import { afterEach, describe, it, vi } from "vitest";
import assert from "node:assert";
import { TODO_TEMPLATE, createTodoNote, isoDay, startDate, todoNoteText, type TodoAnswer } from "../src/planning/todo-note";

const TODAY = new Date(2026, 9, 19);   // Mon 2026-10-19, local
const F = "```";
const base: TodoAnswer = { text: "Buy vials", project: "", meeting: "", due: "", priority: "", experiment: "", waiting: "" };

/** The template's output for these values, written out by hand: each optional line is there only when its value is (I2: no day / planned / rolled / countdown, no empty keys). */
function expected(o: { scheduled?: string; project?: string; due?: string; priority?: number | ""; after?: string; meeting?: string; experiment?: string; waiting?: string }): string {
  return [
    "---", "kind: todo", ...(o.scheduled ? [`scheduled: ${o.scheduled}`] : []), "done: false",
    ...(o.project ? [`project: "[[${o.project}]]"`] : []), ...(o.due ? [`due: ${o.due}`] : []), ...(o.priority ? [`priority: ${o.priority}`] : []),
    ...(o.after ? [`after: "[[${o.after}]]"`] : []),
    ...(o.meeting ? [`meeting: "[[${o.meeting}]]"`] : []),
    ...(o.experiment ? [`experiment: "[[${o.experiment}]]"`] : []),
    ...(o.waiting ? [`waiting: ${o.waiting}`] : []),
    "cssclasses:", "  - vt", "---", "", `${F}vault-card`, "show: todo-bar", F, "",
  ].join("\n");
}

describe("todo-note: same text as To-do.md", () => {
  it("no column, nothing set: kind, done and cssclasses only", () => {
    const t = todoNoteText(base, undefined, TODAY);
    assert.equal(t, expected({}));
    for (const k of ["day", "planned", "rolled", "countdown", "project", "due", "priority", "meeting", "scheduled"]) assert.ok(!t.includes(`\n${k}:`), k);
  });
  it("project and due (the plan's third case)", () => {
    assert.equal(todoNoteText({ ...base, project: "Alpha", due: "2026-10-23" }, undefined, TODAY), expected({ project: "Alpha", due: "2026-10-23" }));
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
  it("a board column: a scheduled date kept, an old weekday day read as the next such day (today counts); anything else is the Backlog", () => {
    assert.equal(todoNoteText(base, "Wed", TODAY), expected({ scheduled: "2026-10-21" }));
    assert.equal(todoNoteText(base, "Mon", TODAY), expected({ scheduled: "2026-10-19" }));
    assert.equal(todoNoteText(base, "Wed", new Date(2026, 9, 22)), expected({ scheduled: "2026-10-28" }));
    assert.equal(todoNoteText(base, "2026-10-23", TODAY), expected({ scheduled: "2026-10-23" }));
    for (const v of ["Done", "Backlog", "Teusday", "2026-02-30", ""]) assert.equal(todoNoteText(base, v, TODAY), expected({}), v);
    assert.equal(todoNoteText(base, " Fri ", TODAY), expected({ scheduled: "2026-10-23" }));
  });
  it("everything set", () => {
    const a: TodoAnswer = { text: "x", project: "Alpha", meeting: "Group meeting", due: "2026-11-01", priority: 1, experiment: "ABC0014", waiting: "reply" };
    assert.equal(todoNoteText(a, "Mon", TODAY, "Other"), expected({ scheduled: "2026-10-19", project: "Alpha", due: "2026-11-01", priority: 1, after: "Other", meeting: "Group meeting", experiment: "ABC0014", waiting: '"reply"' }));
  });
  it("text of a value is never read as a token", () => {
    assert.ok(todoNoteText({ ...base, project: "A {{day}} B" }, undefined, TODAY).includes('project: "[[A {{day}} B]]"'));
  });
});

describe("todo-note: the template's own date lines give startDate's date", () => {
  afterEach(() => { vi.useRealTimers(); });
  const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
  const from = tpl.indexOf("const days = "), to = tpl.indexOf("const column = ");
  const block = tpl.slice(from, tpl.indexOf("\n", to)).replace(/^const raw = .*$/m, "");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function("raw", `${block}\nreturn { scheduled, column };`) as (raw: string) => { scheduled: string; column: string | undefined };
  it("for each weekday column and each today of a week, and a scheduled date / no column", () => {
    assert.ok(from > 0 && to > from);
    for (let i = 0; i < 7; i++) {
      const today = new Date(2026, 9, 19 + i);
      vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 19 + i, 15, 30));
      for (const v of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Done", "Backlog", "Teusday"]) {
        const got = run(`---\nday: ${v}\ndone:\n---\n`);
        assert.equal(got.scheduled, startDate(v, today), `${v} on ${isoDay(today)}`);
        assert.equal(got.column, got.scheduled ? v : undefined);
      }
      assert.equal(run("---\nscheduled: 2026-10-30\n---\n").scheduled, "2026-10-30");
      assert.equal(run("---\nscheduled: 2026-02-30\n---\n").scheduled, "");
      assert.equal(run("").scheduled, "");
    }
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
