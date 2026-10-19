// I2 Phase 1 check on the old-style fixture vault (tests/fixtures/i2-old-vaults/): the slim model's board (buildWeek, src/) against the
// plan's earlier measured model (tests/helpers/i2-model.ts placeI2), and normalising every note leaves the board as it was.
import { describe, it, expect } from "vitest";
import { buildWeek, weekCardOf, type WeekBoard } from "../src/planning/board-card";
import { applyPatch, normalisePatch, WEEKDAYS } from "../src/planning/todo";
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
