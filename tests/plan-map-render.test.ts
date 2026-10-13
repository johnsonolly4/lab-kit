// Drawing the plan map (src/planning/plan-map-render.ts) with the small DOM stand-in: it draws, cards get a strip, a link through a subtask is a dashed arrow.
// The stand-in's `createSvg` refuses a class with a space, as Obsidian's may (a thrown error leaves the whole block empty): add extra classes with addClass.
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { drawPlanMap } from "../src/planning/plan-map-render";
import { PlanHistory } from "../src/planning/plan-history";
import { layoutPlan } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import type { NoteRec } from "../src/planning/lists";

vi.mock("obsidian", async orig => ({ ...(await orig() as object), setIcon: () => { /* no icons here */ }, Keymap: { isModEvent: () => false } }));
const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const P = El.prototype as Record<string, unknown>;
P.createSvg = function (this: { createEl(t: string, o: unknown): unknown }, tag: string, o: { cls?: string } = {}) {
  if (o.cls && /\s/.test(o.cls)) throw new Error("InvalidCharacterError: class with a space");
  return this.createEl(tag, o);
};
P.createDiv ??= function (this: { createEl(t: string, o: unknown): unknown }, o: unknown = {}) { return this.createEl("div", o); };
P.createSpan ??= function (this: { createEl(t: string, o: unknown): unknown }, o: unknown = {}) { return this.createEl("span", o); };
Object.defineProperty(P, "dataset", { configurable: true, get(this: { _ds?: object }) { return (this._ds ??= {}); } });

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const draw = (todos: NoteRec[], direction: "across" | "down") => {
  const plan = readPlan(todos, hub), box = new El("div");
  drawPlanMap(box, plan, layoutPlan(plan), { app: {} as never, sourcePath: hub.path, expanded: new Set(todos.map(t => t.path)), direction, zoom: 1, history: new PlanHistory(), problemsOpen: false, showProblems() { /* nothing */ }, redraw() { /* nothing */ } });
  return box;
};
// A, B after A, C (a subtask of A) with D after C, a lone to-do with its own subtask.
const todos = [td("A"), td("B", { after: "[[A]]" }), td("C", { sub: "[[A]]" }), td("D", { after: "[[C]]" }), td("Lone"), td("LoneSub", { sub: "[[Lone]]" })];

describe("drawPlanMap", () => {
  for (const direction of ["across", "down"] as const) it(`draws cards, strips and a dashed arrow for a link through a subtask (${direction})`, () => {
    const box = draw(todos, direction);
    expect(box.querySelectorAll(".vt-map-card").map((c: { querySelector(s: string): { textContent: string } }) => c.querySelector(".vt-map-title").textContent)).toEqual(["A", "B", "D"]);
    expect(box.querySelectorAll(".vt-map-card .vt-map-grip").length).toBe(4);   // a strip on each of the 3 cards, and C's line in A's list
    expect(box.querySelectorAll(".vt-map-sub .vt-map-grip").length).toBe(2);   // C in A's list, LoneSub in Lone's row
    expect(box.querySelectorAll(".vt-map-arrow")).toHaveLength(2);   // A → B and A → D
    expect(box.querySelectorAll(".vt-map-arrow-via")).toHaveLength(1);
    expect(box.querySelectorAll(".vt-map-arrow-hit")).toHaveLength(1);   // the dashed one has no Remove link
    const tiles = box.querySelectorAll(".vt-map-tile");   // Not linked: one small tile per to-do, strip + node + tick, the full name in `title`
    expect(tiles).toHaveLength(1);
    expect(tiles[0].getAttribute("title")).toBe("Lone");
    expect(box.querySelectorAll(".vt-map-tile .vt-map-grip")).toHaveLength(2);   // the tile's own strip, and LoneSub's line in its list
    expect(box.querySelectorAll(".vt-map-tile .vt-map-handle")).toHaveLength(1);
    expect(box.querySelectorAll(".vt-map-tile .vt-map-tick")).toHaveLength(2);   // the tile's, and LoneSub's line
    expect(box.querySelectorAll(".vt-map-unlinked li")).toHaveLength(0);
  });

  it("an open subtask of a finished parent is marked missing (amber), and the badge too", () => {
    const box = draw([td("P", { done: true }), td("S1", { sub: "[[P]]" }), td("S2", { sub: "[[P]]", done: true })], "across");
    const lines = box.querySelectorAll(".vt-map-sub");
    expect(lines).toHaveLength(2);
    expect(box.querySelectorAll(".vt-map-sub-missing")).toHaveLength(1);
    expect(box.querySelectorAll(".vt-map-subsopen")).toHaveLength(1);
    const open = draw([td("P"), td("S1", { sub: "[[P]]" })], "across");
    expect(open.querySelectorAll(".vt-map-sub-missing")).toHaveLength(0);
    expect(open.querySelectorAll(".vt-map-subsopen")).toHaveLength(0);
  });

  it("problems: a ⚠ on the to-do, the list behind one row until opened, outlines both ways, a fix says what it does and is a history step", async () => {
    const { drawProblems } = await import("../src/planning/plan-map-render");
    const fms: Record<string, Record<string, unknown>> = { [T + "A.md"]: { kind: "todo", project: "[[Alpha]]", after: ["[[Ghost]]", "[[B]]"] }, [T + "B.md"]: { kind: "todo", project: "[[Alpha]]" }, [T + "L.md"]: { kind: "todo", project: "[[Alpha]]", sub: "[[Ghost]]" } };
    const plan = readPlan(Object.entries(fms).map(([p, fm]) => note(p, fm)), hub);
    const history = new PlanHistory();
    const app = { vault: { getFileByPath: (p: string) => (p in fms ? { path: p } : null) }, fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(fms[f.path]); } } } as never;
    let opened = false;
    const o = { app, sourcePath: hub.path, expanded: new Set<string>(), direction: "across" as const, zoom: 1, history, get problemsOpen() { return opened; }, showProblems: (v: boolean) => { opened = v; }, redraw() { /* nothing */ } };
    const build = () => { const b = new El("div"); drawPlanMap(b, plan, layoutPlan(plan), o); drawProblems(b, plan, o); return b; };
    type E = { hasClass(c: string): boolean; dispatch(t: string): void; getAttribute(k: string): string | undefined; querySelectorAll(s: string): E[]; parent: E; textContent: string };
    let box = build() as unknown as E;
    expect(box.querySelectorAll(".vt-map-issues-head")[0].textContent).toBe("2 problems in this planShow");
    expect(box.querySelectorAll(".vt-map-issue")).toHaveLength(0);   // hidden until opened
    box.querySelectorAll(".vt-map-issues-head button")[0].dispatch("click");
    expect(opened).toBe(true);
    box = build() as unknown as E;
    const lines = box.querySelectorAll(".vt-map-issue");
    expect(lines.map(l => l.textContent)).toEqual([
      '"A" comes after "Ghost", which isn\'t in this project.Remove the link to "Ghost"Open note',
      '"L" is a subtask of "Ghost", which isn\'t in this project.Make it a normal to-doOpen note']);
    expect(lines[0].querySelectorAll("button")[0].getAttribute("aria-label")).toBe('Removes "Ghost" from the "comes after" list of "A"; its other links stay.');
    const flaggedCards = (): number => [...box.querySelectorAll(".vt-map-card"), ...box.querySelectorAll(".vt-map-tile")].filter(c => c.hasClass("vt-map-flag")).length;
    lines[0].dispatch("mouseenter");   // a line -> itself and its card
    expect(flaggedCards()).toBe(1);
    expect(lines[0].hasClass("vt-map-flag")).toBe(true);
    expect(lines[1].hasClass("vt-map-flag")).toBe(false);
    lines[0].dispatch("mouseleave");
    expect(flaggedCards()).toBe(0);
    expect(lines[0].hasClass("vt-map-flag")).toBe(false);
    const cardMark = box.querySelectorAll(".vt-map-warnmark").find(m => m.parent.hasClass("vt-map-card"))!;
    expect(cardMark.getAttribute("title")).toBeUndefined();   // one tooltip (aria-label), not two
    cardMark.parent.dispatch("mouseenter");   // a card (anywhere on it) -> itself and its line
    expect(lines.filter(l => l.hasClass("vt-map-flag"))).toHaveLength(1);
    expect(cardMark.parent.hasClass("vt-map-flag")).toBe(true);
    cardMark.parent.dispatch("mouseleave");
    expect(lines.filter(l => l.hasClass("vt-map-flag"))).toHaveLength(0);
    expect(cardMark.parent.hasClass("vt-map-flag")).toBe(false);
    cardMark.dispatch("click");   // click the ⚠: a box with the sentence and the buttons
    expect(box.querySelectorAll(".vt-map-pop .vt-map-issue")).toHaveLength(1);
    cardMark.dispatch("click");
    expect(box.querySelectorAll(".vt-map-pop")).toHaveLength(1);   // one box at a time
    lines[0].querySelectorAll("button")[0].dispatch("click");
    await new Promise(r => setTimeout(r, 10));
    expect(fms[T + "A.md"].after).toBe("[[B]]");
    expect(history.peek("undo")?.label).toBe('Remove the link to "Ghost"');
    lines[1].querySelectorAll("button")[0].dispatch("click");
    await new Promise(r => setTimeout(r, 10));
    expect("sub" in fms[T + "L.md"]).toBe(false);
  });
});
