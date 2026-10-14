// The entry window's fields (src/planning/entry-fields.ts): what the chips show, which are visible, what is handed over.
import { describe, it, expect } from "vitest";
import { chipView, entryResult, setEntryValue, visibleFields } from "../src/planning/entry-fields";
import { todoFields, todoValues, applyTodoValue } from "../src/planning/todo-bar";

const fields = todoFields(["Alpha", "Beta"], ["Group meeting"]);
const keys = (v: Record<string, string | number | boolean>) => visibleFields(fields, v).map(f => f.key);

describe("entry fields", () => {
  it("Countdown shows only once Due has a value", () => {
    expect(keys({})).toEqual(["project", "meeting", "due", "priority"]);
    expect(keys({ due: "2026-11-15" })).toEqual(["project", "meeting", "due", "priority", "countdown"]);
  });
  it("chips: empty ones say + name, set ones their label, the toggle on / off", () => {
    const f = (k: string) => fields.find(x => x.key === k)!;
    expect(chipView(f("project"), "")).toEqual({ text: "+ Project", set: false });
    expect(chipView(f("project"), "Alpha")).toEqual({ text: "Alpha", set: true });
    expect(chipView(f("priority"), 1)).toEqual({ text: "1 high", set: true });
    expect(chipView(f("priority"), "")).toEqual({ text: "+ Priority", set: false });
    expect(chipView(f("due"), "2026-11-15")).toEqual({ text: "2026-11-15", set: true });
    expect(chipView(f("countdown"), true)).toEqual({ text: "Countdown on", set: true });
    expect(chipView(f("countdown"), undefined)).toEqual({ text: "Countdown off", set: false });
  });
  it("clearing Due clears Countdown with it; the result keeps only visible, set values", () => {
    let v = setEntryValue(fields, {}, "due", "2026-11-15");
    v = setEntryValue(fields, v, "countdown", true);
    v = setEntryValue(fields, v, "project", "Alpha");
    expect(entryResult(fields, v)).toEqual({ project: "Alpha", due: "2026-11-15", countdown: true });
    v = setEntryValue(fields, v, "due", "");
    expect(v.countdown).toBeUndefined();
    expect(entryResult(fields, v)).toEqual({ project: "Alpha" });
    expect(entryResult(fields, {})).toEqual({});
  });
  it("a to-do's properties as values and back", () => {
    const fm = { project: "[[Alpha]]", meeting: false, due: "2026-11-15", priority: 2, countdown: true };
    expect(todoValues(fm)).toEqual({ project: "Alpha", meeting: "", due: "2026-11-15", priority: 2, countdown: true });
    const out: Record<string, unknown> = {};
    applyTodoValue(out, "project", "Beta"); applyTodoValue(out, "priority", ""); applyTodoValue(out, "due", "2026-12-01");
    expect(out).toEqual({ project: "[[Beta]]", priority: null, due: "2026-12-01" });
  });
});
