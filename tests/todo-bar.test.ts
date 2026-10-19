// The to-do chip bar: which chips show and what each one writes (src/planning/todo-bar.ts).
import { describe, it, expect } from "vitest";
import { todoChips, setProject, setMeeting, setDue, setPriority, setExperiment, setWaiting, applyTodoValue, todoFields, todoValues, readDueText, readDayText, setScheduled, experimentOptions } from "../src/planning/todo-bar";

const NOW = new Date(2026, 9, 7);
const vals = (fm: Record<string, unknown>) => todoChips(fm).map(c => `${c.key}=${c.value}`);

describe("todoChips", () => {
  it("a bare to-do has five empty chips", () => {
    expect(vals({ kind: "todo", project: null, meeting: false, due: null, priority: null })).toEqual(["project=", "meeting=", "due=", "scheduled=", "priority=", "experiment=", "waiting="]);
    expect(vals({})).toEqual(["project=", "meeting=", "due=", "scheduled=", "priority=", "experiment=", "waiting="]);
  });
  it("shows links by name, the date and the priority (no Countdown chip: that is one setting for all to-dos)", () => {
    expect(vals({ project: "[[Polymer A]]", meeting: "[[Group meeting|GM]]", due: "2026-11-15", priority: 2, countdown: true, experiment: "[[ABC0014-A]]" }))
      .toEqual(["project=Polymer A", "meeting=Group meeting", "due=2026-11-15", "scheduled=", "priority=2 medium", "experiment=ABC0014-A", "waiting="]);
    expect(vals({ project: "[[02 Projects/Alpha/Alpha]]" })[0]).toBe("project=Alpha");
  });
  it("a priority outside 1-3, or text, counts as none", () => {
    expect(vals({ priority: 7 })[4]).toBe("priority=");
    expect(vals({ priority: "high" })[4]).toBe("priority=");
  });
});

describe("the waiting chip", () => {
  it("writes the text, and clearing removes the line (a new to-do has none)", () => {
    const fm: Record<string, unknown> = { kind: "todo" };
    applyTodoValue(fm, "waiting", "  instrument booking ");
    expect(fm.waiting).toBe("instrument booking");
    applyTodoValue(fm, "waiting", "");
    expect("waiting" in fm).toBe(false);
    setWaiting(fm, "Dr Smith");
    setWaiting(fm, null);
    expect("waiting" in fm).toBe(false);
  });
  it("shows the text on the chip, and a number or list is not a waiting text", () => {
    expect(vals({ waiting: "samples from Leeds" })[6]).toBe("waiting=samples from Leeds");
    expect(vals({ waiting: 3 })[6]).toBe("waiting=");
    expect(vals({ waiting: ["a"] })[6]).toBe("waiting=");
    expect(todoValues({ waiting: "samples" }).waiting).toBe("samples");
  });
  it("is a text chip after Experiment, with or without the experiment list", () => {
    expect(todoFields([], []).map(f => f.key)).toEqual(["project", "meeting", "due", "scheduled", "priority", "waiting"]);
    expect(todoFields([], [], []).map(f => f.key)).toEqual(["project", "meeting", "due", "scheduled", "priority", "experiment", "waiting"]);
    expect(todoFields([], []).find(f => f.key === "waiting")).toMatchObject({ kind: "text", name: "Waiting" });
  });
});

describe("the experiment chip", () => {
  it("writes a link, and clearing removes the line (a new to-do has none)", () => {
    const fm: Record<string, unknown> = {};
    setExperiment(fm, "ABC0014-A");
    expect(fm).toEqual({ experiment: "[[ABC0014-A]]" });
    setExperiment(fm, null);
    expect("experiment" in fm).toBe(false);
  });
  it("lists Started, Processing results, the rest, Closed last (name Z to A inside a group), with the Status in the label", () => {
    const n = (name: string, Status?: string) => ({ name, fm: Status ? { Status } : {} });
    const opts = experimentOptions([n("ABC0001-A", "Closed"), n("ABC0002-A", "Planned"), n("ABC0003-A", "Started"), n("ABC0004-A", "Processing results"), n("ABC0005-A", "Started"), n("ABC0006-A")]);
    expect(opts.map(o => o.value)).toEqual(["ABC0005-A", "ABC0003-A", "ABC0004-A", "ABC0006-A", "ABC0002-A", "ABC0001-A"]);
    expect(opts[0].label).toBe("ABC0005-A \u00b7 Started");
    expect(opts[3].label).toBe("ABC0006-A");
  });
});

describe("the writes", () => {
  it("project and meeting are links; emptied they match the To-do template", () => {
    const fm: Record<string, unknown> = {};
    setProject(fm, "Polymer A"); setMeeting(fm, "Group meeting");
    expect(fm).toEqual({ project: "[[Polymer A]]", meeting: "[[Group meeting]]" });
    setProject(fm, null); setMeeting(fm, null);
    expect(fm).toEqual({ project: null, meeting: false });
  });
  it("due sets a date or clears it", () => {
    const fm: Record<string, unknown> = {};
    setDue(fm, "2026-11-15");
    expect(fm).toEqual({ due: "2026-11-15" });
    setDue(fm, null);
    expect(fm).toEqual({ due: null });
  });
  it("priority is a number or empty", () => {
    const fm: Record<string, unknown> = {};
    setPriority(fm, 1);
    expect(fm).toEqual({ priority: 1 });
    setPriority(fm, null);
    expect(fm.priority).toBeNull();
  });
});

describe("readDueText", () => {
  it("empty clears, words and dates set, nonsense is refused", () => {
    expect(readDueText("  ", NOW)).toEqual({ date: null });
    expect(readDueText("fri", NOW)).toEqual({ date: "2026-10-09" });
    expect(readDueText("15/11", NOW)).toEqual({ date: "2026-11-15" });
    expect(readDueText("soon", NOW)).toBeNull();
  });
});

import { projectNames } from "../src/planning/todo-bar";
describe("projectNames", () => {
  it("by name, Done projects at the bottom (also by name)", () => {
    const hub = (name: string, Status?: string) => ({ name, fm: Status ? { Status } : {} });
    expect(projectNames([hub("Zeta"), hub("Alpha", "Done"), hub("Mid", "Paused"), hub("Beta", "done"), hub("Able", "Active")])).toEqual(["Able", "Mid", "Zeta", "Alpha", "Beta"]);
  });
});

describe("the Day chip (I2 Phase 5, Mon 19 Oct)", () => {
  const MON = new Date(2026, 9, 19, 9);
  it("sits after Due, shows the planned date, and is empty for a Backlog or old-style note", () => {
    expect(todoFields([], []).map(f => f.key).slice(2, 4)).toEqual(["due", "scheduled"]);
    expect(todoFields([], []).find(f => f.key === "scheduled")).toMatchObject({ kind: "date", day: true, name: "Day", prompt: "Which day? (tue, next tue, 27 oct; backlog clears)" });
    expect(todoValues({ scheduled: "2026-10-27" }).scheduled).toBe("2026-10-27");
    expect(todoValues({ day: "Thu" }).scheduled).toBe("");
    expect(todoValues({ scheduled: "soon" }).scheduled).toBe("");
  });
  it("readDayText: words, backlog and empty clear, a past day is refused, nonsense is null", () => {
    expect(readDayText("next tue", MON)).toEqual({ date: "2026-10-27" });
    expect(readDayText("tue", MON)).toEqual({ date: "2026-10-20" });
    expect(readDayText("mon", MON)).toEqual({ date: "2026-10-19" });
    expect(readDayText("  Backlog ", MON)).toEqual({ date: null });
    expect(readDayText("", MON)).toEqual({ date: null });
    expect(readDayText("2026-10-14", MON)).toEqual({ past: "2026-10-14" });
    expect(readDayText("soon", MON)).toBeNull();
  });
  it("the chip writes scheduled only: no other key appears, an empty value removes it", () => {
    const fm: Record<string, unknown> = { kind: "todo", done: false, project: "[[A]]" };
    setScheduled(fm, "2026-10-22", MON);
    expect(fm).toEqual({ kind: "todo", done: false, project: "[[A]]", scheduled: "2026-10-22" });
    applyTodoValue(fm, "scheduled", "");
    expect(fm).toEqual({ kind: "todo", done: false, project: "[[A]]" });
  });
  it("on an old-style note the old day / planned / rolled keys go with it, as a board drop does; a past day writes nothing", () => {
    const fm: Record<string, unknown> = { kind: "todo", day: "Wed", planned: "2026-10-14", rolled: true };
    setScheduled(fm, "2026-10-22", MON);
    expect(fm).toEqual({ kind: "todo", scheduled: "2026-10-22" });
    setScheduled(fm, "2026-10-14", MON);
    expect(fm.scheduled).toBe("2026-10-22");
  });
});
