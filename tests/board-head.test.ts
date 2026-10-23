// The `+` in a day header of the Lab Kit board: today and later days only, and what it hands over (I2 Phase 5 question a).
import { describe, it, expect } from "vitest";
import { drawHeadAdd } from "../src/planning/board-head";
import { buildWeek } from "../src/planning/board-card";
import { columnEntry } from "../src/planning/todo-note";
import { ymd } from "../src/planning/todo";

const WED = new Date(2026, 9, 21, 10);
const board = buildWeek([], { series: [], todos: [], hubs: [] }, { weekend: false, busyFrom: 6, countdown: "off", now: WED });

/** A recording head element (no DOM in the tests). */
function head() {
  const kids: { cls: string; text: string; attr: Record<string, string>; on: Record<string, (e: unknown) => void> }[] = [];
  const el = { kids, createEl(_t: string, o: { cls: string; text: string; attr: Record<string, string> }) { const k = { ...o, on: {} as Record<string, (e: unknown) => void>, addEventListener(ev: string, fn: (e: unknown) => void) { k.on[ev] = fn; } }; kids.push(k); return k; } };
  return el;
}

describe("drawHeadAdd", () => {
  it("gives a `+` to today and later days, none to past days (Wed clock: Mon, Tue none; Wed, Thu, Fri one)", () => {
    const got = board.days.map(d => { const h = head(); drawHeadAdd(h as never, d, () => {}); return [d.day, h.kids.length]; });
    expect(got).toEqual([["Mon", 0], ["Tue", 0], ["Wed", 1], ["Thu", 1], ["Fri", 1]]);
  });
  it("is a labelled button with the text `+`", () => {
    const h = head(), thu = board.days[3];
    drawHeadAdd(h as never, thu, () => {});
    expect(h.kids[0]).toMatchObject({ cls: "lk-board-add", text: "+", attr: { type: "button", "aria-label": "New to-do on Thu" } });
  });
  it("a click calls back once and does not bubble to the column", () => {
    const h = head(), calls: number[] = [];
    drawHeadAdd(h as never, board.days[3], () => calls.push(1));
    let stopped = false;
    h.kids[0].on.click({ stopPropagation: () => { stopped = true; } });
    expect(calls).toEqual([1]);
    expect(stopped).toBe(true);
  });
  it("the date a day hands over opens the window on that day (columnEntry)", () => {
    const thu = board.days[3], wed = board.days[2];
    expect(columnEntry(ymd(thu.date), WED)).toEqual({ scheduled: "2026-10-22", heading: "New to-do · Thu" });
    expect(columnEntry(ymd(wed.date), WED)).toEqual({ scheduled: "2026-10-21", heading: "New to-do · Wed" });
  });
});
