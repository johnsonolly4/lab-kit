// The to-do chip bar: which chips show and what each one writes (src/planning/todo-bar.ts).
import { describe, it, expect } from "vitest";
import { todoChips, setProject, setMeeting, setDue, setPriority, setExperiment, readDueText, experimentOptions } from "../src/planning/todo-bar";

const NOW = new Date(2026, 9, 7);
const vals = (fm: Record<string, unknown>) => todoChips(fm).map(c => `${c.key}=${c.value}`);

describe("todoChips", () => {
  it("a bare to-do has five empty chips", () => {
    expect(vals({ kind: "todo", project: null, meeting: false, due: null, priority: null })).toEqual(["project=", "meeting=", "due=", "priority=", "experiment="]);
    expect(vals({})).toEqual(["project=", "meeting=", "due=", "priority=", "experiment="]);
  });
  it("shows links by name, the date and the priority (no Countdown chip: that is one setting for all to-dos)", () => {
    expect(vals({ project: "[[Polymer A]]", meeting: "[[Group meeting|GM]]", due: "2026-11-15", priority: 2, countdown: true, experiment: "[[ABC0014-A]]" }))
      .toEqual(["project=Polymer A", "meeting=Group meeting", "due=2026-11-15", "priority=2 medium", "experiment=ABC0014-A"]);
    expect(vals({ project: "[[02 Projects/Alpha/Alpha]]" })[0]).toBe("project=Alpha");
  });
  it("a priority outside 1-3, or text, counts as none", () => {
    expect(vals({ priority: 7 })[3]).toBe("priority=");
    expect(vals({ priority: "high" })[3]).toBe("priority=");
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
