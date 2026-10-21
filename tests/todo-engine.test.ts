// Phase 4a: the to-do board rules (src/planning/todo.ts), including the 2026-10-07 Obsidian Sync scenarios.
import { describe, it, expect } from "vitest";
import { applyPatch, cardTag, dueCountdown, emptyTodoCursorLine, parseDay, todayMark, weekStart, ymd, type TodoFm } from "../src/planning/todo";
import { cardDate, changePatch, rollOverPatch, snapOf, todayColumn } from "./helpers/old-todo";

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
  it("untick of a cleared card (day Done) goes back to Backlog, so the next roll-over does not tick it again", () => {
    const cleared = todo({ day: "Done", done: true, done_on: "2026-09-20" });
    const unticked = after(todo({ ...cleared, done: false }), cleared);
    expect(unticked).toMatchObject({ day: "Backlog" });
    expect(unticked).not.toHaveProperty("done_on");
    expect(rollOverPatch(unticked as TodoFm, WED, WED)).toBeNull();
    // without the fix the card stays on Done and the roll-over ticks it
    expect(rollOverPatch(todo({ day: "Done", done: false }), WED, WED)?.kind).toBe("ticked");
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

describe("due-date countdown", () => {
  const cd = (fm: Partial<TodoFm>, mode: "off" | "all" = "all", now = WED) => dueCountdown(todo(fm), mode, now);
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
  it("shows nothing when off, done or without a valid date; an old countdown property changes nothing (I2-S2 a)", () => {
    expect(cd({ due: "2026-10-09" }, "off")).toBeNull();
    expect(cd({ due: "2026-10-09", done: true })).toBeNull();
    expect(cd({ due: "2026-10-09", countdown: false })?.text).toBe("2d");
    expect(cd({ due: "2026-10-09", countdown: true }, "off")).toBeNull();
    expect(cd({ due: "" })).toBeNull();
    expect(cd({ due: "2026-02-30" })).toBeNull();
    expect(cd({})).toBeNull();
  });
});

describe("To-do template due date and countdown", () => {
  it("asks for a due date (Esc cancels), no countdown question or property (one setting for all, I2), writes due only when set as a date property", async () => {
    const { readFileSync } = await import("fs");
    const tpl = readFileSync("tests/fixtures/templates/old/To-do.md", "utf8");
    expect(tpl).toContain('d === null) { await trashIfBlank(); throw new Error("Cancelled');
    expect(tpl).not.toContain("Countdown on the board card?");
    expect(tpl).not.toMatch(/countdown/i);
    expect(tpl).toMatch(/^<% due \? `due: \$\{due\}\\n` : "" -%>$/m);
    expect(tpl).toContain('vtEnsureType?.("due", "date")');
  });
});

describe("cardTag (priority and project on a board card)", () => {
  it("priority only, project only, both: an arrow for the priority", () => {
    expect(cardTag({ priority: 1 })).toEqual({ text: "\u2191", level: "1" });
    expect(cardTag({ priority: 2 })).toEqual({ text: "\u2013", level: "2" });
    expect(cardTag({ priority: "3" })).toEqual({ text: "\u2193", level: "3" });
    expect(cardTag({ project: "[[Polymers]]" })).toEqual({ text: "Polymers", level: "" });
    expect(cardTag({ priority: "1", project: "[[Polymers]]" })).toEqual({ text: "\u2191 Polymers", level: "1" });
  });
  it("a project list takes the first; an alias, a path and .md are dropped", () => {
    expect(cardTag({ project: ["[[02 Projects/Polymers/Polymers.md|my polymers]]", "[[Other]]"] })?.text).toBe("Polymers");
    expect(cardTag({ project: "[[Polymers#Goal]]" })?.text).toBe("Polymers");
  });
  it("an invalid priority is ignored; neither gives none", () => {
    expect(cardTag({ priority: 4, project: "[[A]]" })).toEqual({ text: "A", level: "" });
    expect(cardTag({ priority: "high" })).toBeNull();
    expect(cardTag({ priority: "", project: "" })).toBeNull();
    expect(cardTag({})).toBeNull();
  });
});

describe("cursor under the chip bar", () => {
  const head = "---\nkind: todo\nday: Mon\n---\n\n```vault-card\nshow: todo-bar\n```\n";
  it("is the last line of an empty to-do", () => {
    expect(emptyTodoCursorLine(head)).toBe(8);
    expect(emptyTodoCursorLine(head + "\n")).toBe(9);
    expect(emptyTodoCursorLine(head.replace(/\n/g, "\r\n"))).toBe(8);
  });
  it("leaves every other note alone", () => {
    expect(emptyTodoCursorLine(head + "Buy tubes\n")).toBeNull();
    expect(emptyTodoCursorLine(head.replace("kind: todo", "kind: lab"))).toBeNull();
    expect(emptyTodoCursorLine(head.replace("show: todo-bar", "show: inbox"))).toBeNull();
    expect(emptyTodoCursorLine(head.slice(0, -1))).toBeNull();
    expect(emptyTodoCursorLine("no properties\n")).toBeNull();
  });
});
