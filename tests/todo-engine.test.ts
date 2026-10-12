// Phase 4a: the to-do board rules (src/planning/todo.ts), including the 2026-10-07 Obsidian Sync scenarios.
import { describe, it, expect } from "vitest";
import { applyPatch, cardDate, changePatch, dueCountdown, parseDay, rollOverPatch, snapOf, todayColumn, todayMark, weekStart, ymd, type TodoFm } from "../src/planning/todo";

const day = (s: string): Date => parseDay(s)!;
const WED = day("2026-10-07");   // a Wednesday
const SAT = day("2026-10-10");
const todo = (fm: Partial<TodoFm>): TodoFm => ({ kind: "todo", ...fm });
/** What the note looks like after a change and the engine's answer to it. */
const after = (fm: TodoFm, before: TodoFm, today = WED): Record<string, unknown> => {
  const out = { ...fm } as Record<string, unknown>;
  const p = changePatch(fm, snapOf(before), snapOf(fm), today);
  if (p) applyPatch(out, p);
  return out;
};

describe("dates", () => {
  it("parses strict days only, in local time", () => {
    expect(ymd(day("2026-10-07"))).toBe("2026-10-07");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-10-7")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
  it("today's column is the weekday, Mon at the weekend; the CSS mark is empty at the weekend", () => {
    expect(todayColumn(WED)).toBe("Wed");
    expect(todayColumn(SAT)).toBe("Mon");
    expect(todayMark(SAT)).toBe("");
    expect(ymd(weekStart(SAT))).toBe("2026-10-05");
    expect(ymd(weekStart(day("2026-10-05")))).toBe("2026-10-05");
  });
  it("a card's date is the first such weekday on or after it was planned", () => {
    expect(ymd(cardDate({ day: "Mon", planned: "2026-10-07" })!)).toBe("2026-10-12");
    expect(ymd(cardDate({ day: "Wed", planned: "2026-10-07" })!)).toBe("2026-10-07");
    expect(cardDate({ day: "Backlog", planned: "2026-10-07" })).toBeNull();
  });
});

describe("changes (Obsidian Sync safe)", () => {
  it("local tick: stamps done_on and clears rolled", () => {
    expect(after(todo({ day: "Wed", done: true, rolled: true }), todo({ day: "Wed", done: false, rolled: true }))).toMatchObject({ done_on: "2026-10-07", rolled: false });
  });
  it("synced tick (done_on already there, not rolled): nothing written", () => {
    expect(changePatch(todo({ day: "Wed", done: true, done_on: "2026-10-06", rolled: false }), { day: "Wed", done: false }, { day: "Wed", done: true }, WED)).toBeNull();
  });
  it("untick removes done_on; an untick without done_on writes nothing", () => {
    expect(after(todo({ day: "Wed", done: false, done_on: "2026-10-07" }), todo({ day: "Wed", done: true }))).not.toHaveProperty("done_on");
    expect(changePatch(todo({ day: "Wed", done: false }), { day: "Wed", done: true }, { day: "Wed", done: false }, WED)).toBeNull();
  });
  it("local drag: stamps planned today and clears rolled", () => {
    expect(after(todo({ day: "Fri", planned: "2026-10-05" }), todo({ day: "Mon", planned: "2026-10-05" }))).toMatchObject({ planned: "2026-10-07", rolled: false });
  });
  it("synced drag (planned already today, not carried over): nothing written", () => {
    expect(changePatch(todo({ day: "Fri", planned: "2026-10-07" }), { day: "Mon", done: false }, { day: "Fri", done: false }, WED)).toBeNull();
  });
  it("synced roll-over (planned today, rolled, in today's column): left alone, amber kept", () => {
    expect(changePatch(todo({ day: "Wed", planned: "2026-10-07", rolled: true }), { day: "Mon", done: false }, { day: "Wed", done: false }, WED)).toBeNull();
  });
  it("local drag of a carried-over card off today's column: rolled cleared", () => {
    expect(after(todo({ day: "Thu", planned: "2026-10-07", rolled: true }), todo({ day: "Wed", planned: "2026-10-07", rolled: true }))).toMatchObject({ planned: "2026-10-07", rolled: false });
  });
  it("a card seen for the first time, or a note that is not a to-do: nothing written", () => {
    expect(changePatch(todo({ day: "Wed", done: true }), undefined, { day: "Wed", done: true }, WED)).toBeNull();
    expect(changePatch({ kind: "note", day: "Wed", done: true }, { day: "Wed", done: false }, { day: "Wed", done: true }, WED)).toBeNull();
  });
  it("no change in day or done (another property edited): nothing written", () => {
    expect(changePatch(todo({ day: "Wed" }), { day: "Wed", done: false }, { day: "Wed", done: false }, WED)).toBeNull();
  });
});

describe("roll-over", () => {
  const mtime = day("2026-09-28");
  it("an unfinished Mon card on Wednesday moves to Wed, carried over", () => {
    expect(rollOverPatch(todo({ day: "Mon", planned: "2026-10-05" }), mtime, WED)).toMatchObject({ kind: "rolled", patch: { set: { day: "Wed", planned: "2026-10-07", rolled: true } }, snap: { day: "Wed", done: false } });
  });
  it("at the weekend it moves to Mon", () => {
    expect(rollOverPatch(todo({ day: "Fri", planned: "2026-10-05" }), mtime, SAT)?.patch.set.day).toBe("Mon");
  });
  it("today's and later cards, Backlog cards and other notes stay", () => {
    expect(rollOverPatch(todo({ day: "Wed", planned: "2026-10-05" }), mtime, WED)).toBeNull();
    expect(rollOverPatch(todo({ day: "Fri", planned: "2026-10-05" }), mtime, WED)).toBeNull();
    expect(rollOverPatch(todo({ day: "Backlog" }), mtime, WED)).toBeNull();
    expect(rollOverPatch({ kind: "note", day: "Mon" }, mtime, WED)).toBeNull();
  });
  it("a card without planned counts as planned this week: Mon rolls now, Fri just gets planned", () => {
    expect(rollOverPatch(todo({ day: "Mon" }), mtime, WED)?.kind).toBe("rolled");
    expect(rollOverPatch(todo({ day: "Fri" }), mtime, WED)).toEqual({ kind: "planned", patch: { set: { planned: "2026-10-05" }, remove: [] } });
  });
  it("done in an earlier week: leaves the board (day Done), done_on kept or taken from the note's last change", () => {
    expect(rollOverPatch(todo({ day: "Fri", done: true, done_on: "2026-10-02" }), mtime, WED)).toMatchObject({ kind: "cleared", patch: { set: { day: "Done" } } });
    expect(rollOverPatch(todo({ day: "Fri", done: true }), mtime, WED)?.patch.set).toEqual({ day: "Done", done_on: "2026-09-28" });
  });
  it("done this week stays on the board", () => {
    expect(rollOverPatch(todo({ day: "Mon", done: true, done_on: "2026-10-05" }), mtime, WED)).toBeNull();
  });
  it("an old Done card without the tick: ticked, done_on from its last change", () => {
    expect(rollOverPatch(todo({ day: "Done" }), mtime, WED)).toMatchObject({ kind: "ticked", patch: { set: { done: true, done_on: "2026-09-28", rolled: false } } });
  });
  it("a card due today, or later, stays; a second run after a roll-over changes nothing", () => {
    const fm = todo({ day: "Mon", planned: "2026-10-05" });
    const first = rollOverPatch(fm, mtime, WED)!;
    const rolled = { ...fm } as Record<string, unknown>; applyPatch(rolled, first.patch);
    expect(rollOverPatch(rolled, mtime, WED)).toBeNull();
    expect(rollOverPatch(todo({ day: "Mon", planned: "2026-10-12" }), mtime, WED)).toBeNull();
  });
  it("across a year end and a clock change the weekdays stay right", () => {
    expect(ymd(weekStart(day("2027-01-01")))).toBe("2026-12-28");
    expect(rollOverPatch(todo({ day: "Thu", planned: "2026-12-28" }), mtime, day("2027-01-04"))?.patch.set).toMatchObject({ day: "Mon", planned: "2027-01-04" });
    expect(ymd(cardDate({ day: "Mon", planned: "2026-10-24" })!)).toBe("2026-10-26");   // over the end of summer time in Europe
    expect(ymd(cardDate({ day: "Mon", planned: "2027-03-27" })!)).toBe("2027-03-29");   // over the start
  });
  it("planned that is not a strict day counts as missing", () => {
    expect(rollOverPatch(todo({ day: "Mon", planned: "2026-10-5" }), mtime, WED)?.kind).toBe("rolled");
    expect(rollOverPatch(todo({ day: "Fri", planned: 20261005 }), mtime, WED)?.kind).toBe("planned");
  });
  it("done with a done_on that is not a day: falls back to the note's last change", () => {
    expect(rollOverPatch(todo({ day: "Fri", done: true, done_on: "soon" }), mtime, WED)?.kind).toBe("cleared");
    expect(rollOverPatch(todo({ day: "Fri", done: true, done_on: "soon" }), WED, WED)).toBeNull();
  });
});

describe("changes: more cases", () => {
  it("ticked and dragged at once: the tick wins (done_on), planned is not stamped", () => {
    const p = changePatch(todo({ day: "Fri", done: true }), { day: "Mon", done: false }, { day: "Fri", done: true }, WED);
    expect(p).toEqual({ set: { done_on: "2026-10-07", rolled: false }, remove: [] });
  });
  it("tick with done_on already set and not carried over: nothing written", () => {
    expect(changePatch(todo({ day: "Wed", done: true, done_on: "2026-10-07", rolled: false }), { day: "Wed", done: false }, { day: "Wed", done: true }, WED)).toBeNull();
  });
});

describe("which devices roll over", () => {
  it("the per-device switch wins; unset = computers yes, phones and tablets no", async () => {
    const { rollsOnDevice } = await import("../src/planning/engine");
    expect(rollsOnDevice("on", true)).toBe(true);
    expect(rollsOnDevice("off", false)).toBe(false);
    expect(rollsOnDevice(null, false)).toBe(true);
    expect(rollsOnDevice(null, true)).toBe(false);
    expect(rollsOnDevice("maybe", false)).toBe(false);   // like the old template: any other stored value means off
  });
});

describe("due-date countdown", () => {
  const cd = (fm: Partial<TodoFm>, mode: "off" | "marked" | "all" = "all", now = WED) => dueCountdown(todo(fm), mode, now);
  it("counts whole days", () => {
    expect(cd({ due: "2026-10-07" })).toEqual({ text: "Today", level: "soon" });
    expect(cd({ due: "2026-10-08" })).toEqual({ text: "Tomorrow", level: "soon" });
    expect(cd({ due: "2026-10-09" })).toEqual({ text: "2d", level: "soon" });
    expect(cd({ due: "2026-10-12" })).toEqual({ text: "5d", level: "later" });
    expect(cd({ due: "2026-10-05" })).toEqual({ text: "2d late", level: "late" });
  });
  it("crosses a month end and the clock change", () => {
    expect(cd({ due: "2026-11-02" }, "all", day("2026-10-30"))?.text).toBe("3d");
    expect(cd({ due: "2026-10-26" }, "all", day("2026-10-24"))?.text).toBe("2d");   // Europe clocks go back 25 -> 26 Oct
    expect(cd({ due: "2026-03-30" }, "all", day("2026-03-27"))?.text).toBe("3d");   // and forward 29 Mar
  });
  it("ignores the time of day", () => {
    expect(cd({ due: "2026-10-08" }, "all", new Date(2026, 9, 7, 23, 59))?.text).toBe("Tomorrow");
  });
  it("shows nothing when off, done, unmarked or without a valid date", () => {
    expect(cd({ due: "2026-10-09" }, "off")).toBeNull();
    expect(cd({ due: "2026-10-09", done: true })).toBeNull();
    expect(cd({ due: "2026-10-09" }, "marked")).toBeNull();
    expect(cd({ due: "2026-10-09", countdown: false }, "marked")).toBeNull();
    expect(cd({ due: "2026-10-09", countdown: true }, "marked")?.text).toBe("2d");
    expect(cd({ due: "" })).toBeNull();
    expect(cd({ due: "2026-02-30" })).toBeNull();
    expect(cd({})).toBeNull();
  });
});

describe("To-do template due date and countdown", () => {
  it("asks for a due date (Esc cancels), offers the countdown only with a date, writes a boolean, sets due to a date property", async () => {
    const { readFileSync } = await import("fs");
    const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
    expect(tpl).toContain('d === null) { throw new Error("Cancelled');
    expect(tpl).toMatch(/if \(due\) \{[^}]*suggester/s);
    expect(tpl).toContain('c === null || c === undefined) { throw');
    expect(tpl).toMatch(/^due: <% due %>$/m);
    expect(tpl).toMatch(/^countdown: <% countdown %>$/m);
    expect(tpl).toContain("let countdown = false;");
    expect(tpl).toContain('setType?.("due", "date")');
  });
});
