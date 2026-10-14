// The to-do chip bar: which chips show and what each one writes (src/planning/todo-bar.ts).
import { describe, it, expect } from "vitest";
import { todoChips, setProject, setMeeting, setDue, setPriority, setCountdown, readDueText } from "../src/planning/todo-bar";

const NOW = new Date(2026, 9, 7);
const vals = (fm: Record<string, unknown>) => todoChips(fm).map(c => `${c.key}=${c.value}`);

describe("todoChips", () => {
  it("a bare to-do has four empty chips; no Countdown without a due date", () => {
    expect(vals({ kind: "todo", project: null, meeting: false, due: null, priority: null })).toEqual(["project=", "meeting=", "due=", "priority="]);
    expect(vals({})).toEqual(["project=", "meeting=", "due=", "priority="]);
  });
  it("shows links by name, the date, the priority and Countdown once a due date is set", () => {
    expect(vals({ project: "[[Polymer A]]", meeting: "[[Group meeting|GM]]", due: "2026-11-15", priority: 2, countdown: true }))
      .toEqual(["project=Polymer A", "meeting=Group meeting", "due=2026-11-15", "priority=2 medium", "countdown=on"]);
    expect(vals({ due: "2026-11-15", countdown: false }).at(-1)).toBe("countdown=");
    expect(vals({ project: "[[02 Projects/Alpha/Alpha]]" })[0]).toBe("project=Alpha");
  });
  it("a priority outside 1-3, or text, counts as none", () => {
    expect(vals({ priority: 7 })[3]).toBe("priority=");
    expect(vals({ priority: "high" })[3]).toBe("priority=");
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
  it("due sets a date; clearing it also turns the countdown off", () => {
    const fm: Record<string, unknown> = { countdown: true };
    setDue(fm, "2026-11-15");
    expect(fm).toEqual({ due: "2026-11-15", countdown: true });
    setDue(fm, null);
    expect(fm).toEqual({ due: null, countdown: false });
  });
  it("priority is a number or empty; countdown a boolean", () => {
    const fm: Record<string, unknown> = {};
    setPriority(fm, 1); setCountdown(fm, true);
    expect(fm).toEqual({ priority: 1, countdown: true });
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
