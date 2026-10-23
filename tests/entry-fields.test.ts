// The entry window's fields (src/planning/entry-fields.ts): what the chips show, which are visible, what is handed over.
import { describe, it, expect } from "vitest";
import { chipView, entryResult, setEntryValue, visibleFields } from "../src/planning/entry-fields";
import { todoFields, todoValues, applyTodoValue } from "../src/planning/todo-bar";

const fields = todoFields(["Alpha", "Beta"], ["Group meeting"]);
const keys = (v: Record<string, string | number | boolean>) => visibleFields(fields, v).map(f => f.key);

describe("entry fields", () => {
  it("the to-do fields are Project, Meeting, Due and Priority, and Experiment once there is a list of lab notes", () => {
    expect(keys({})).toEqual(["project", "meeting", "due", "scheduled", "priority", "waiting"]);
    expect(todoFields([], [], [{ label: "ABC0014-A", value: "ABC0014-A" }]).map(f => f.key)).toEqual(["project", "meeting", "due", "scheduled", "priority", "experiment", "waiting"]);
  });
  it("a field with showWhen is visible only once the field it names has a value", () => {
    const extra = [...fields, { key: "flag", name: "Flag", icon: "flag", kind: "toggle" as const, prompt: "", showWhen: "due" }];
    expect(visibleFields(extra, {}).map(f => f.key)).not.toContain("flag");
    expect(visibleFields(extra, { due: "2026-11-15" }).map(f => f.key)).toContain("flag");
  });
  it("showValue: a field with showWhen and showValue is visible only while that field equals the value", () => {
    const extra = [{ key: "a", name: "A", icon: "x", kind: "pick" as const, prompt: "" }, { key: "b", name: "B", icon: "x", kind: "text" as const, prompt: "", showWhen: "a", showValue: "yes" }];
    expect(visibleFields(extra, { a: "no" }).map(f => f.key)).toEqual(["a"]);
    expect(visibleFields(extra, { a: "yes" }).map(f => f.key)).toEqual(["a", "b"]);
  });
  it("chips: empty ones say + name, set ones their label, the toggle on / off", () => {
    const f = (k: string) => fields.find(x => x.key === k)!;
    expect(chipView(f("project"), "")).toEqual({ text: "+ Project", set: false });
    expect(chipView(f("project"), "Alpha")).toEqual({ text: "Alpha", set: true });
    expect(chipView(f("priority"), 1)).toEqual({ text: "1 high", set: true });
    expect(chipView(f("priority"), "")).toEqual({ text: "+ Priority", set: false });
    expect(chipView(f("due"), "2026-11-15")).toEqual({ text: "15-11-2026", set: true });   // DD-MM-YYYY on the chip
    expect(chipView({ key: "t", name: "Countdown", icon: "x", kind: "toggle", prompt: "" }, true)).toEqual({ text: "Countdown on", set: true });
  });
  it("clearing a field clears the ones that need it; the result keeps only visible, set values", () => {
    const extra = [...fields, { key: "flag", name: "Flag", icon: "flag", kind: "toggle" as const, prompt: "", showWhen: "due" }];
    let v = setEntryValue(extra, {}, "due", "2026-11-15");
    v = setEntryValue(extra, v, "flag", true);
    v = setEntryValue(extra, v, "project", "Alpha");
    expect(entryResult(extra, v)).toEqual({ project: "Alpha", due: "2026-11-15", flag: true });
    v = setEntryValue(extra, v, "due", "");
    expect(v.flag).toBeUndefined();
    expect(entryResult(extra, v)).toEqual({ project: "Alpha" });
    expect(entryResult(fields, {})).toEqual({});
  });
  it("the Day chip reads Tue 27 Oct once set, + Day when empty", () => {
    const day = fields.find(f => f.key === "scheduled")!;
    expect(chipView(day, "")).toEqual({ text: "+ Day", set: false });
    expect(chipView(day, "2026-10-27")).toEqual({ text: "Tue 27 Oct", set: true });
  });
  it("a to-do's properties as values and back", () => {
    const fm = { project: "[[Alpha]]", meeting: false, due: "2026-11-15", priority: 2, experiment: "[[ABC0014-A]]" };
    expect(todoValues(fm)).toEqual({ project: "Alpha", meeting: "", due: "2026-11-15", scheduled: "", priority: 2, experiment: "ABC0014-A", waiting: "" });
    const out: Record<string, unknown> = {};
    applyTodoValue(out, "project", "Beta"); applyTodoValue(out, "priority", ""); applyTodoValue(out, "due", "2026-12-01");
    expect(out).toEqual({ project: "[[Beta]]", priority: null, due: "2026-12-01" });
  });
});

import { missingRequired } from "../src/planning/entry-fields";
import { projectField } from "../src/planning/todo-bar";
import { readFileSync } from "node:fs";

describe("required fields (New project note, New one-off meeting)", () => {
  it("a required project has no (none) and Enter waits for it", () => {
    const f = projectField(["Alpha", "Beta"], true);
    expect(f.options?.map(o => o.label)).toEqual(["Alpha", "Beta"]);
    expect(missingRequired([f], {})?.key).toBe("project");
    expect(missingRequired([f], { project: "Alpha" })).toBeNull();
    expect(projectField(["Alpha"]).options?.[0].label).toBe("(none)");
    expect(missingRequired([projectField(["Alpha"])], {})).toBeNull();
  });
  it("the New project note template takes the window's answers as fields (title, folder, hub)", () => {
    const tpl = readFileSync("kits/planning/Extras/Templates/New project note.md", "utf8");
    expect(tpl.startsWith('---\nmake: note\nname: "{{title}}"\nfolder: "{{folder}}"\n')).toBe(true);
    expect(tpl).toContain("  - key: hub\n");
    expect(tpl).not.toContain("<%");
  });
});
