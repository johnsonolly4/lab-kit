// Close the week (F4) and the Late cards window (I2 Phase 8): the writes, as the drag would make them.
import { describe, it, expect } from "vitest";
import { weekCardOf } from "../src/planning/board-card";
import { closeList, closeWeekPlan, lateCards, lateTarget, nextMonday, type Move } from "../src/planning/board-close";
import { dropPatch, ymd, type TodoFm } from "../src/planning/todo";
import { drawWeekRow } from "../src/planning/board-week-nav";

const FRI = new Date(2026, 9, 23, 16);   // Friday 23 Oct 2026
const WED = new Date(2026, 9, 21, 10);
const SAT = new Date(2026, 9, 24, 10);
const fmOf: Record<string, TodoFm> = {};
const card = (title: string, fm: Record<string, unknown>, now = FRI) => { const f = { kind: "todo", ...fm }; fmOf[`T/${title}.md`] = f; return weekCardOf({ path: `T/${title}.md`, title, fm: f }, "off", now); };
/** The write a Move makes, through `dropPatch` like a drag: the `scheduled` it sets, `""` for the Backlog, null for no write. */
const written = (m: Move, now = FRI): string | null => { const r = dropPatch(fmOf[m.path], m.to, now); return r && "patch" in r ? (r.patch.set.scheduled as string | undefined) ?? "" : null; };

const week = () => [
  card("mon", { scheduled: "2026-10-19" }), card("tue", { scheduled: "2026-10-20" }), card("wed", { scheduled: "2026-10-21" }), card("fri", { scheduled: "2026-10-23" }),
  card("backlog", {}), card("next week", { scheduled: "2026-10-27" }), card("finished", { scheduled: "2026-10-20", done: true, done_on: "2026-10-20" }),
];

describe("closeWeekPlan on Friday 23 Oct (4 open cards of the week)", () => {
  const cards = week();
  it("lists the 4 open cards of the week, not the Backlog, next week or the finished one", () => {
    expect(closeList(cards, FRI).map(c => c.title)).toEqual(["mon", "tue", "wed", "fri"]);
  });
  it("Move 4: next Monday 2026-10-26 is written to each", () => {
    const { moves } = closeWeekPlan(cards, FRI, "next");
    expect(moves).toHaveLength(4);
    expect(moves.map(m => written(m))).toEqual(["2026-10-26", "2026-10-26", "2026-10-26", "2026-10-26"]);
  });
  it("unticked rows are left out of the writes", () => {
    const { moves } = closeWeekPlan(cards, FRI, "next", new Set(["T/mon.md", "T/fri.md"]));
    expect(moves.map(m => m.title)).toEqual(["mon", "fri"]);
  });
  it("nothing ticked writes nothing", () => {
    expect(closeWeekPlan(cards, FRI, "next", new Set()).moves).toEqual([]);
  });
  it("Backlog choice: every ticked card loses its date", () => {
    const { moves } = closeWeekPlan(cards, FRI, "backlog");
    expect(moves.map(m => written(m))).toEqual(["", "", "", ""]);
  });
  it("Leave writes nothing, the list is still shown", () => {
    const r = closeWeekPlan(cards, FRI, "leave");
    expect(r.moves).toEqual([]);
    expect(r.listed).toHaveLength(4);
  });
});

describe("closeWeekPlan early in the week and at the weekend", () => {
  it("on Wednesday 21 Oct only the Mon / Tue cards are listed (days already past)", () => {
    const cards = [card("mon", { scheduled: "2026-10-19" }, WED), card("tue", { scheduled: "2026-10-20" }, WED), card("wed", { scheduled: "2026-10-21" }, WED), card("thu", { scheduled: "2026-10-22" }, WED)];
    expect(closeList(cards, WED).map(c => c.title)).toEqual(["mon", "tue"]);
    expect(closeWeekPlan(cards, WED, "next").moves.map(m => written(m, WED))).toEqual(["2026-10-26", "2026-10-26"]);
  });
  it("on Saturday the Sat / Sun cards are listed too, and next Monday is 26 Oct", () => {
    const cards = [card("fri", { scheduled: "2026-10-23" }, SAT), card("sat", { scheduled: "2026-10-24" }, SAT), card("sun", { scheduled: "2026-10-25" }, SAT)];
    expect(closeList(cards, SAT)).toHaveLength(3);
    expect(ymd(nextMonday(SAT))).toBe("2026-10-26");
  });
  it("a card carried over from an earlier week is listed", () => {
    expect(closeList([card("old", { scheduled: "2026-10-12" }, WED)], WED).map(c => c.title)).toEqual(["old"]);
  });
  it("a card already on next Monday gets no write when moved there", () => {
    const next = card("on monday", { scheduled: "2026-10-26" });
    expect(closeList([next], FRI)).toEqual([]);
  });
});

describe("Late cards", () => {
  const cards = [card("late", { scheduled: "2026-10-12" }, WED), card("today", { scheduled: "2026-10-21" }, WED), card("done late", { scheduled: "2026-10-12", done: true }, WED), card("backlog", {}, WED)];
  it("lists only open cards planned before today", () => {
    expect(lateCards(cards, WED).map(c => c.title)).toEqual(["late"]);
  });
  it("each button writes what the drag writes: Today, Tomorrow, Next week (Monday), Backlog; Done is a tick", () => {
    const m = (a: Parameters<typeof lateTarget>[0]): string | null | undefined => {
      const to = lateTarget(a, WED);
      if (to === undefined) return undefined;
      const r = dropPatch(fmOf["T/late.md"], to, WED);
      return r && "patch" in r ? (r.patch.set.scheduled as string | undefined) ?? "" : null;
    };
    expect(["today", "tomorrow", "nextweek", "backlog", "done"].map(a => m(a as never))).toEqual(["2026-10-21", "2026-10-22", "2026-10-26", "", undefined]);
  });
});

describe("the top row buttons", () => {
  /** A recording element: every child (any depth) lands in `all`. */
  function fake() {
    const all: { cls: string; text: string; on: Record<string, (e: unknown) => void> }[] = [];
    const mk = (o: { cls?: string; text?: string }) => {
      const k = { cls: o.cls ?? "", text: o.text ?? "", on: {} as Record<string, (e: unknown) => void>, addEventListener(ev: string, fn: (e: unknown) => void) { k.on[ev] = fn; }, createDiv: (p: { cls?: string }) => mk(p), createEl: (_t: string, p: { cls?: string; text?: string }) => mk(p), createSpan: (p: { cls?: string; text?: string }) => mk(p) };
      all.push(k); return k;
    };
    return { all, root: mk({}) };
  }
  it("shows `3 carried over` and `Close the week…`, each calling back with its own button", () => {
    const f = fake(), got: string[] = [];
    drawWeekRow(f.root as never, new Date(2026, 9, 19), 0, () => {}, { late: 3, onLate: () => got.push("late"), onClose: () => got.push("close") });
    const texts = f.all.map(k => k.text).filter(Boolean);
    expect(texts).toContain("3 carried over");
    expect(texts).toContain("Close the week…");
    for (const k of f.all.filter(k => k.text === "3 carried over" || k.text === "Close the week…")) k.on.click({ stopPropagation: () => {} });
    expect(got).toEqual(["late", "close"]);
  });
  it("no chip when nothing is late; Close the week… is always there", () => {
    const f = fake();
    drawWeekRow(f.root as never, new Date(2026, 9, 19), 0, () => {}, { late: 0, onLate: () => {}, onClose: () => {} });
    const texts = f.all.map(k => k.text);
    expect(texts.some(t => t.includes("carried over"))).toBe(false);
    expect(texts).toContain("Close the week…");
  });
});
