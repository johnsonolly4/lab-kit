// The slide picture of a plan (src/planning/plan-slide.ts): which to-dos are cards and which tiles, and the SVG.
import { describe, it, expect } from "vitest";
import { layoutPlan } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import { MIN_READABLE, slideModel, slideSvg } from "../src/planning/plan-slide";
import type { NoteRec } from "../src/planning/lists";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const map = (todos: NoteRec[]) => layoutPlan(readPlan(todos, hub));
/** A chain S1 → S2 → … → Sn; the first `done` are finished. */
const chain = (n: number, done = 0): NoteRec[] =>
  Array.from({ length: n }, (_, i) => td(`S${i + 1}`, { ...(i ? { after: `[[S${i}]]` } : {}), ...(i < done ? { done: true } : {}) }));
const names = (rows: { name: string }[]) => rows.map(r => r.name);
const cardNames = (m: ReturnType<typeof slideModel>) => m.map.cards.map(c => c.row.name);
const count = (s: string, part: string): number => s.split(part).length - 1;

describe("slideModel compact", () => {
  it("ahead 5: finished are tiles, cards are the open ones within five steps, the rest are tiles", () => {
    const m = slideModel(map([...chain(12, 3), td("Lone"), td("LoneDone", { done: true })]), { kind: "compact", ahead: 5 });
    expect(names(m.done)).toEqual(["S1", "S2", "S3", "LoneDone"]);
    expect(cardNames(m)).toEqual(["S4", "S5", "S6", "S7", "S8"]);
    expect(m.map.cards.map(c => c.step)).toEqual([0, 1, 2, 3, 4]);
    expect(names(m.later)).toEqual(["S9", "S10", "S11", "S12"]);
    expect(names(m.loose)).toEqual(["Lone"]);
  });
  it("arrows only join shown cards", () => {
    const m = slideModel(map(chain(8, 2)), { kind: "compact", ahead: 3 });
    expect(m.map.arrows).toEqual([{ from: T + "S3.md", to: T + "S4.md" }, { from: T + "S4.md", to: T + "S5.md" }]);
  });
  it("ahead 1 shows the first open step only; ahead 99 shows every open one", () => {
    expect(cardNames(slideModel(map(chain(6, 2)), { kind: "compact", ahead: 1 }))).toEqual(["S3"]);
    const all = slideModel(map(chain(6, 2)), { kind: "compact", ahead: 99 });
    expect(cardNames(all)).toEqual(["S3", "S4", "S5", "S6"]);
    expect(all.later).toEqual([]);
  });
  it("nothing done: no done tiles; everything done: tiles only", () => {
    expect(slideModel(map(chain(4)), { kind: "compact", ahead: 5 }).done).toEqual([]);
    const m = slideModel(map(chain(4, 4)), { kind: "compact", ahead: 5 });
    expect(m.map.cards).toEqual([]);
    expect(names(m.done)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(m.later).toEqual([]);
  });
  it("no links at all: tiles only, no cards", () => {
    const m = slideModel(map([td("A"), td("B", { done: true })]), { kind: "compact", ahead: 5 });
    expect(m.map.cards).toEqual([]);
    expect(names(m.loose)).toEqual(["A"]);
    expect(names(m.done)).toEqual(["B"]);
  });
  it("places are re-numbered when a done card leaves a step", () => {
    const m = slideModel(map([td("A", { done: true }), td("B"), td("C", { after: "[[A]]" }), td("D", { after: "[[B]]" })]), { kind: "compact", ahead: 5 });
    expect(m.map.cards.map(c => `${c.row.name}:${c.step}.${c.place}`)).toEqual(["B:0.0", "C:1.0", "D:1.1"]);
  });
});

describe("slideModel whole", () => {
  it("every linked to-do is a card, finished ones too; unlinked are tiles", () => {
    const m = slideModel(map([...chain(7, 2), td("Lone")]), { kind: "whole" });
    expect(cardNames(m)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7"]);
    expect(m.map.cards.filter(c => c.row.done)).toHaveLength(2);
    expect(m.done).toEqual([]);
    expect(m.later).toEqual([]);
    expect(names(m.loose)).toEqual(["Lone"]);
  });
});

describe("slideSvg", () => {
  const model = slideModel(map([...chain(8, 2), td("Lone"), td("Fin", { done: true })]), { kind: "compact", ahead: 3 });
  const pic = slideSvg(model, { title: "Alpha" });
  it("is a 16:9 SVG with each shown title once, and nothing active or external", () => {
    expect(pic.svg.startsWith("<svg")).toBe(true);
    expect(pic.svg).toContain('viewBox="0 0 1920 1080"');
    for (const n of ["S3", "S4", "S5", "Lone", "Alpha"]) expect(count(pic.svg, `>${n}<`), n).toBe(1);
    for (const n of ["S1", "S2", "Fin"]) expect(count(pic.svg, `>✓ ${n}<`), n).toBe(1);
    for (const n of ["S6", "S7", "S8"]) expect(count(pic.svg, `>${n}<`), n).toBe(1);   // later tiles
    expect(pic.svg).not.toContain("<script");
    expect(pic.svg).not.toMatch(/href\s*=\s*["']?https?:/i);
    expect(pic.svg).not.toContain("<image");
  });
  it("escapes & < > and quotes in a title", () => {
    const evil = slideModel(map([td('A & <b> "q"'), td("B", { after: '[[A & <b> "q"]]' })]), { kind: "whole" });
    const svg = slideSvg(evil, { title: "P & <Q>" }).svg;
    expect(svg).toContain("P &amp; &lt;Q&gt;");
    expect(svg).toContain("A &amp; &lt;b&gt; &quot;q&quot;");
    expect(svg).not.toContain("<b>");
  });
  it("an empty model is still a valid picture", () => {
    const p = slideSvg(slideModel(map([]), { kind: "compact", ahead: 5 }), { title: "Empty" });
    expect(p.svg.startsWith("<svg")).toBe(true);
    expect(p.svg.endsWith("</svg>")).toBe(true);
  });
  it("too many tiles end in +N more", () => {
    const many = Array.from({ length: 40 }, (_, i) => td(`L${i}`));
    const svg = slideSvg(slideModel(map(many), { kind: "compact", ahead: 5 }), { title: "Alpha" }).svg;
    expect(svg).toMatch(/\+\d+ more</);
    expect(svg).not.toContain(">L39<");
  });
  it("minText falls as ahead grows on a wide plan, and the flag follows the threshold", () => {
    const m = map(chain(14));
    const few = slideSvg(slideModel(m, { kind: "compact", ahead: 3 }), { title: "Alpha" });
    const lots = slideSvg(slideModel(m, { kind: "compact", ahead: 14 }), { title: "Alpha" });
    expect(lots.minText).toBeLessThan(few.minText);
    expect(few.minText).toBeGreaterThanOrEqual(MIN_READABLE);
    expect(few.tooSmall).toBe(false);
    expect(lots.tooSmall).toBe(true);
  });
  it("subtasks: strips under the card (done ones struck), over five the last line says +N more, and the picture grows to fit", () => {
    const subs = (p: string, n: number, done = 0) => Array.from({ length: n }, (_, i) => td(`${p}Sub${i + 1}`, { sub: `[[${p}]]`, ...(i < done ? { done: true } : {}) }));
    const todos = [td("Two"), td("Eight", { after: "[[Two]]" }), ...subs("Two", 2, 1), ...subs("Eight", 8)];
    const model = slideModel(map(todos), { kind: "whole" });
    const svg = slideSvg(model, { title: "Alpha" }).svg;
    expect(count(svg, "○ TwoSub")).toBe(1);
    expect(count(svg, "✓ TwoSub1")).toBe(1);
    expect(count(svg, 'text-decoration="line-through"')).toBe(1);
    expect(count(svg, "○ EightSub")).toBe(4);   // four lines and "+4 more"
    expect(svg).toContain("+4 more");
    expect(svg).not.toContain("EightSub5");
    const plain = slideSvg(slideModel(map([td("Two"), td("Eight", { after: "[[Two]]" })]), { kind: "whole" }), { title: "Alpha" });
    const withSubs = slideSvg(model, { title: "Alpha" });
    expect(withSubs.minText).toBeLessThanOrEqual(plain.minText);   // the strips are scaled with the cards, so the reported smallest text still counts them
  });
});
