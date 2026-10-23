// The open-work model of a big project (src/planning/plan-open.ts): open chips in steps, loose row, counts. Known answers: docs/plans/plan-map-export.md "Big projects".
import { describe, it, expect } from "vitest";
import { readPlan } from "../src/planning/plan";
import { layoutPlan } from "../src/planning/plan-map";
import { ARROW_TAIL, CHIP_CAP, COUNT_H, FOLD_ID, chooseLayout, MIN_CHARS, OPEN_FONT, SECOND_LINE_MAX, chipSize, chipWidth, foldOpen, moreId, moreLines, openBudget, openGeometry, openModel, rowHeights } from "../src/planning/plan-open";
import type { MapGeometry } from "../src/planning/plan-map";
import type { FoldedOpen, OpenModel } from "../src/planning/plan-open";
import type { OpenChip } from "../src/planning/plan-open";
import { MIN_READABLE } from "../src/planning/plan-slide";
import type { NoteRec } from "../src/planning/lists";
import { BIG_HUB, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const lab = (name: string, Status: string): NoteRec => note(`05 Lab/${name}.md`, { Status });
const model = (todos: NoteRec[], today = "2026-10-20", labs?: NoteRec[]) => openModel(readPlan(todos, hub, labs), today);
const chipOf = (m: ReturnType<typeof openModel>, name: string) => [...m.chips, ...m.loose].find(c => c.name === name);

const big = openModel(readPlan(BIG_TODOS, BIG_HUB), BIG_TODAY);

describe("openModel: the made-up 59 to-do project (known answers)", () => {
  it("24 open, 21 linked in 9 steps by 6 places, 3 loose", () => {
    expect(big.counts.open).toBe(24);
    expect(big.chips).toHaveLength(21);
    expect(big.counts.steps).toBe(9);
    expect(big.counts.places).toBe(6);   // columns: places 0-5 are used (step 1 has 5 chips in places 1-5)
    expect(Math.max(...big.chips.map(c => c.place))).toBe(5);
    expect(big.loose).toHaveLength(3);
  });
  it("late 2, waiting 2, can start 5, later 15", () => {
    const { late, waiting, canStart, later } = big.counts;
    expect([late, waiting, canStart, later]).toEqual([2, 2, 5, 15]);
  });
  it("35 of 59 done", () => {
    expect(big.counts.done).toBe(35);
    expect(big.counts.total).toBe(59);
  });
  it("late and waiting shows as late", () => expect(chipOf(big, "Book GPC time for diblocks")?.status).toBe("late"));
  it("drawn + counted = open, and the statuses add up to open", () => {
    const { open, drawn, late, waiting, canStart, later } = big.counts;
    expect(big.chips.length + big.loose.length).toBe(drawn);
    expect(drawn + (open - drawn)).toBe(open);
    expect(drawn).toBe(open);
    expect(late + waiting + canStart + later).toBe(open);
  });
  it("no subtask becomes a chip, and no finished to-do", () => {
    const subs = new Set(readPlan(BIG_TODOS, BIG_HUB).rows.filter(r => r.parent).map(r => r.path));
    const done = new Set(readPlan(BIG_TODOS, BIG_HUB).rows.filter(r => r.done).map(r => r.path));
    for (const c of [...big.chips, ...big.loose]) { expect(subs.has(c.path)).toBe(false); expect(done.has(c.path)).toBe(false); }
  });
  it("a finished blocker never makes a chip later: Run kinetics at 70 C can start", () => expect(chipOf(big, "Run kinetics at 70 C")?.status).toBe("ready"));
  it("arrows join chips only", () => {
    const paths = new Set(big.chips.map(c => c.path));
    for (const a of big.arrows) { expect(paths.has(a.from)).toBe(true); expect(paths.has(a.to)).toBe(true); }
  });
});

describe("openModel: rules", () => {
  it("a to-do whose only blocker is finished can start", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[B]]"] })]);
    expect(chipOf(m, "B")?.status).toBe("ready");
    expect(chipOf(m, "C")?.status).toBe("later");
  });
  it("steps count open work: B and C are steps 0 and 1, A is not drawn", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[B]]"] })]);
    expect(m.chips.map(c => [c.name, c.step])).toEqual([["B", 0], ["C", 1]]);
    expect(chipOf(m, "A")).toBeUndefined();
  });
  it("a to-do linked only to finished work is loose", () => {
    const m = model([td("A", { done: true }), td("B", { after: ["[[A]]"] })]);
    expect(m.chips).toHaveLength(0);
    expect(m.loose.map(c => c.name)).toEqual(["B"]);
  });
  it("late wins over waiting", () => expect(chipOf(model([td("A", { due: "2026-10-15", waiting: "facility" })]), "A")?.status).toBe("late"));
  it("loose sorted by urgency, then name", () => {
    const m = model([td("Zed"), td("Late", { due: "2026-10-01" }), td("Wait", { waiting: "x" }), td("Alpha")]);
    expect(m.loose.map(c => c.name)).toEqual(["Late", "Wait", "Alpha", "Zed"]);
  });
  it("subtasks hang under their parent, never as chips; a link through a subtask joins the parents", () => {
    const m = model([td("P"), td("S", { sub: "[[P]]" }), td("Q", { after: ["[[S]]"] })]);
    expect(m.chips.map(c => c.name)).toEqual(["P", "Q"]);
    expect(chipOf(m, "P")?.subs.map(s => s.name)).toEqual(["S"]);
    expect(m.arrows).toEqual([{ from: T + "P.md", to: T + "Q.md", via: T + "S.md" }]);
    expect(m.counts.open).toBe(2);
  });
  it("second line only on late, waiting and can-start chips, cut with …", () => {
    const labs = [lab("ABC0014", "Started"), lab("ABC0015-A long name", "Processing results")];
    const m = model([
      td("A", { experiment: "[[ABC0014]]" }),
      td("B", { experiment: "[[ABC0014]]", after: ["[[A]]"] }),
      td("C", { experiment: "[[ABC0015-A long name]]", due: "2026-10-01" }),
      td("D"),
    ], "2026-10-20", labs);
    expect(chipOf(m, "A")?.line).toBe("ABC0014 · Started");
    expect(chipOf(m, "B")?.line).toBe("");
    const c = chipOf(m, "C")!.line;
    expect(c.length).toBe(SECOND_LINE_MAX);
    expect(c.endsWith("…")).toBe(true);
    expect(chipOf(m, "D")?.line).toBe("");
  });
  it("an empty plan gives zero counts", () => {
    const m = model([]);
    expect(m.counts).toMatchObject({ open: 0, drawn: 0, steps: 0, places: 0, done: 0, total: 0 });
  });
});

describe("chipSize: chip width from places, height from content (M1-2)", () => {
  const chip = (o: Partial<OpenChip> = {}): OpenChip => ({ path: "x.md", name: "Run kinetics at 70 C", status: "ready", step: 0, place: 0, line: "", subs: [], ...o });
  const subs = (n: number, done = 0) => Array.from({ length: n }, (_, i) => ({ path: `s${i}.md`, name: `Subtask ${i + 1}`, done: i < done }));
  it("no chip is under 19 characters a line, whatever the places (capped at 6; owner board 6 Q2 a)", () => {
    expect(MIN_CHARS).toBe(19);
    for (let p = 1; p <= 30; p++) expect(chipSize(chip(), p).chars).toBeGreaterThanOrEqual(MIN_CHARS);
    expect(chipWidth(6)).toBe(259);
    expect(chipWidth(12)).toBe(chipWidth(CHIP_CAP));
    expect(chipSize(chip(), 6).chars).toBe(19);
    expect(SECOND_LINE_MAX).toBe(19);
  });
  it("every text is 22 px or more (MIN_READABLE)", () => {
    expect(OPEN_FONT).toBeGreaterThanOrEqual(MIN_READABLE);
    expect(chipSize(chip({ subs: subs(9) }), 6).font).toBeGreaterThanOrEqual(MIN_READABLE);
  });
  it("a chip with subtasks is taller than the same chip without", () => {
    expect(chipSize(chip({ subs: subs(2) }), 6).height).toBeGreaterThan(chipSize(chip(), 6).height);
    expect(chipSize(chip({ subs: subs(4) }), 6).height).toBeGreaterThan(chipSize(chip({ subs: subs(2) }), 6).height);
  });
  it("name up to 2 lines, cut with …; the second line adds a line", () => {
    const long = chipSize(chip({ name: "A very long to-do name that will never fit on two short lines of a chip" }), 6);
    expect(long.name).toHaveLength(2);
    expect(long.name[1].endsWith("…")).toBe(true);
    for (const l of long.name) expect(l.length).toBeLessThanOrEqual(long.chars);
    expect(chipSize(chip({ line: "ABC0014 · Started" }), 6).height).toBeGreaterThan(chipSize(chip(), 6).height);
  });
  it("subtask lines up to 4, the 4th says +N more when there are more; done ones ticked", () => {
    const four = chipSize(chip({ subs: subs(4, 1) }), 6).subs;
    expect(four.map(l => l.text)).toEqual(["✓ Subtask 1", "○ Subtask 2", "○ Subtask 3", "○ Subtask 4"]);
    expect(four[0].done).toBe(true);
    const nine = chipSize(chip({ subs: subs(9) }), 6).subs;
    expect(nine).toHaveLength(4);
    expect(nine[3]).toMatchObject({ text: "+6 more", more: true });
    expect(chipSize(chip({ subs: subs(9) }), 6).height).toBe(chipSize(chip({ subs: subs(4) }), 6).height);
  });
  it("a row is as tall as its tallest chip", () => {
    const h = rowHeights([chip(), chip({ subs: subs(3), place: 1 }), chip({ step: 1 })], 6);
    expect(h).toEqual([chipSize(chip({ subs: subs(3) }), 6).height, chipSize(chip(), 6).height]);
  });
});

describe("foldOpen: what is drawn in 1920 × 1080 (M1-2; known answers in docs/plans/plan-map-export.md)", () => {
  const bare = (m: OpenModel): OpenModel => ({ ...m, chips: m.chips.map(c => ({ ...c, subs: [] })) });
  const addsUp = (m: OpenModel, f: FoldedOpen): void => {
    const { open, drawn, inStep, folded, looseMore } = f.counts;
    expect(drawn + inStep + folded + looseMore).toBe(open);
    expect(f.steps.reduce((n, s) => n + s.chips.length + (s.more?.n ?? 0), 0) + (f.fold?.chips ?? 0)).toBe(m.chips.length);
    expect(f.loose.chips.length + (f.loose.more?.n ?? 0)).toBe(m.loose.length);
  };
  const T2 = "00 Planning/To-dos/";
  const extra = Array.from({ length: 30 }, (_, i) => note(`${T2}Misc task ${i + 1}.md`, { kind: "todo", project: "[[Block copolymer library]]" }));
  it("the fixture: 4 of 9 steps drawn with its subtasks, 6 without; the rest is one count row", () => {
    const f = foldOpen(big), g = foldOpen(bare(big));
    expect(openBudget(big)).toBe(770);
    expect(f.steps.map(s => s.step)).toEqual([0, 1, 2, 3]);
    expect(f.fold).toMatchObject({ n: 7, chips: 7, late: 0, waiting: 1, text: "+5 more steps: 1 waiting" });
    expect(g.steps).toHaveLength(6);
    expect(g.fold?.text).toBe("+3 more steps: 1 waiting");
    expect(f.height).toBeLessThanOrEqual(770);
    expect(g.height).toBeLessThanOrEqual(770);
    expect(f.places).toBe(6);
    expect(f.width).toBe(259);
  });
  it("subtasks make rows taller, so the project with them folds earlier", () => {
    expect(foldOpen(big).steps.length).toBeLessThan(foldOpen(bare(big)).steps.length);
  });
  it("drawn + counted = open, for the steps and the loose row", () => {
    addsUp(big, foldOpen(big));
    addsUp(bare(big), foldOpen(bare(big)));
    const many = openModel(readPlan([...BIG_TODOS, ...extra], BIG_HUB), BIG_TODAY);
    addsUp(many, foldOpen(many));
    for (const b of [0, 100, 300, 2000]) addsUp(big, foldOpen(big, b));
  });
  it("the first step is always drawn, however small the budget", () => {
    const f = foldOpen(big, 0);
    expect(f.steps.map(s => s.step)).toEqual([0]);
    expect(f.fold?.text).toBe("+8 more steps: 2 waiting");   // both late ones are in step 0 or loose
  });
  it("everything fits: no count row", () => {
    const f = foldOpen(big, 5000);
    expect(f.steps).toHaveLength(9);
    expect(f.fold).toBeNull();
    expect(f.arrows).toHaveLength(big.arrows.length);
  });
  it("no arrow ends at the count row: arrows only between drawn chips (owner, arrows option D, 2026-10-21)", () => {
    const f = foldOpen(big);
    const drawn = new Set(f.steps.flatMap(s => s.chips.map(c => c.path)));
    for (const a of f.arrows) { expect(drawn.has(a.from)).toBe(true); expect(drawn.has(a.to)).toBe(true); }
    expect(f.arrows.some(a => a.to === FOLD_ID || a.from === FOLD_ID)).toBe(false);
    expect(f.arrows).toHaveLength(12);
  });
  it("loose row: as many chips as fit on one line, then the count chip (30 extra loose to-dos: 6 and +27)", () => {
    const many = openModel(readPlan([...BIG_TODOS, ...extra], BIG_HUB), BIG_TODAY);
    const f = foldOpen(many);
    expect(f.loose.chips).toHaveLength(6);
    expect(f.loose.more?.text).toBe("+27 more not linked");
    expect(foldOpen(big).loose.chips).toHaveLength(3);
    expect(foldOpen(big).loose.more).toBeNull();
    expect(model([td("Late", { due: "2026-10-01" }), ...Array.from({ length: 12 }, (_, i) => td(`Long loose to-do name number ${i}`))]).loose.length).toBe(13);
    const late = foldOpen(model([...Array.from({ length: 12 }, (_, i) => td(`Long loose to-do name number ${i}`)), td("Zz late", { due: "2026-10-01" }), td("Zz wait late", { due: "2026-10-01" })]));
    expect(late.loose.chips.slice(0, 2).map(c => c.name)).toEqual(["Zz late", "Zz wait late"]);
    expect(late.loose.more?.text).toMatch(/^\+\d+ more not linked$/);
  });
  it("more than 6 places: a step keeps its 5 most urgent and a +N more in this step chip; arrows to the hidden end there", () => {
    const kids = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];
    const m = model([td("Root"), ...kids.map((k, i) => td(k, { after: ["[[Root]]"], ...(i >= 6 ? { due: "2026-10-01" } : {}) })), td("Tail", { after: ["[[K1]]"] })]);
    expect(m.counts.places).toBe(8);
    const f = foldOpen(m, 5000);
    expect(f.places).toBe(CHIP_CAP);
    const s1 = f.steps[1];
    expect(s1.chips).toHaveLength(5);
    expect(s1.chips.map(c => c.name)).toEqual(expect.arrayContaining(["K7", "K8"]));   // the late ones are kept
    expect(s1.chips.map(c => c.place)).toEqual([0, 1, 2, 3, 4]);
    expect(s1.more).toMatchObject({ n: 3, text: "+3 more in this step" });
    expect(f.arrows.filter(a => a.to === moreId(1))).toHaveLength(1);
    addsUp(m, f);
    for (const s of f.steps) for (const c of s.chips) expect(chipSize(c, f.places).chars).toBeGreaterThanOrEqual(MIN_CHARS);
  });
});

describe("openGeometry: chips down, arrows through lanes (M1-3; numbers in docs/plans/plan-map-export.md Phase M1-3)", () => {
  type Box = { x: number; y: number; w: number; h: number };
  const boxes = (f: FoldedOpen, g: MapGeometry): Map<string, Box> => {
    const h = new Map<string, number>();
    for (const s of f.steps) { for (const c of s.chips) h.set(c.path, chipSize(c, f.places).height); if (s.more) h.set(moreId(s.step), 2 * 10 + moreLines(s.more.text, f.places).length * 28); }
    if (f.fold) h.set(FOLD_ID, COUNT_H);
    return new Map([...g.pos].map(([p, q]) => [p, { ...q, w: f.width, h: h.get(p)! }]));
  };
  /** Sampled points of an arrow inside a chip it does not start or end at. */
  const crossings = (f: FoldedOpen, g: MapGeometry): string[] => {
    const out: string[] = [];
    for (const c of g.curves) for (const [p, b] of boxes(f, g)) {
      if (p === c.from || p === c.to) continue;
      if (c.samples.some(q => q.x > b.x && q.x < b.x + b.w && q.y > b.y && q.y < b.y + b.h)) out.push(`${c.from} → ${c.to} crosses ${p}`);
    }
    return out;
  };
  /** Pairs of routed arrows whose lane parts lie on one line (same x, overlapping in y). */
  const sharedLanes = (g: MapGeometry): number => {
    const lanes = g.curves.filter(c => c.routed).map(c => { const l = c.samples.slice(13, 26); return { x: l[0].x, y0: Math.min(...l.map(q => q.y)), y1: Math.max(...l.map(q => q.y)) }; });
    let n = 0;
    for (let i = 0; i < lanes.length; i++) for (let j = i + 1; j < lanes.length; j++) if (Math.abs(lanes[i].x - lanes[j].x) < 0.5 && lanes[i].y0 < lanes[j].y1 && lanes[j].y0 < lanes[i].y1) n++;
    return n;
  };
  const path = (name: string): string => big.chips.find(c => c.name === name)!.path;
  it("the fixture as folded (4 of 9 steps): picture height = the fold's height, places across 6 × 259 px", () => {
    const f = foldOpen(big), g = openGeometry(f);
    expect(g.height).toBe(f.height);
    expect(g.height).toBe(194 + 76 + 166 + 76 + 3 * 36 + 36 + COUNT_H);   // 704 of the 770 px budget
    expect(g.width).toBe(6 * 259 + 5 * 24);
    for (const s of f.steps) for (const c of s.chips) expect(g.pos.get(c.path)).toEqual({ x: c.place * (259 + 24), y: [0, 194 + 36, 194 + 76 + 72, 194 + 76 + 166 + 108][s.step] });
    expect(g.pos.get(FOLD_ID)).toEqual({ x: 0, y: 194 + 76 + 166 + 76 + 4 * 36 });
    expect(g.curves).toHaveLength(f.arrows.length);
  });
  it("the count row is placed but no arrow goes into it (option D)", () => {
    const f = foldOpen(big), g = openGeometry(f);
    expect(g.pos.get(FOLD_ID)).toBeTruthy();
    expect(g.curves.filter(c => c.to === FOLD_ID)).toEqual([]);
  });
  it("no sampled point of any arrow lies inside a chip it does not start or end at (folded, all 9 steps, without subtasks)", () => {
    for (const f of [foldOpen(big), foldOpen(big, 5000), foldOpen({ ...big, chips: big.chips.map(c => ({ ...c, subs: [] })) })]) expect(crossings(f, openGeometry(f))).toEqual([]);
    for (let b = 0; b <= 2000; b += 50) expect(crossings(foldOpen(big, b), openGeometry(foldOpen(big, b)))).toEqual([]);
  });
  it("GPC of diblocks → Scale up diblock to 5 g (all 9 steps drawn) crosses no chip", () => {
    const f = foldOpen(big, 5000), g = openGeometry(f);
    const c = g.curves.find(c => c.from === path("GPC of diblocks") && c.to === path("Scale up diblock to 5 g"));
    expect(c).toBeTruthy();
    expect(crossings(f, { ...g, curves: [c!] })).toEqual([]);
  });
  it("two routed arrows never share a lane line; the routed counts", () => {
    const all9 = openGeometry(foldOpen(big, 5000)), folded = openGeometry(foldOpen(big));
    expect(sharedLanes(all9)).toBe(0);
    expect(sharedLanes(folded)).toBe(0);
    // the fixture needs no routing: every arrow joins neighbouring steps or runs past no chip
    expect([all9.curves.filter(c => c.routed).length, all9.curves.length]).toEqual([0, 23]);
    expect([folded.curves.filter(c => c.routed).length, folded.curves.length]).toEqual([0, 12]);
    expect(all9.height).toBe(1276);   // all 9 steps: taller than the 770 px budget, which is why the fold draws 4
  });
  it("many arrows skipping steps in one column: each routed through a lane on a line of its own, crossing no chip", () => {
    const chain = ["A", "B", "C", "D", "E"];
    const skips: [string, string][] = [["Root", "B"], ["Root", "C"], ["Root", "D"], ["Root", "E"], ["A", "C"], ["A", "D"], ["B", "D"]];
    const m = model([td("Root"), ...chain.map((n, i) => td(n, { after: [i ? `[[${chain[i - 1]}]]` : "[[Root]]", ...skips.filter(s => s[1] === n).map(s => `[[${s[0]}]]`)] }))]);
    const f = foldOpen(m, 5000), g = openGeometry(f);
    expect(f.steps).toHaveLength(6);
    expect(g.curves.filter(c => c.routed)).toHaveLength(7);
    expect(sharedLanes(g)).toBe(0);
    expect(crossings(f, g)).toEqual([]);
    expect(new Set(g.curves.filter(c => c.routed).map(c => c.samples[13].x))).toEqual(new Set([-12, -9, -15, -6, -18, 1686, 1689]));   // 5 lines left of the one column (0, ±3, ±6), then 2 right of it (one place: chips 1674 px)
  });
  it("every arrow ends in a straight drop at least as long as its head, so the head sits on the line (owner board 6, rows 36 px apart)", () => {
    const chain = ["A", "B", "C", "D"];
    const m = model([td("Root"), ...chain.map((n, i) => td(n, { after: [i ? `[[${chain[i - 1]}]]` : "[[Root]]", ...(i >= 2 ? ["[[Root]]"] : [])] }))]);
    for (const f of [foldOpen(big), foldOpen(big, 5000), foldOpen(m, 5000)]) {
      const g = openGeometry(f);
      expect(g.curves.length).toBeGreaterThan(0);
      for (const c of g.curves) {
        const end = c.samples.at(-1)!, before = c.samples.at(-2)!;
        expect(before.x).toBe(end.x);
        expect(end.y - before.y).toBeGreaterThanOrEqual(ARROW_TAIL);
        expect(c.d.endsWith(` L${end.x} ${end.y}`)).toBe(true);
      }
      expect(crossings(f, g)).toEqual([]);
    }
    expect(openGeometry(foldOpen(m, 5000)).curves.filter(c => c.routed).length).toBeGreaterThan(0);
    expect(ARROW_TAIL).toBeGreaterThanOrEqual(15);   // the head: markerWidth 6 × stroke 2.5
  });
  it("a step's more chip sits in the last place, and an arrow into it ends at its top edge", () => {
    const kids = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];
    const m = model([td("Root"), ...kids.map((k, i) => td(k, { after: ["[[Root]]"], ...(i >= 6 ? { due: "2026-10-01" } : {}) })), td("Tail", { after: ["[[K1]]"] })]);
    const f = foldOpen(m, 5000), g = openGeometry(f);
    const more = g.pos.get(moreId(1))!;
    expect(more.x).toBe((CHIP_CAP - 1) * (f.width + 24));
    const into = g.curves.find(c => c.to === moreId(1))!;
    expect(into.samples.at(-1)).toEqual({ x: more.x + f.width / 2, y: more.y });
    expect(crossings(f, g)).toEqual([]);
  });
});

describe("chooseLayout: full map while its text is readable, else the open work (M1-2)", () => {
  const mapOf = (todos: NoteRec[]) => layoutPlan(readPlan(todos, hub));
  it("the 59 to-do fixture gets the open-work picture", () => expect(chooseLayout(layoutPlan(readPlan(BIG_TODOS, BIG_HUB)))).toBe("open-work"));
  it("a 6-card project keeps the full map", () => {
    const m = mapOf([td("A", { done: true }), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[A]]"] }), td("D", { after: ["[[B]]"] }), td("E", { after: ["[[C]]", "[[D]]"] }), td("F", { after: ["[[E]]"] })]);
    expect(m.cards).toHaveLength(6);
    expect(chooseLayout(m)).toBe("full-map");
  });
  it("a small project that is all open stays on the full map", () => {
    const m = mapOf([td("A"), td("B", { after: ["[[A]]"] }), td("C", { after: ["[[B]]"] }), td("D")]);
    expect(m.cards.every(c => !c.row.done)).toBe(true);
    expect(chooseLayout(m)).toBe("full-map");
  });
});
