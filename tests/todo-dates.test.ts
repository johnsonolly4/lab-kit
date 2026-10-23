// I2 Phase 1: the slim date model in src/planning/todo.ts (docs/plans/planned-dates.md: "Reading old notes", "What writes what", "Normalise on arrival").
import { describe, it, expect } from "vitest";
import { applyPatch, dateOf, dropPatch, isCarried, isFinishedTodo, normalisePatch, tickPatch, undoPatch, weekdayOf, ymd, type TodoFm } from "../src/planning/todo";

const WED = new Date(2026, 9, 21, 10);   // Wednesday 21 Oct 2026; this Monday is 19 Oct
const d = (s: string): Date => { const [y, m, n] = s.split("-").map(Number); return new Date(y, m - 1, n); };
const iso = (x: Date | null): string | null => (x ? ymd(x) : null);
const after = (fm: Record<string, unknown>, p: { set: Record<string, unknown>; remove: string[] } | null): Record<string, unknown> => { const x = { ...fm }; if (p) applyPatch(x, p); return x; };

describe("dateOf: scheduled first, old notes read through the old rule", () => {
  it("scheduled wins, whatever day says", () => {
    expect(iso(dateOf({ scheduled: "2026-10-27", day: "Mon" }, WED))).toBe("2026-10-27");
  });
  it("a scheduled value that is not a date: no date (tray), the old day is not read", () => {
    expect(dateOf({ scheduled: "next tue", day: "Mon" }, WED)).toBeNull();
    expect(dateOf({ scheduled: "2026-02-30" }, WED)).toBeNull();
  });
  it("an empty scheduled falls back to day", () => {
    expect(iso(dateOf({ scheduled: "", day: "Thu", planned: "2026-10-14" }, WED))).toBe("2026-10-15");
  });
  it("known answer: day Thu + planned 2026-10-14 → 2026-10-15", () => {
    expect(iso(dateOf({ day: "Thu", planned: "2026-10-14" }, WED))).toBe("2026-10-15");
  });
  it("Sat / Sun are read too (Q17 a): day Sat + planned 2026-10-14 → 2026-10-17", () => {
    expect(iso(dateOf({ day: "Sat", planned: "2026-10-14" }, WED))).toBe("2026-10-17");
    expect(iso(dateOf({ day: "Sun", planned: "2026-10-14" }, WED))).toBe("2026-10-18");
  });
  it("no planned: on or after this week's Monday (as the old roll-over read it)", () => {
    expect(iso(dateOf({ day: "Mon" }, WED))).toBe("2026-10-19");
    expect(iso(dateOf({ day: "Fri" }, WED))).toBe("2026-10-23");
  });
  it("Backlog, Done, a typo, lower case, empty: no date", () => {
    for (const day of ["Backlog", "Done", "Teusday", "mon", "", null]) expect(dateOf({ day }, WED)).toBeNull();
  });
  it("with scheduled set, two different nows give the same date (Sync: nothing depends on today)", () => {
    expect(iso(dateOf({ scheduled: "2026-10-22" }, WED))).toBe(iso(dateOf({ scheduled: "2026-10-22" }, new Date(2026, 10, 3))));
  });
  it("weekdayOf", () => {
    expect(["2026-10-19", "2026-10-24", "2026-10-25"].map(s => weekdayOf(d(s)))).toEqual(["Mon", "Sat", "Sun"]);
  });
});

describe("finished and carried over", () => {
  it("finished: ticked, or an old day: Done card", () => {
    expect(isFinishedTodo({ done: true })).toBe(true);
    expect(isFinishedTodo({ day: "Done", done: false })).toBe(true);
    expect(isFinishedTodo({ day: "Mon", done: false })).toBe(false);
  });
  it("carried over = open and dated before today; worked out, rolled is not read", () => {
    expect(isCarried({ scheduled: "2026-10-20" }, WED)).toBe(true);
    expect(isCarried({ scheduled: "2026-10-21" }, WED)).toBe(false);
    expect(isCarried({ scheduled: "2026-10-20", done: true }, WED)).toBe(false);
    expect(isCarried({ rolled: true }, WED)).toBe(false);
    expect(isCarried({ day: "Mon", planned: "2026-10-12" }, WED)).toBe(true);
  });
  it("Sunday 23:59 / Monday 00:01: a Friday card is carried on both; a Monday card only becomes today", () => {
    const sun = new Date(2026, 9, 25, 23, 59), mon = new Date(2026, 9, 26, 0, 1);
    expect(isCarried({ scheduled: "2026-10-23" }, sun)).toBe(true);
    expect(isCarried({ scheduled: "2026-10-23" }, mon)).toBe(true);
    expect(isCarried({ scheduled: "2026-10-26" }, sun)).toBe(false);
    expect(isCarried({ scheduled: "2026-10-26" }, mon)).toBe(false);
  });
});

describe("dropPatch (What writes what)", () => {
  it("Wed 21 Oct: this Monday refused, next Monday 2026-10-26, today allowed", () => {
    expect(dropPatch({}, d("2026-10-19"), WED)).toEqual({ refused: "past" });
    expect(dropPatch({}, d("2026-10-26"), WED)).toEqual({ patch: { set: { scheduled: "2026-10-26" }, remove: [] } });
    expect(dropPatch({}, d("2026-10-21"), WED)).toEqual({ patch: { set: { scheduled: "2026-10-21" }, remove: [] } });
  });
  it("a drop on a day removes the old keys in the same write", () => {
    expect(dropPatch({ day: "Mon", planned: "2026-10-12", rolled: true }, d("2026-10-23"), WED)).toEqual({ patch: { set: { scheduled: "2026-10-23" }, remove: ["day", "planned", "rolled"] } });
  });
  it("the tray removes scheduled and the old keys", () => {
    expect(dropPatch({ scheduled: "2026-10-23", day: "Fri" }, null, WED)).toEqual({ patch: { set: {}, remove: ["scheduled", "day"] } });
  });
  it("nothing to change: null", () => {
    expect(dropPatch({ scheduled: "2026-10-23" }, d("2026-10-23"), WED)).toBeNull();
    expect(dropPatch({}, null, WED)).toBeNull();
  });
  it("the tray takes a carried-over card (no past check for the Backlog)", () => {
    expect(dropPatch({ scheduled: "2026-10-12" }, null, WED)).toEqual({ patch: { set: {}, remove: ["scheduled"] } });
  });
});

describe("tickPatch", () => {
  it("tick stamps done_on, keeps scheduled, drops rolled", () => {
    const fm = { kind: "todo", done: true, scheduled: "2026-10-20", rolled: true };
    expect(tickPatch(fm, false, WED)).toEqual({ set: { done_on: "2026-10-21" }, remove: ["rolled"] });
  });
  it("untick removes done_on and keeps scheduled: the card goes back to its day", () => {
    const fm = { kind: "todo", done: false, scheduled: "2026-10-20", done_on: "2026-10-21" };
    const x = after(fm, tickPatch(fm, true, WED));
    expect(x).toEqual({ kind: "todo", done: false, scheduled: "2026-10-20" });
  });
  it("the re-tick fix: untick on an old day: Done card removes day, so it no longer reads as finished", () => {
    const fm: TodoFm = { kind: "todo", done: false, day: "Done", done_on: "2026-10-12" };
    const x = after(fm as Record<string, unknown>, tickPatch(fm, true, WED));
    expect(x).toEqual({ kind: "todo", done: false });
    expect(isFinishedTodo(x)).toBe(false);
  });
  it("a synced tick already stamped, first sight, no change, not a to-do: null", () => {
    expect(tickPatch({ kind: "todo", done: true, done_on: "2026-10-20" }, false, WED)).toBeNull();
    expect(tickPatch({ kind: "todo", done: true }, undefined, WED)).toBeNull();
    expect(tickPatch({ kind: "todo", done: true }, true, WED)).toBeNull();
    expect(tickPatch({ kind: "note", done: true }, false, WED)).toBeNull();
  });
});

describe("normalisePatch (a note arriving in the To-dos folder)", () => {
  const norm = (fm: Record<string, unknown>): Record<string, unknown> => after(fm, normalisePatch(fm, WED));
  it("a note from the file explorer with nothing: kind and done added", () => {
    expect(norm({})).toEqual({ kind: "todo", done: false });
  });
  it("an old kept template's note: empty keys, day Backlog, countdown, meeting false all go", () => {
    expect(norm({ kind: "todo", day: "Backlog", done: false, project: "", due: null, waiting: "  ", priority: "", countdown: false, meeting: false, cssclasses: ["vt"] }))
      .toEqual({ kind: "todo", done: false, cssclasses: ["vt"] });
  });
  it("an old weekday card gets its date; day, planned, rolled go", () => {
    expect(norm({ kind: "todo", day: "Thu", planned: "2026-10-14", rolled: true, done: false })).toEqual({ kind: "todo", done: false, scheduled: "2026-10-15" });
  });
  it("a weekday card that already has scheduled keeps it and loses day", () => {
    expect(norm({ kind: "todo", day: "Mon", scheduled: "2026-10-27", done: false })).toEqual({ kind: "todo", done: false, scheduled: "2026-10-27" });
  });
  it("an old day: Done card is ticked, done_on kept, none added", () => {
    expect(norm({ kind: "todo", day: "Done", done: false, done_on: "2026-10-09" })).toEqual({ kind: "todo", done: true, done_on: "2026-10-09" });
    expect(norm({ kind: "todo", day: "Done" })).toEqual({ kind: "todo", done: true });
  });
  it("done_on on an open card goes", () => {
    expect(norm({ kind: "todo", done: false, done_on: "2026-10-09" })).toEqual({ kind: "todo", done: false });
  });
  it("an unknown day (typo, lower case) is kept; an empty one goes", () => {
    expect(norm({ kind: "todo", done: false, day: "Teusday" })).toEqual({ kind: "todo", done: false, day: "Teusday" });
    expect(norm({ kind: "todo", done: false, day: "mon" })).toEqual({ kind: "todo", done: false, day: "mon" });
    expect(norm({ kind: "todo", done: false, day: null })).toEqual({ kind: "todo", done: false });
  });
  it("set values are kept", () => {
    const fm = { kind: "todo", done: false, scheduled: "2026-10-22", project: "[[Polymers]]", priority: 1, meeting: true, due: "2026-10-30" };
    expect(normalisePatch(fm, WED)).toBeNull();
  });
  it("a note of another kind is left alone", () => {
    expect(normalisePatch({ kind: "project", day: "Mon" }, WED)).toBeNull();
  });
  it("running it on its own result writes nothing", () => {
    for (const fm of [{}, { day: "Fri" }, { kind: "todo", day: "Done", planned: "x" }, { day: "Sat", planned: "2026-10-14", project: [] }]) {
      expect(normalisePatch(norm(fm), WED)).toBeNull();
    }
  });
});

describe("undoPatch", () => {
  it("puts a tick back exactly", () => {
    const before = { kind: "todo", done: false, scheduled: "2026-10-20", rolled: true, project: ["[[A]]"] };
    const ticked = after(after(before, { set: { done: true }, remove: [] }), tickPatch({ ...before, done: true }, false, WED));
    expect(after(ticked, undoPatch(before, ticked))).toEqual(before);
  });
  it("nothing changed: an empty patch", () => {
    expect(undoPatch({ a: 1 }, { a: 1 })).toEqual({ set: {}, remove: [] });
  });
});
