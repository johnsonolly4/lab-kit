// Note templates without Templater (Phase 1 of docs/plans/templater-replacement-and-live-snippets.md): the new tokens, the `make: note` header and noteFromTemplate.
// The To-do cases carry the spike's expected texts (written out by hand from To-do.md, never from the new code) through a token-format To-do.md.
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import assert from "node:assert";
import { noteFromTemplate, type NoteEnv } from "../src/kit/note-template";
import { TemplateError, fillTemplate, parseTemplate } from "../src/kit/snippet-template";
import { emptyEnv } from "../src/kit/snippet-env";
import { startDate, type TodoAnswer } from "../src/planning/todo-note";
import { miniYaml } from "./token-snippets";

const F = "```";
const NOW = new Date(2026, 9, 19, 15, 30);   // Mon 2026-10-19, local
const env: NoteEnv = { parseYaml: miniYaml, now: NOW };

/** A note template with these answers' fields (all text, default empty) and this body; the body starts with the note's own front matter. */
const tpl = (body: string, header = "", fields: string[] = []): string =>
  `---\nmake: note\n${header}${fields.length ? "fields:\n" + fields.map(k => `  - key: ${k}\n    label: ${k}\n`).join("") : ""}---\n${body}`;
const made = (body: string, answers: Record<string, string> = {}, fields: string[] = Object.keys(answers), header = ""): string =>
  noteFromTemplate(tpl(body, header, fields), answers, env).text;
const fails = (body: string, answers: Record<string, string>, rx: RegExp, header = ""): void =>
  assert.throws(() => noteFromTemplate(tpl(body, header, Object.keys(answers)), answers, env), (e: unknown) => e instanceof TemplateError && rx.test(e.message));

describe("header: make: note", () => {
  const parse = (head: Record<string, unknown>) => parseTemplate("---\nx: 1\n---\nbody", () => head);
  it("a header with only make: note is a template with no fields; name and folder are read", () => {
    const p = parseTemplate(`---\nmake: note\nname: "{{x}}"\nfolder: Notes\n---\n---\nkind: a\n---\n`, miniYaml);
    assert.deepEqual(p?.header, { title: undefined, icon: undefined, desc: undefined, group: undefined, required: undefined, make: "note", name: "{{x}}", folder: "Notes", fields: [] });
    assert.equal(p?.body, "---\nkind: a\n---\n");
  });
  it("make must be note, and cannot go with run", () => {
    assert.throws(() => parse({ make: "snippet" }), /make: must be note/);
    assert.throws(() => parse({ make: "note", run: "raft" }), /no run:/);
  });
  it("fields that are not a list still fail; a snippet header's name and folder keys are ignored as before", () => {
    assert.throws(() => parse({ make: "note", fields: "x" }), /must be a list/);
    const p = parse({ fields: [], name: "x", folder: "y" });
    assert.equal(p?.header.make, undefined);
    assert.equal(p?.header.name, undefined);
  });
});

describe("{{today}} and {{date:…}}", () => {
  it("{{today}} is the local day, zero padded", () => {
    assert.equal(made("{{today}}"), "2026-10-19");
    assert.equal(noteFromTemplate(tpl("{{today}}"), {}, { ...env, now: new Date(2026, 0, 5, 0, 1) }).text, "2026-01-05");
    assert.equal(noteFromTemplate(tpl("{{today}}"), {}, { ...env, now: new Date(2026, 11, 31, 23, 59) }).text, "2026-12-31");
  });
  it("{{date:today}} and {{date:key}} default to YYYY-MM-DD; formats and [literal] text", () => {
    assert.equal(made("{{date:today}}"), "2026-10-19");
    assert.equal(made("{{date:d}}", { d: "2026-03-07" }), "2026-03-07");
    assert.equal(made("{{date:today|dddd D MMMM YYYY}}"), "Monday 19 October 2026");
    assert.equal(made("{{date:d|ddd, D MMM YY (M/D)}}", { d: "2026-03-07" }), "Sat, 7 Mar 26 (3/7)");
    assert.equal(made("{{date:today|[Week of] D MMM}}"), "Week of 19 Oct");
    assert.equal(made("{{date:today|DD.MM.YYYY}}"), "19.10.2026");
    assert.equal(made("{{date:d+1d|[Week of] D MMM}}", { d: "2026-12-31" }), "Week of 1 Jan");
  });
  it("adds and takes days across a month, a year and a leap day", () => {
    assert.equal(made("{{date:today+7d}}"), "2026-10-26");
    assert.equal(made("{{date:today+13d}}"), "2026-11-01");
    assert.equal(made("{{date:d+1d}}", { d: "2026-12-31" }), "2027-01-01");
    assert.equal(made("{{date:d+1d}}", { d: "2028-02-28" }), "2028-02-29");
    assert.equal(made("{{date:d+1d}}", { d: "2026-02-28" }), "2026-03-01");
    assert.equal(made("{{date:d-1d}}", { d: "2026-03-01" }), "2026-02-28");
    assert.equal(made("{{date:d-30d|YYYY-MM-DD}}", { d: "2026-01-15" }), "2025-12-16");
  });
  it("an empty answer gives nothing, a time after the day is ignored", () => {
    assert.equal(made("[{{date:d}}]", { d: "" }), "[]");
    assert.equal(made("[{{date:d+1d|D}}]", { d: "  " }), "[]");
    assert.equal(made("{{date:d}}", { d: "2026-03-07T09:30:00" }), "2026-03-07");
    assert.equal(made("{{date:d}}", { d: "2026-03-07 09:30" }), "2026-03-07");
  });
  it("a bad date is an error that names the token and the text, nothing is made", () => {
    for (const bad of ["tomorrow", "2026-02-30", "2026-13-01", "26-03-07", "2026-3-7", "0050-01-01", "7 March"]) fails("{{date:d}}", { d: bad }, new RegExp(`is not a date.*YYYY-MM-DD`), "");
    assert.throws(() => made("{{date:d}}", { d: "soon" }), /\{\{date:d\}\}: "soon" is not a date/);
  });
  it("a malformed token or an unknown field is an error", () => {
    assert.throws(() => made("{{date:}}"), /Unknown token/);
    assert.throws(() => made("{{date:d+x}}", { d: "2026-03-07" }), /Unknown token/);
    assert.throws(() => made("{{date:today|}}"), /Unknown token/);
    assert.throws(() => made("{{date:nope}}", { d: "2026-03-07" }), /"nope", which is not a field/);
  });
  it("a field called today wins over the token; date:today then reads that field", () => {
    assert.equal(made("{{today}}|{{date:today|D}}", { today: "2026-05-06" }), "2026-05-06|6");
  });
  it("works in a snippet (no note template) with the real clock or env.now", () => {
    const e = emptyEnv({ now: NOW });
    assert.equal(fillTemplate("{{today}} {{date:today+1d|D MMM}}", {}, e), "2026-10-19 20 Oct");
    assert.match(fillTemplate("{{today}}", {}, emptyEnv()), /^\d{4}-\d{2}-\d{2}$/);
  });
  it("inside a loop the loop variable can be the date", () => {
    assert.equal(made("{{#each ds as d}}{{date:d+1d|D}} {{/each}}", { ds: "2026-03-01, 2026-03-31" }), "2 1 ");
  });
});

describe("{{yaml:key}}", () => {
  it("is the plain text when it is safe as a property value (letters, digits, space, dot, dash)", () => {
    for (const v of ["Planned", "Started", "In progress", "Plan 2.1", "re-run"]) assert.equal(made("Status: {{yaml:s}}", { s: v }), `Status: ${v}`);
  });
  it("is a JSON string for anything else, and for an empty answer", () => {
    assert.equal(made("Status: {{yaml:s}}", { s: "Needs: review" }), 'Status: "Needs: review"');
    assert.equal(made("Status: {{yaml:s}}", { s: 'say "hi"' }), 'Status: "say \\"hi\\""');
    assert.equal(made("Status: {{yaml:s}}", { s: "a\nb" }), 'Status: "a\\nb"');
    assert.equal(made("Status: {{yaml:s}}", { s: "Étude" }), 'Status: "Étude"');
    assert.equal(made("Status: {{yaml:s}}", { s: "  " }), 'Status: ""');
  });
  it("works on a loop variable and on an unknown field (error)", () => {
    assert.equal(made("{{#each xs as x}}{{yaml:x}};{{/each}}", { xs: "a b, c:d" }), 'a b;"c:d";');
    assert.throws(() => made("{{yaml:nope}}", { a: "1" }), /"nope", which is not a field/);
  });
});

describe("{{json:key}}", () => {
  it("quotes and escapes quotes, backslashes and line breaks so the value stays one YAML / JSON string", () => {
    const v = 'He said "hi"\nand\\left\tnow';
    assert.equal(made("w: {{json:w}}", { w: v }), `w: ${JSON.stringify(v.trim())}`);
    assert.equal(made("w: {{json:w}}", { w: v }), 'w: "He said \\"hi\\"\\nand\\\\left\\tnow"');
    assert.equal(JSON.parse(made("{{json:w}}", { w: v })), v);
  });
  it("an empty answer is the empty string, \"\", not nothing (the series template's template: and deck lines)", () => {
    assert.equal(made("template: {{json:t}}", { t: "" }), 'template: ""');
    assert.equal(made("template: {{json:t}}", { t: "   \n " }), 'template: ""');
  });
  it("keeps non-ASCII text and braces as written; the answer is never read as a token", () => {
    assert.equal(made("{{json:w}}", { w: "Möller {{x}} é" }), '"Möller {{x}} é"');
  });
  it("works on a loop variable and on an unknown field (error)", () => {
    assert.equal(made("{{#each xs as x}}{{json:x}};{{/each}}", { xs: 'a"b, c' }), '"a\\"b";"c";');
    assert.throws(() => made("{{json:nope}}", { a: "1" }), /"nope", which is not a field/);
  });
});

describe('{{#if key != ""}}', () => {
  it("is true for any non-empty answer, also one of only commas or line breaks (the old {{#if}} read that as empty)", () => {
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: "x" }), "yes");
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: "," }), "yes");
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: "a\nb" }), "yes");
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: "0" }), "yes");
  });
  it("is false for an empty answer or only spaces, and for a field that is missing from the answers", () => {
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: "" }), "no");
    assert.equal(made('{{#if a != ""}}yes{{else}}no{{/if}}', { a: " \t " }), "no");
    assert.equal(noteFromTemplate(tpl('{{#if a != ""}}yes{{else}}no{{/if}}', "", ["a"]), {}, env).text, "no");
  });
  it("whitespace around != is free; a block alone on its line takes its line; an unknown field is an error; != with text is not a token", () => {
    assert.equal(made('a\n{{#if a!=""}}\nb\n{{/if}}\nc', { a: "1" }), "a\nb\nc");
    assert.equal(made('a\n{{#if a   !=   ""}}\nb\n{{/if}}\nc', { a: "" }), "a\nc");
    assert.throws(() => made('{{#if zzz != ""}}x{{/if}}', { a: "1" }), /"zzz", which is not a field/);
    assert.throws(() => made('{{#if a != "x"}}x{{/if}}', { a: "1" }), /Unknown block/);
  });
  it("the older forms are unchanged: {{#if a}} still reads a list", () => {
    assert.equal(made("{{#if a}}yes{{else}}no{{/if}}", { a: "," }), "no");
    assert.equal(made('{{#if a ^= "h"}}yes{{else}}no{{/if}}', { a: "Hello" }), "yes");
  });
});

describe("{{note-name}} and {{folder}}", () => {
  it("the body sees the name and folder the header made", () => {
    const t = tpl("# {{note-name}}\nin {{folder}}\nFROM \"{{folder}}\"\n", 'name: "{{date:d}} {{series}}"\nfolder: "Meetings/{{series}}"\n', ["d", "series"]);
    const r = noteFromTemplate(t, { d: "2026-03-07", series: "Group" }, env);
    assert.deepEqual(r, { name: "2026-03-07 Group", folder: "Meetings/Group", text: '# 2026-03-07 Group\nin Meetings/Group\nFROM "Meetings/Group"\n' });
  });
  it("no folder in the header: the folder where the note is made (env.folder), else empty; no name: empty", () => {
    const t = tpl("[{{note-name}}] [{{folder}}]");
    assert.deepEqual(noteFromTemplate(t, {}, { ...env, folder: "00 Planning/To-dos" }), { name: "", folder: "00 Planning/To-dos", text: "[] [00 Planning/To-dos]" });
    assert.equal(noteFromTemplate(t, {}, env).folder, "");
  });
  it("not usable in the header's own name or folder, nor in a snippet (no note to ask)", () => {
    assert.throws(() => noteFromTemplate(tpl("x", 'name: "{{note-name}}"\n'), {}, env), /only works in a note template/);
    assert.throws(() => noteFromTemplate(tpl("x", 'folder: "{{folder}}"\n'), {}, env), /only works in a note template/);
    assert.throws(() => fillTemplate("{{note-name}}", {}, emptyEnv()), /only works in a note template/);
    assert.throws(() => fillTemplate("{{folder}}", {}, emptyEnv()), /only works in a note template/);
  });
  it("a field of that name wins, so an older snippet keeps working", () => {
    assert.equal(fillTemplate("{{folder}}/{{note-name}}", { folder: "A", "note-name": "B" }, emptyEnv()), "A/B");
  });
});

describe("noteFromTemplate", () => {
  it("keeps the note's own front matter below the header byte for byte (Q5 a)", () => {
    const body = `---\nkind: x\ncssclasses:\n  - vt\n---\n\n${F}vault-card\nshow: y\n${F}\n`;
    assert.equal(made(body), body);
  });
  it("a field left out of the answers has its default; an answer for no field is still usable", () => {
    const t = `---\nmake: note\nfields:\n  - key: a\n    label: A\n    value: "{{today}}"\n  - key: b\n    label: B\n---\n{{a}}|{{b}}|{{c}}`;
    assert.equal(noteFromTemplate(t, { c: "extra" }, env).text, "2026-10-19||extra");
  });
  it("is an error for a snippet, a file with no header, a required field left empty and an {{#append}} part", () => {
    assert.throws(() => noteFromTemplate("---\nfields:\n  - key: a\n    label: A\n---\n{{a}}", { a: "1" }, env), /not a note template/);
    assert.throws(() => noteFromTemplate("just text", {}, env), /not a note template/);
    assert.throws(() => noteFromTemplate(tpl("x", "required: a\n", ["a"]), { a: " " }, env), /Nothing to make: "a" is empty/);
    assert.equal(noteFromTemplate(tpl("x", "required: a\n", ["a"]), { a: "1" }, env).text, "x");
    assert.throws(() => made('{{#append "# H"}}x{{/append}}'), /does not work in a note template/);
  });
  it("an unknown token or an unclosed block throws before anything is returned", () => {
    assert.throws(() => made("{{nope}}"), TemplateError);
    assert.throws(() => made("{{#if a}}x", { a: "1" }), /never closed/);
  });
  it("uses the vault lookups it is given (another note's property)", () => {
    const e: NoteEnv = { ...env, vault: { noteText: (n, p) => (n === "Alpha" && p === "Owner" ? "Sam" : "") } };
    assert.equal(noteFromTemplate(tpl("{{note-prop:p.Owner}}", "", ["p"]), { p: "Alpha" }, e).text, "Sam");
  });
  it("a meeting-style template: a date from the answer for the name, a project block with an else, the first-series flag from the caller", () => {
    const t = tpl(`---\nseries: "[[{{series}}]]"\ndate: {{date:date}}\nsince: {{since}}\n{{#if project != ""}}\nproject:\n  - "[[{{project}}]]"\n{{else}}\nproject:\n{{/if}}\n---\n> WHERE meeting = link("{{series}}"){{#if first != ""}} OR meeting = true{{/if}}\n`,
      'name: "{{date:date}} {{title|series}}"\nfolder: "{{base}}/{{series}}"\n', ["date", "series", "title", "since", "project", "first", "base"]);
    const a = { date: "2026-10-26", series: "Group", title: "", since: "2026-10-19", project: "", first: "1", base: "Meetings" };
    const r = noteFromTemplate(t, a, env);
    assert.equal(r.name, "2026-10-26 Group");
    assert.equal(r.folder, "Meetings/Group");
    assert.equal(r.text, '---\nseries: "[[Group]]"\ndate: 2026-10-26\nsince: 2026-10-19\nproject:\n---\n> WHERE meeting = link("Group") OR meeting = true\n');
    const r2 = noteFromTemplate(t, { ...a, title: "Kick-off", project: "Alpha", first: "" }, env);
    assert.equal(r2.name, "2026-10-26 Kick-off");
    assert.equal(r2.text, '---\nseries: "[[Group]]"\ndate: 2026-10-26\nsince: 2026-10-19\nproject:\n  - "[[Alpha]]"\n---\n> WHERE meeting = link("Group")\n');
  });
});

/* ---------- the spike's To-do cases, through the kit's token-format To-do.md (Phase 3; the Templater version is tests/fixtures/templates/old/To-do.md) ---------- */

const TODO_FIXTURE = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
const TODAY = new Date(2026, 9, 19);   // Mon 2026-10-19, local
const base: TodoAnswer = { text: "Buy vials", project: "", meeting: "", due: "", priority: "", experiment: "", waiting: "" };

/** Each optional line is there only when its value is. Written out by hand from To-do.md (as tests/todo-note.test.ts does). */
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

/** What the caller hands over: the day is worked out by the plugin (startDate), everything else is the entry window's text. */
const todoAnswers = (a: TodoAnswer, day: string | undefined, today: Date, after = ""): Record<string, string> => ({
  scheduled: startDate(a.scheduled ?? day, today), project: a.project || "", due: a.due || "", priority: String(a.priority), after,
  meeting: a.meeting || "", experiment: a.experiment || "", waiting: String(a.waiting ?? ""),
});
const todoVia = (a: TodoAnswer, day: string | undefined, today: Date, after = ""): string => noteFromTemplate(TODO_FIXTURE, todoAnswers(a, day, today, after), { ...env, now: today }).text;

interface TodoCase { name: string; a: TodoAnswer; day?: string; today?: Date; after?: string; exp: Parameters<typeof expected>[0] }
const TODO_CASES: TodoCase[] = [
  { name: "nothing set", a: base, exp: {} },
  { name: "project and due", a: { ...base, project: "Alpha", due: "2026-10-23" }, exp: { project: "Alpha", due: "2026-10-23" } },
  { name: "project and comes-after", a: { ...base, project: "Alpha" }, after: "Order solvent", exp: { project: "Alpha", after: "Order solvent" } },
  { name: "meeting", a: { ...base, meeting: "Group meeting" }, exp: { meeting: "Group meeting" } },
  { name: "due and priority", a: { ...base, due: "2026-10-23", priority: 2 }, exp: { due: "2026-10-23", priority: 2 } },
  { name: "experiment", a: { ...base, experiment: "ABC0014" }, exp: { experiment: "ABC0014" } },
  { name: "waiting, written as a JSON string", a: { ...base, waiting: "  supplier's \"quote\"  " }, exp: { waiting: JSON.stringify("supplier's \"quote\"") } },
  { name: "waiting with a line break", a: { ...base, waiting: "line 1\nline 2" }, exp: { waiting: JSON.stringify("line 1\nline 2") } },
  { name: "board column Wed", a: base, day: "Wed", exp: { scheduled: "2026-10-21" } },
  { name: "board column Mon (today counts)", a: base, day: "Mon", exp: { scheduled: "2026-10-19" } },
  { name: "board column Wed on a Thursday", a: base, day: "Wed", today: new Date(2026, 9, 22), exp: { scheduled: "2026-10-28" } },
  { name: "board column is a date", a: base, day: "2026-10-23", exp: { scheduled: "2026-10-23" } },
  { name: "board column Fri with spaces", a: base, day: " Fri ", exp: { scheduled: "2026-10-23" } },
  { name: "Day chip over no column", a: { ...base, scheduled: "2026-10-27" }, exp: { scheduled: "2026-10-27" } },
  { name: "Day chip over a column", a: { ...base, scheduled: "2026-10-27" }, day: "Wed", exp: { scheduled: "2026-10-27" } },
  { name: "empty Day chip is the Backlog", a: { ...base, scheduled: "" }, day: "2026-10-22", exp: {} },
  { name: "everything set", a: { text: "x", project: "Alpha", meeting: "Group meeting", due: "2026-11-01", priority: 1, experiment: "ABC0014", waiting: "reply" }, day: "Mon", after: "Other",
    exp: { scheduled: "2026-10-19", project: "Alpha", due: "2026-11-01", priority: 1, after: "Other", meeting: "Group meeting", experiment: "ABC0014", waiting: '"reply"' } },
];

describe("To-do.md as a token-format note template = the spike's text, byte for byte", () => {
  for (const c of TODO_CASES) {
    it(c.name, () => {
      const got = todoVia(c.a, c.day, c.today ?? TODAY, c.after);
      assert.equal(got, expected(c.exp));
    });
  }
  it("a day that is not a weekday or date (Done, Backlog, a typo, 2026-02-30, empty) is the Backlog", () => {
    for (const v of ["Done", "Backlog", "Teusday", "2026-02-30", ""]) assert.equal(todoVia(base, v, TODAY), expected({}), v);
  });
  it("the text of a value is never read as a token", () => {
    assert.ok(todoVia({ ...base, project: "A {{day}} B" }, undefined, TODAY).includes('project: "[[A {{day}} B]]"'));
  });
  it("a project of only a comma is written (the spike's {{#if x}} read it as empty)", () => {
    assert.ok(todoVia({ ...base, project: "," }, undefined, TODAY).includes('project: "[[,]]"'));
  });
  it("has no name or folder of its own: the caller names the note (todoFileName)", () => {
    const r = noteFromTemplate(TODO_FIXTURE, todoAnswers(base, undefined, TODAY), { ...env, folder: "00 Planning/To-dos" });
    assert.equal(r.name, "");
    assert.equal(r.folder, "00 Planning/To-dos");
  });
});
