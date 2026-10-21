// The slide picture of a plan (src/planning/plan-slide.ts): which to-dos are cards and which tiles, and the SVG.
import { describe, it, expect } from "vitest";
import { layoutPlan } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import { MIN_READABLE, openSvg, slideModel, slideSvg } from "../src/planning/plan-slide";
import { foldOpen, openGeometry, openModel } from "../src/planning/plan-open";
import type { NoteRec } from "../src/planning/lists";
import { BIG_HUB, BIG_TITLE, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";

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

describe("openSvg: the open-work picture (M1-4; numbers in docs/plans/plan-map-export.md Phase M1-4)", () => {
  const T2 = "00 Planning/To-dos/";
  const bigTd = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(`${T2}${name}.md`, { kind: "todo", project: `[[${BIG_TITLE}]]`, ...fm });
  const extra = Array.from({ length: 30 }, (_, i) => bigTd(`Misc task ${i + 1}`));
  const open = (todos: NoteRec[], today = BIG_TODAY) => openModel(readPlan(todos, BIG_HUB), today);
  const draw = (todos: NoteRec[]) => openSvg(open(todos), { title: BIG_TITLE, today: BIG_TODAY });
  type Box = { x: number; y: number; w: number; h: number };
  /** Every positioned rect but the background and the progress bar (the key's marks sit in groups and have no x). */
  const rects = (svg: string): Box[] => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/>/g)]
    .map(m => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) })).filter(b => b.h !== 14);
  const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const keyTop = 1080 - 48 - 24;
  const fixture = draw(BIG_TODOS);

  it("the fixture: 1920 × 1080, every text 22 px or more, 16 arrows, 18 boxes (14 chips in 4 steps, the count row, 3 loose)", () => {
    expect(fixture.svg).toContain('viewBox="0 0 1920 1080"');
    expect(fixture.minText).toBeGreaterThanOrEqual(MIN_READABLE);
    expect(fixture.tooSmall).toBe(false);
    const sizes = [...fixture.svg.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_READABLE);
    const f = foldOpen(open(BIG_TODOS));
    expect(count(fixture.svg, 'marker-end="url(#head)"')).toBe(openGeometry(f).curves.length);
    expect(openGeometry(f).curves).toHaveLength(16);
    expect(rects(fixture.svg)).toHaveLength(14 + 1 + 3);   // 14 chips in 4 steps, the count row, 3 loose chips
    expect(fixture.svg).toContain("+5 more steps: 1 waiting");
    expect(fixture.svg).toContain("Not linked to other open work (3):");
    expect(fixture.svg).toContain(">can start<");
    expect(fixture.svg).toContain(">then +3<");
    expect(fixture.svg).toContain(">Fit rate<");   // chip names break at a space, not mid-word ("Fit rate constant" / "s")
    expect(fixture.svg).toContain(">constants<");
    expect(fixture.svg).toContain("35 of 59 done");
    expect(fixture.svg).toContain("as of Tue 20 Oct 2026");
  });
  it("nothing overlaps: boxes apart, steps under the header, the loose row under the steps, everything above the key", () => {
    for (const pic of [fixture, draw([...BIG_TODOS, ...extra])]) {
      const b = rects(pic.svg);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(overlap(b[i], b[j]), JSON.stringify([b[i], b[j]])).toBe(false);
      for (const r of b) { expect(r.y).toBeGreaterThanOrEqual(130); expect(r.y + r.h).toBeLessThanOrEqual(keyTop); expect(r.x + r.w).toBeLessThanOrEqual(1920 - 48); expect(r.x).toBeGreaterThanOrEqual(48); }
      const label = Number(/<text x="48" y="([\d.]+)"[^>]*>Not linked to other open work/.exec(pic.svg)![1]);
      const steps = b.filter(r => r.y < label);
      expect(Math.max(...steps.map(r => r.y + r.h))).toBeLessThanOrEqual(label - 22);
      expect(b.filter(r => r.y > label).every(r => r.y >= label + 6)).toBe(true);
    }
  });
  it("30 extra loose to-dos: 5 loose chips and the +28 count chip, text still 22 px", () => {
    const pic = draw([...BIG_TODOS, ...extra]);
    expect(pic.minText).toBeGreaterThanOrEqual(MIN_READABLE);
    expect(pic.svg).toContain("+28 more not linked");
    expect(pic.svg).toContain("Not linked to other open work (33):");
    expect(rects(pic.svg)).toHaveLength(14 + 1 + 5 + 1);
  });
  it("a chip with 12 subtasks shows 3 and +9 more (done struck); a 120-character name is cut on 2 lines; text 22 px", () => {
    const long = "A very long to-do name ".repeat(6).slice(0, 120);
    const subs = Array.from({ length: 12 }, (_, i) => bigTd(`Sub ${"ABCDEFGHIJKL"[i]}`, { sub: "[[Twelve]]", ...(i === 0 ? { done: true } : {}) }));
    const kids = ["K1", "K2", "K3", "K4", "K5"].map(k => bigTd(k, { after: ["[[Twelve]]"] }));   // 6 places: the long name sits in a 259 px chip
    const pic = draw([bigTd("Twelve"), bigTd(long, { after: ["[[Twelve]]"] }), ...kids, ...subs]);
    expect(pic.minText).toBeGreaterThanOrEqual(MIN_READABLE);
    expect(pic.svg).toContain("✓ Sub A");
    expect(pic.svg).toContain("○ Sub C");
    expect(pic.svg).not.toContain("Sub D<");
    expect(pic.svg).toContain("+9 more");
    expect(count(pic.svg, 'text-decoration="line-through"')).toBe(1);
    expect(pic.svg).not.toContain(long);
    expect(pic.svg).toContain("…");
    const b = rects(pic.svg);
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(overlap(b[i], b[j])).toBe(false);
  });
  it("texts are escaped (title, names, subtasks, the second line)", () => {
    const pic = openSvg(open([bigTd("A <b> & \"c\""), bigTd("Then 'd'", { after: ['[[A <b> & "c"]]'] })]), { title: "Q&A <x>", today: BIG_TODAY });
    expect(pic.svg).toContain("Q&amp;A &lt;x&gt;");
    expect(pic.svg).toContain("A &lt;b&gt; &amp; &quot;c&quot;");
    expect(pic.svg).toContain("Then &#39;d&#39;");
    expect(pic.svg).not.toContain("<b>");
    expect(pic.svg).not.toContain("<x>");
  });
  it("the key lists only the marks used and says late and waiting in words; with a late-and-waiting chip it says late wins (Q5 a)", () => {
    expect(fixture.svg).toContain(">late (wins over waiting)<");
    expect(fixture.svg).toContain(">waiting on someone<");
    expect(fixture.svg).toContain(">can start<");
    expect(fixture.svg).toContain(">waits for an earlier step<");
    expect(fixture.svg).not.toContain(">done<");   // finished work is only the header's count
    const plain = openSvg(open([bigTd("One"), bigTd("Two", { after: ["[[One]]"] })]), { title: "x", today: BIG_TODAY }).svg;
    expect(plain).toContain(">waits for an earlier step<");
    expect(plain).not.toContain(">late<");
    expect(plain).not.toContain("waiting on someone");
    const lateOnly = openSvg(open([bigTd("One", { due: "2026-10-01" }), bigTd("Two", { after: ["[[One]]"], waiting: "Sam" })]), { title: "x", today: BIG_TODAY }).svg;
    expect(lateOnly).toContain(">late<");
    expect(lateOnly).toContain(">waiting on someone<");
  });
  it("chip borders: late and waiting in their colours, can start blue, later dashed grey; a late-and-waiting chip is drawn late; no corner dot", () => {
    expect(fixture.svg).toMatch(/stroke="#b3124f"[^>]*\/><text[^>]*>Book GPC time for<\/text>/);
    expect(fixture.svg).not.toMatch(/stroke="#c77700"[^>]*\/><text[^>]*>Book GPC time for<\/text>/);
    expect(fixture.svg).toContain('stroke="#1f6feb"');
    const wait = openSvg(open([bigTd("One", { waiting: "Sam" }), bigTd("Two", { after: ["[[One]]"] })]), { title: "x", today: BIG_TODAY }).svg;
    expect(wait).toMatch(/stroke="#c77700"[^>]*\/><text[^>]*>One<\/text>/);
    expect(fixture.svg).toContain('stroke-dasharray="6 4"');
    expect(fixture.svg).not.toContain("<circle");
  });
});
