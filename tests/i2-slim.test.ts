// I2 Phase 1 check on the old-style fixture vault (tests/fixtures/i2-old-vaults/): the slim model's board (buildWeek, src/) against the
// plan's earlier measured model (tests/helpers/i2-model.ts placeI2), and normalising every note leaves the board as it was.
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { buildWeek, weekCardOf, type WeekBoard } from "../src/planning/board-card";
import { applyPatch, isFinishedTodo, normalisePatch, parseDay, weekdayOf, WEEKDAYS, ymd } from "../src/planning/todo";
import { thisWeek } from "../src/planning/lists";
import { readPlan } from "../src/planning/plan";
import { loadVault, todoNotes } from "./helpers/i2-vault";
import { DATES, placeI2, placeText } from "./helpers/i2-model";
import type { NoteRec } from "../src/planning/lists";

const notes = todoNotes(loadVault("vault"));
const board = (ns: NoteRec[], now: Date): WeekBoard =>
  buildWeek(ns.map(n => weekCardOf({ path: n.path, title: n.name, fm: n.fm }, "off", now)), { series: [], todos: [], hubs: [] }, { weekend: false, busyFrom: 6, countdown: "off", now });
/** Where a note is drawn, in placeText's words (`Wed*`, `tray [..]`, `done@Mon`, `hidden`). */
function where(b: WeekBoard, name: string): string {
  for (const c of b.days) {
    const o = c.open.find(x => x.title === name);
    if (o) return c.day + (o.carried ? "*" : "");
    if (c.finished.some(x => x.title === name)) return `done@${c.day}`;
  }
  const t = b.tray.find(x => x.title === name);
  return t ? (t.pill ? `tray [${t.pill}]` : "tray") : "hidden";
}
const asModel = (p: string): string => (p.startsWith("hidden") ? "hidden" : p);
/** Where the slim model differs from the earlier model on purpose: Q17 a, a Sat / Sun `day` is read as a date (the earlier model left it undated). */
const DIFFER: Record<string, Record<string, string>> = {
  wed: { "Weekend Sat planned": "tray [Sat 24 Oct]", "Weekend Sun planned": "tray [Sun 25 Oct]" },
  sat: { "Weekend Sat planned": "tray [Sat 24 Oct]", "Weekend Sun planned": "tray [Sun 25 Oct]" },
  mon: { "Weekend Sat planned": "Mon*", "Weekend Sun planned": "Mon*" },
};

describe("I2 slim model on the old-style fixture vault", () => {
  it("the fixture has its 35 to-dos", () => { expect(notes.length).toBe(35); });
  for (const [key, now] of Object.entries(DATES)) {
    it(`${key}: every card where the plan expects it, with nothing written`, () => {
      const b = board(notes, now);
      const got = Object.fromEntries(notes.map(n => [n.name, where(b, n.name)]));
      const want = Object.fromEntries(notes.map(n => [n.name, DIFFER[key][n.name] ?? asModel(placeText(placeI2(n.fm, now)))]));
      expect(got).toEqual(want);
    });
  }
  it("Saturday: carried cards stay under Mon (Q15), none in a weekend tray slot", () => {
    const b = board(notes, DATES.sat);
    expect(b.days[0].open.filter(c => c.carried).length).toBeGreaterThan(0);
    expect(b.days.slice(1).every(c => c.open.every(x => !x.carried))).toBe(true);
  });
  it("normalising every note on Wed (on arrival or by the Tidy rule): the same board Wed and Sat; next Mon only the 4 cards of the plan's Q9 finding", () => {
    const run = DATES.wed;
    const normal = notes.map(n => { const fm = { ...n.fm }; const p = normalisePatch(fm, run); if (p) applyPatch(fm, p); return { ...n, fm }; });
    const diff = (now: Date): Record<string, string> => {
      const before = board(notes, now), after = board(normal, now), out: Record<string, string> = {};
      for (const n of notes) { const a = where(before, n.name), b = where(after, n.name); if (a !== b) out[n.name] = `${a} → ${b}`; }
      return out;
    };
    expect(diff(DATES.wed)).toEqual({});
    expect(diff(DATES.sat)).toEqual({});
    // "Existing vaults" section 2: a card with no `planned` floats until dated; dated on Wed, it is carried over next Monday
    expect(diff(DATES.mon)).toEqual({
      "Mon no planned": "Mon → Mon*", "Wed no planned": "Wed → Mon*", "Fri no planned": "Fri → Mon*",
      "Done no done_on old week": "done@Mon → hidden",
    });
  });
  it("after normalising: no old keys, no empty values, unknown days kept, and a second run writes nothing", () => {
    const run = DATES.wed;
    for (const n of notes) {
      const fm = { ...n.fm };
      const p = normalisePatch(fm, run);
      if (p) applyPatch(fm, p);
      expect(normalisePatch(fm, run), n.name).toBeNull();
      for (const k of ["planned", "rolled", "countdown"]) expect(k in fm, `${n.name}: ${k}`).toBe(false);
      if (typeof n.fm.day === "string" && [...WEEKDAYS, "Backlog", "Done"].includes(n.fm.day as never)) expect("day" in fm, n.name).toBe(false);
    }
    const typo = notes.find(n => n.name === "Day typo")!;
    const fm = { ...typo.fm }; applyPatch(fm, normalisePatch(fm, run) ?? { set: {}, remove: [] });
    expect(fm.day).toBe(typo.fm.day);
  });
});

// I2 Phase 3: Home "This week" and the project plan read the same dates as the board.
describe("I2 Phase 3: Home This week lists what buildWeek puts in this week's columns; plan rows done = isFinishedTodo", () => {
  const all = loadVault("vault");
  const normalised = notes.map(n => { const fm = { ...n.fm }; const p = normalisePatch(fm, DATES.wed); if (p) applyPatch(fm, p); return { ...n, fm }; });
  for (const [label, now] of Object.entries(DATES)) {
    for (const [state, ns] of [["old", notes], ["normalised", normalised]] as const) {
      it(`${label}, ${state} notes`, () => {
        const b = board(ns, now);
        const kinded = new Set(ns.filter(n => n.fm.kind === "todo").map(n => n.name));
        const inColumns = b.days.flatMap(d => d.open.map(c => c.title)).filter(t => kinded.has(t)).sort();
        const lines = thisWeek(ns, now);
        const overdueOnly = lines.filter(l => !inColumns.includes(l.text));
        expect(lines.map(l => l.text).filter(t => inColumns.includes(t)).sort()).toEqual(inColumns);
        expect(overdueOnly.every(l => l.badges[0].text.startsWith("overdue"))).toBe(true);
      });
    }
  }
  it("plan rows of the fixture's Alpha hub are done exactly when isFinishedTodo", () => {
    const hub = all.find(n => n.name === "Alpha")!;
    const rows = readPlan(notes, hub).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.done).toBe(isFinishedTodo(notes.find(n => n.path === r.path)!.fm));
  });
});

// I2 Phase 4: the kit's Dataview queries read `scheduled` (an old weekday `day` only where a note has no `scheduled`). Each WHERE is pinned
// here as text and mirrored by a predicate, which must pick the cards the board (buildWeek) shows for that list.
describe("I2 Phase 4: kit queries pick what the board shows", () => {
  const kitFile = (p: string): string => readFileSync(join("kits/planning", p), "utf8");
  const ymdOf = (v: unknown): string => { const d = parseDay(v); return d ? ymd(d) : ""; };
  const open = (fm: Record<string, unknown>): boolean => fm.kind === "todo" && fm.done !== true && fm.day !== "Done";
  const normalised = notes.map(n => { const fm = { ...n.fm }; const p = normalisePatch(fm, DATES.wed); if (p) applyPatch(fm, p); return { ...n, fm }; });

  const BACKLOG_WHERE = 'WHERE kind = "todo" AND !scheduled AND !contains(list("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Done"), day) AND !done';
  const backlog = (fm: Record<string, unknown>): boolean => open(fm) && !fm.scheduled && ![...WEEKDAYS, "Done"].includes(fm.day as never);
  it("Weekly review Backlog = the tray's cards with no date, old and normalised notes", () => {
    expect(kitFile("00 Planning/Weekly review.md")).toContain(`> > ${BACKLOG_WHERE}\n`);
    for (const ns of [notes, normalised]) for (const now of Object.values(DATES)) {
      const tray = board(ns, now).tray.filter(c => !c.pill).map(c => c.title);
      const want = ns.filter(n => n.fm.kind === "todo" && tray.includes(n.name)).map(n => n.name).sort();
      expect(ns.filter(n => backlog(n.fm)).map(n => n.name).sort()).toEqual(want);
    }
  });

  const DAILY_WHERE = 'WHERE kind = "todo" AND !done AND day != "Done" AND ((scheduled AND scheduled <= date(this.file.name)) OR (!scheduled AND day = dateformat(date(this.file.name), "ccc")) OR (due AND due <= date(this.file.name)))';
  const daily = (fm: Record<string, unknown>, day: Date): boolean => {
    const d = ymd(day), s = ymdOf(fm.scheduled), due = ymdOf(fm.due);
    return open(fm) && ((!!s && s <= d) || (!fm.scheduled && fm.day === weekdayOf(day)) || (!!due && due <= d));
  };
  it("Daily note Planned for today = today's column of the board (carried cards too) plus due today or earlier, on normalised notes", () => {
    expect(kitFile("Extras/Templates/Daily note.md")).toContain(`> ${DAILY_WHERE}\n`);
    for (const now of [DATES.wed, DATES.mon]) {
      const col = board(normalised, now).days.find(c => c.date.getTime() === now.getTime())!;
      const due = normalised.filter(n => open(n.fm) && ymdOf(n.fm.due) && ymdOf(n.fm.due) <= ymd(now)).map(n => n.name);
      const want = [...new Set([...col.open.map(c => c.title), ...due])].filter(t => normalised.find(n => n.name === t)!.fm.kind === "todo").sort();
      expect(normalised.filter(n => daily(n.fm, now)).map(n => n.name).sort()).toEqual(want);
    }
  });
  it("Daily note on old notes: a weekday day still lists on its own weekday (old notes carried by date are not listed until normalised)", () => {
    const got = notes.filter(n => daily(n.fm, DATES.wed)).map(n => n.name);
    expect(got).toContain("Wed planned today");
    expect(got).toContain("Wed no planned");
  });

  it("One-off meeting and Project hub queries already read done and the old day: Done, unchanged", () => {
    expect(kitFile("Extras/Templates/One-off meeting.md")).toContain('AND !done AND day != "Done"');
    expect(kitFile("Extras/Templates/Project hub.md")).toContain('AND (done OR day = "Done")');
  });

  it("To-do board.base: only kind todo, and the kanban fallback groups by a weekday formula of scheduled", () => {
    const base = kitFile("00 Planning/To-do board.base");
    expect(base).toContain('    - kind == "todo"\n');
    expect(base).toContain(`  weekday: 'if(scheduled, date(scheduled).format("ddd"), if(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].contains(day), day, "Backlog"))'\n`);   // a typo day sits in Backlog, as on the board (seen in Obsidian 1.14.4)
    expect(base).toContain("      property: formula.weekday\n");
    expect(base).not.toMatch(/property: day$/m);
  });
});
