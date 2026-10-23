// The week row of the Lab Kit board (I2 Phase 7, F1): shown-week offset, titles, drops per week.
import { describe, it, expect } from "vitest";
import { buildWeek, weekCardOf, weekTitle } from "../src/planning/board-card";
import { drawWeekRow, weekAt } from "../src/planning/board-week-nav";
import { dropPatch, parseDay, ymd } from "../src/planning/todo";

const MON = new Date(2026, 9, 19, 10);   // Monday 19 Oct 2026
const head = { series: [], todos: [], hubs: [] };
const o = (offset: number) => ({ weekend: false, busyFrom: 6, countdown: "off" as const, now: MON, week: weekAt(MON, offset) });
const card = (title: string, fm: Record<string, unknown>) => weekCardOf({ path: `T/${title}.md`, title, fm: { kind: "todo", ...fm } }, "off", MON);

describe("weekAt and weekTitle", () => {
  it("offset 0 / 1 / -1 are the Mondays 19 Oct / 26 Oct / 12 Oct", () => {
    expect([0, 1, -1].map(n => ymd(weekAt(MON, n)))).toEqual(["2026-10-19", "2026-10-26", "2026-10-12"]);
  });
  it("any day of the week gives the same Monday", () => {
    expect(ymd(weekAt(new Date(2026, 9, 25, 9), 1))).toBe("2026-10-26");
  });
  it("titles read `Week of 26 Oct`, also across a month and a year", () => {
    expect(weekTitle(weekAt(MON, 1))).toBe("Week of 26 Oct");
    expect(weekTitle(weekAt(MON, 2))).toBe("Week of 2 Nov");
    expect(weekTitle(weekAt(new Date(2026, 11, 30), 0))).toBe("Week of 28 Dec");
  });
});

describe("buildWeek by offset (Mon 19 Oct clock)", () => {
  const cards = [card("tue", { scheduled: "2026-10-20" }), card("next tue", { scheduled: "2026-10-27" }), card("done mon", { done: true, done_on: "2026-10-19" }), card("done last", { done: true, done_on: "2026-10-14" })];
  it("next week shows next week's cards, none of today's", () => {
    const b = buildWeek(cards, head, o(1));
    expect(ymd(b.monday)).toBe("2026-10-26");
    expect(b.days[1].open.map(c => c.title)).toEqual(["next tue"]);
    expect(b.days.every(d => !d.today && !d.past)).toBe(true);
  });
  it("a past week shows its `N done`, no open cards, and every day is a past (no-drop) day", () => {
    const b = buildWeek(cards, head, o(-1));
    expect(b.days.map(d => d.done)).toEqual([0, 0, 1, 0, 0]);
    expect(b.days.every(d => d.open.length === 0 && d.past)).toBe(true);
  });
  it("offset 0 is this week again", () => {
    const b = buildWeek(cards, head, o(0));
    expect(ymd(b.monday)).toBe("2026-10-19");
    expect(b.days[0].today).toBe(true);
  });
});

describe("drops per week", () => {
  it("a drop on Tue of next week writes 2026-10-27", () => {
    const tue = buildWeek([], head, o(1)).days[1];
    const r = dropPatch({ kind: "todo" }, parseDay(ymd(tue.date)), MON);
    expect(r && "patch" in r ? r.patch.set : r).toMatchObject({ scheduled: "2026-10-27" });
  });
  it("a drop on a past week's day is refused", () => {
    const tue = buildWeek([], head, o(-1)).days[1];
    expect(dropPatch({ kind: "todo" }, parseDay(ymd(tue.date)), MON)).toHaveProperty("refused");
  });
});

describe("drawWeekRow", () => {
  function row() {
    const kids: { cls: string; text: string; on: Record<string, (e: unknown) => void> }[] = [];
    const mk = (o: { cls: string; text?: string }) => { const k = { cls: o.cls, text: o.text ?? "", on: {} as Record<string, (e: unknown) => void>, addEventListener(ev: string, fn: (e: unknown) => void) { k.on[ev] = fn; } }; kids.push(k); return k; };
    return { kids, createDiv: () => ({ createEl: (_t: string, o: { cls: string; text: string }) => mk(o), createSpan: (o: { cls: string; text: string }) => mk(o) }) };
  }
  it("this week: ‹ › and the title, no `This week`", () => {
    const p = row(); drawWeekRow(p as never, weekAt(MON, 0), 0, () => {});
    expect(p.kids.map(k => k.text)).toEqual(["‹", "›", "Week of 19 Oct"]);
  });
  it("away from this week: `This week` last; the buttons call back -1, +1, 0", () => {
    const p = row(), got: number[] = [];
    drawWeekRow(p as never, weekAt(MON, 1), 1, s => got.push(s));
    expect(p.kids.map(k => k.text)).toEqual(["‹", "›", "Week of 26 Oct", "This week"]);
    for (const i of [0, 1, 3]) p.kids[i].on.click({ stopPropagation: () => {} });
    expect(got).toEqual([-1, 1, 0]);
  });
});
