// Drawing the plan map (src/planning/plan-map-render.ts) with the small DOM stand-in: it draws, cards get a strip, a link through a subtask is a dashed arrow.
// The stand-in's `createSvg` refuses a class with a space, as Obsidian's may (a thrown error leaves the whole block empty): add extra classes with addClass.
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { drawPlanMap } from "../src/planning/plan-map-render";
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
  drawPlanMap(box, plan, layoutPlan(plan), { app: {} as never, sourcePath: hub.path, expanded: new Set(todos.map(t => t.path)), direction, zoom: 1, redraw() { /* nothing */ } });
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
});
