// The board's `N done` line: unfolds a day's finished cards; the circle unticks (I2 Phase 6, docs/decisions.md "I2 Phase 6 ticks").
import { describe, it, expect } from "vitest";
import { drawDone } from "../src/planning/board-done";
import { buildWeek, weekCardOf, type WeekCard } from "../src/planning/board-card";
import { toggleDoneWithUndo, frontOf } from "../src/planning/undo-notice";
import { applyPatch, tickPatch } from "../src/planning/todo";
import { Notice } from "obsidian";

const WED = new Date(2026, 9, 21, 10);

/** A recording element tree (no DOM in the tests). */
interface Fake { tag: string; cls: string; text: string; attr: Record<string, string>; dataset: Record<string, string>; kids: Fake[]; on: Record<string, (e: unknown) => void> }
function el(tag = "div", o: { cls?: string; text?: string; attr?: Record<string, string> } = {}): Fake & Record<string, unknown> {
  const f: Fake & Record<string, unknown> = {
    tag, cls: o.cls ?? "", text: o.text ?? "", attr: o.attr ?? {}, dataset: {}, kids: [], on: {},
    addEventListener(ev: string, fn: (e: unknown) => void) { f.on[ev] = fn; },
    createDiv(o2?: { cls?: string }) { return add("div", o2); },
    createSpan(o2?: { cls?: string; text?: string }) { return add("span", o2); },
    createEl(t: string, o2?: { cls?: string; text?: string; attr?: Record<string, string> }) { return add(t, o2); },
  };
  const add = (t: string, o2?: { cls?: string; text?: string; attr?: Record<string, string> }): Fake & Record<string, unknown> => { const k = el(t, o2); f.kids.push(k); return k; };
  return f;
}
const all = (f: Fake): Fake[] => [f, ...f.kids.flatMap(all)];
const byCls = (f: Fake, c: string): Fake[] => all(f).filter(x => x.cls.split(" ").includes(c));

const mon = (title: string, fm: Record<string, unknown>): WeekCard => weekCardOf({ path: `T/${title}.md`, title, fm: { kind: "todo", ...fm } }, "off", WED);
const cards = [
  mon("done mon A", { done: true, done_on: "2026-10-19" }),
  mon("done mon B", { done: true, done_on: "2026-10-19", scheduled: "2026-10-22" }),
  mon("done tue", { done: true, done_on: "2026-10-20" }),
  mon("open wed", { scheduled: "2026-10-21" }),
];
const board = buildWeek(cards, { series: [], todos: [], hubs: [] }, { weekend: false, busyFrom: 6, countdown: "off", now: WED });
const monday = board.days[0];

const handlers = () => { const calls: string[] = []; return { calls, h: { toggle: () => calls.push("toggle"), untick: (p: string) => calls.push(`untick ${p}`), open: (p: string) => calls.push(`open ${p}`) } }; };

describe("drawDone", () => {
  it("folded: only the `2 done` line, with aria-expanded false", () => {
    const parent = el(), { h } = handlers();
    drawDone(parent as never, monday.finished, false, h);
    expect(byCls(parent, "lk-board-donecount").map(x => [x.text, x.attr["aria-expanded"]])).toEqual([["2 done", "false"]]);
    expect(byCls(parent, "lk-board-card")).toEqual([]);
  });

  it("unfolded: the list is the day's finished cards, each with a filled circle", () => {
    const parent = el(), { h, calls } = handlers();
    drawDone(parent as never, monday.finished, true, h);
    expect(byCls(parent, "lk-board-donecount")[0].attr["aria-expanded"]).toBe("true");
    const shown = byCls(parent, "lk-board-card");
    expect(shown.map(c => byCls(c, "lk-board-title")[0].text)).toEqual(["done mon A", "done mon B"]);
    expect(shown.map(c => c.dataset.path)).toEqual(["T/done mon A.md", "T/done mon B.md"]);
    expect(byCls(parent, "is-done").map(x => x.attr["aria-label"])).toEqual(["Mark not done", "Mark not done"]);
    byCls(parent, "lk-board-donecount")[0].on.click({});
    byCls(parent, "is-done")[1].on.click({ stopPropagation() { calls.push("stop"); } });
    shown[0].on.click({});
    expect(calls).toEqual(["toggle", "stop", "untick T/done mon B.md", "open T/done mon A.md"]);
  });

  it("a day with nothing finished draws nothing", () => {
    const parent = el();
    drawDone(parent as never, board.days[3].finished, true, handlers().h);
    expect(parent.kids).toEqual([]);
  });
});

describe("untick from the done list", () => {
  it("writes done: false, shows no notice; the engine's stamp removal drops done_on and keeps scheduled", async () => {
    let text = '---\nkind: todo\ndone: true\ndone_on: 2026-10-19\nscheduled: "2026-10-22"\n---\nbody\n';
    const file = { path: "T/x.md", basename: "x" };
    const parse = (): Record<string, unknown> => Object.fromEntries(frontOf(text).split("\n").slice(1, -2).map(l => { const i = l.indexOf(":"); const v = l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1"); return [l.slice(0, i), v === "true" ? true : v === "false" ? false : v]; }));
    const app = {
      vault: { read: async () => text },
      fileManager: { processFrontMatter: async (_f: unknown, fn: (x: Record<string, unknown>) => void) => { const fm = parse(); fn(fm); text = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === "string" && k === "scheduled" ? `"${v}"` : String(v)}`).join("\n")}\n---\nbody\n`; } },
    };
    const made = (Notice as unknown as { all: unknown[] }).all, count = made.length;
    await toggleDoneWithUndo(app as never, file as never);
    expect(text).toContain("done: false");
    expect(made.length).toBe(count);
    await app.fileManager.processFrontMatter(file, x => { const p = tickPatch(x, true, WED); if (p) applyPatch(x, p); });
    expect(text).not.toContain("done_on");
    expect(text).toContain('scheduled: "2026-10-22"');
  });
});
