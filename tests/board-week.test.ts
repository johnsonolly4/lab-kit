// I2 Phase 1: buildWeek places cards by date (docs/plans/planned-dates.md "Where a card shows"), row by row.
import { describe, it, expect } from "vitest";
import { dropPatch } from "../src/planning/todo";
import { buildWeek, datePill, weekCardOf, type HeaderSrc, type WeekBoard, type WeekCard, type WeekOptions } from "../src/planning/board-card";

const WED = new Date(2026, 9, 21, 10);   // Wednesday 21 Oct 2026
const SAT = new Date(2026, 9, 24, 10);
const head: HeaderSrc = { series: [], todos: [], hubs: [] };
const opts = (o: Partial<WeekOptions> = {}): WeekOptions => ({ weekend: false, busyFrom: 6, countdown: "off", now: WED, ...o });
const card = (title: string, fm: Record<string, unknown>, now = WED): WeekCard => weekCardOf({ path: `T/${title}.md`, title, fm: { kind: "todo", ...fm } }, "off", now);
/** Where each card is: the column name (with * when carried), `tray` / `tray [pill]`, `done@col`, or `-` when not shown. */
function where(b: WeekBoard, title: string): string {
  for (const c of b.days) {
    const o = c.open.find(x => x.title === title);
    if (o) return c.day + (o.carried ? "*" : "");
    if (c.finished.some(x => x.title === title)) return `done@${c.day}`;
  }
  const t = b.tray.find(x => x.title === title);
  return t ? (t.pill ? `tray [${t.pill}]` : "tray") : "-";
}

describe("buildWeek: this week (Wed 21 Oct)", () => {
  const cards = [
    card("today", { scheduled: "2026-10-21" }),
    card("fri", { scheduled: "2026-10-23" }),
    card("tue late", { scheduled: "2026-10-20" }),
    card("last week", { scheduled: "2026-10-14" }),
    card("backlog", {}),
    card("next week", { scheduled: "2026-10-27" }),
    card("sat", { scheduled: "2026-10-24" }),
    card("done mon", { done: true, done_on: "2026-10-19", scheduled: "2026-10-16" }),
    card("done last week", { done: true, done_on: "2026-10-16" }),
    card("done no done_on", { done: true, scheduled: "2026-10-20" }),
    card("done no date", { done: true }),
    card("old Done day", { day: "Done", done: false }),
    card("old thu", { day: "Thu", planned: "2026-10-14" }),
    card("done sat", { done: true, done_on: "2026-10-24" }),
  ];
  const b = buildWeek(cards, head, opts());
  it.each([
    ["today", "Wed"], ["fri", "Fri"],
    ["tue late", "Wed*"], ["last week", "Wed*"], ["old thu", "Wed*"],
    ["backlog", "tray"], ["next week", "tray [Tue 27 Oct]"], ["sat", "tray [Sat 24 Oct]"],
    ["done mon", "done@Mon"], ["done last week", "-"], ["done no done_on", "done@Tue"], ["done no date", "-"], ["old Done day", "-"],
    ["done sat", "done@Mon"],
  ])("%s → %s", (t, want) => { expect(where(b, t)).toBe(want); });
  it("past columns, today, counts", () => {
    expect(b.days.map(c => c.past)).toEqual([true, true, false, false, false]);
    expect(b.days.map(c => c.today)).toEqual([false, false, true, false, false]);
    expect(b.days.map(c => [c.count, c.done])).toEqual([[0, 2], [0, 1], [4, 0], [0, 0], [1, 0]]);
  });
});

describe("buildWeek: the weekend and other weeks", () => {
  const cards = [card("fri", { scheduled: "2026-10-23" }, SAT), card("sat", { scheduled: "2026-10-24" }, SAT), card("sun", { scheduled: "2026-10-25" }, SAT)];
  it("Saturday, weekend off: late cards in Mon, carried, with nothing written (Q15)", () => {
    const b = buildWeek(cards, head, opts({ now: SAT }));
    expect(["fri", "sat", "sun"].map(t => where(b, t))).toEqual(["Mon*", "tray [Sat 24 Oct]", "tray [Sun 25 Oct]"]);
    expect(b.days.every(c => !c.today)).toBe(true);
  });
  it("Saturday, weekend on: late cards in today's column, Sat and Sun in theirs", () => {
    const b = buildWeek(cards, head, opts({ now: SAT, weekend: true }));
    expect(["fri", "sat", "sun"].map(t => where(b, t))).toEqual(["Sat*", "Sat", "Sun"]);
    expect(b.days.find(c => c.today)?.day).toBe("Sat");
  });
  it("next week shown: its cards in their columns, carried cards and this week's cards absent, the tray holds only undated cards", () => {
    const cs = [card("late", { scheduled: "2026-10-20" }), card("this fri", { scheduled: "2026-10-23" }), card("next tue", { scheduled: "2026-10-27" }), card("in two weeks", { scheduled: "2026-11-03" }), card("backlog", {})];
    const b = buildWeek(cs, head, opts({ week: new Date(2026, 9, 28) }));
    expect(cs.map(c => where(b, c.title))).toEqual(["-", "-", "Tue", "-", "tray"]);
    expect(b.days.some(c => c.past || c.today)).toBe(false);
  });
  it("away from this week the tray lists undated cards (and the weekend-dated one, below); this week's tray is unchanged; a drop on the tray clears the date", () => {
    const cs = [card("backlog", {}), card("this fri", { scheduled: "2026-10-23" }), card("sat", { scheduled: "2026-10-24" }), card("later", { scheduled: "2026-11-10" }), card("old", { scheduled: "2026-10-14" })];
    const names = (b: ReturnType<typeof buildWeek>) => b.tray.map(c => c.title);
    expect(names(buildWeek(cs, head, opts()))).toEqual(["backlog", "sat", "later"]);
    expect(names(buildWeek(cs, head, opts({ week: new Date(2026, 9, 12) })))).toEqual(["backlog", "sat"]);
    expect(names(buildWeek(cs, head, opts({ week: new Date(2026, 9, 28) })))).toEqual(["backlog", "sat"]);
    expect(names(buildWeek(cs, head, opts({ week: new Date(2026, 10, 9) })))).toEqual(["backlog", "sat"]);
    const r = dropPatch({ kind: "todo", scheduled: "2026-10-23" }, null, new Date(2026, 9, 19, 10));
    expect(r).toMatchObject({ patch: { remove: expect.arrayContaining(["scheduled"]) } });
  });
  it("weekend off: Sat / Sun-dated cards are in the tray of every week, with the pill; weekend on: nothing extra", () => {
    const cs = [card("backlog", {}), card("this fri", { scheduled: "2026-10-23" }), card("sat", { scheduled: "2026-10-24" }), card("sun", { scheduled: "2026-10-25" }), card("next sat", { scheduled: "2026-10-31" }), card("old sat", { scheduled: "2026-10-17" }), card("done sat", { done: true, done_on: "2026-10-24" })];
    const tray = (o: Partial<WeekOptions>) => buildWeek(cs, head, opts(o)).tray.map(c => c.title + (c.pill ? ` [${c.pill}]` : ""));
    expect(tray({})).toEqual(["backlog", "sat [Sat 24 Oct]", "sun [Sun 25 Oct]", "next sat [Sat 31 Oct]"]);
    for (const week of [new Date(2026, 9, 12), new Date(2026, 9, 28), new Date(2026, 10, 9)])
      expect(tray({ week })).toEqual(["backlog", "sat [Sat 24 Oct]", "sun [Sun 25 Oct]", "next sat [Sat 31 Oct]"]);
    expect(buildWeek(cs, head, opts({ week: new Date(2026, 9, 28), weekend: true })).tray.map(c => c.title)).toEqual(["backlog"]);
    expect(buildWeek(cs, head, opts({ weekend: true })).tray.map(c => c.title)).toEqual(["backlog", "next sat"]);   // later weeks stay in the tray this week, as before
    const r = dropPatch({ kind: "todo", scheduled: "2026-10-24" }, null, new Date(2026, 9, 19, 10));
    expect(r).toMatchObject({ patch: { remove: expect.arrayContaining(["scheduled"]) } });
  });
  it("last week shown: finished cards of that week, no open cards, every column past", () => {
    const cs = [card("done thu", { done: true, done_on: "2026-10-15" }), card("late", { scheduled: "2026-10-14" })];
    const b = buildWeek(cs, head, opts({ week: new Date(2026, 9, 12) }));
    expect(cs.map(c => where(b, c.title))).toEqual(["done@Thu", "-"]);
    expect(b.days.every(c => c.past)).toBe(true);
  });
  it("a due mark sits on the due day when the card is drawn elsewhere, not when it is drawn there", () => {
    const cs = [card("due fri", { scheduled: "2026-10-22", due: "2026-10-23" }), card("due on its day", { scheduled: "2026-10-23", due: "2026-10-23" })];
    const fri = buildWeek(cs, head, opts()).days[4];
    expect(fri.markers.map(m => m.text)).toEqual(["Due: due fri"]);
  });
  it("datePill", () => { expect(datePill(new Date(2026, 10, 3))).toBe("Tue 3 Nov"); });
});
