// I2-TEST step 2: what the CURRENT code (no planned dates) does with old-style to-dos, as golden data.
// Fixture: tests/fixtures/i2-old-vaults. Golden: tests/fixtures/i2-old-vaults/golden/baseline.json (UPDATE_GOLDEN=1 rewrites it).
// Three days: Wed 2026-10-21, Sat 2026-10-24, Mon 2026-10-26. Each shows the board with no roll-over (a phone, or a computer not yet rolled),
// the roll-over's own writes (one run, every card on its own), and the board after those writes were applied.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildBoard, cardOf, type HeaderSrc } from "../src/planning/board-card";
import { projectTodos, thisWeek, type NoteRec } from "../src/planning/lists";
import { parseSeries } from "../src/planning/meetings";
import { applyPatch, rollOverPatch, ymd } from "../src/planning/todo";
import { I2_ROOT, boardNotes, loadVault, todoNotes } from "./helpers/i2-vault";

export const DATES = { wed: new Date(2026, 9, 21), sat: new Date(2026, 9, 24), mon: new Date(2026, 9, 26) };
const MTIME = new Date(2026, 9, 16);   // the notes' last change: a Friday before the test week
const GOLDEN = join(I2_ROOT, "golden", "baseline.json");

const headOf = (all: NoteRec[], todos: NoteRec[]): HeaderSrc => {
  const hubs = all.filter(n => n.fm.kind === "project" || n.fm.kind === "meeting-series");
  const series = hubs.filter(n => n.fm.kind === "meeting-series").map(parseSeries).flatMap(r => ("series" in r ? [r.series] : []));
  return { series, todos, hubs };
};

/** Board of the notes: per day column the open titles ("*" = carried over, amber) and the done count; the tray titles. */
function boardOf(all: NoteRec[], notes: NoteRec[], now: Date, weekend: boolean) {
  const cards = boardNotes(notes).map(n => cardOf({ path: n.path, title: n.name, fm: n.fm }, "all", now));
  const b = buildBoard(cards, headOf(all, todoNotes(notes)), { weekend, busyFrom: 6, countdown: "all", now });
  return {
    days: Object.fromEntries(b.days.map(d => [`${d.day} ${ymd(d.date)}${d.today ? " (today)" : ""}`, { open: d.open.map(c => c.title + (c.rolled ? " *" : "")), done: d.done, markers: d.markers.map(m => m.text) }])),
    tray: b.tray.map(c => c.title + (c.rolled ? " *" : "")),
  };
}

export function baseline(vault: string) {
  const all = loadVault(vault), todos = todoNotes(all);
  const hub = all.find(n => n.name === "Alpha")!;
  const out: Record<string, unknown> = {};
  for (const [label, now] of Object.entries(DATES)) {
    const rolls: Record<string, unknown> = {};
    const rolledNotes = todos.map(n => {
      const r = rollOverPatch(n.fm, MTIME, now);
      if (!r) return n;
      rolls[n.name] = { kind: r.kind, set: r.patch.set, remove: r.patch.remove };
      const fm = { ...n.fm }; applyPatch(fm, r.patch);
      return { ...n, fm };
    });
    const rolledAll = all.map(n => rolledNotes.find(r => r.path === n.path) ?? n);
    out[label] = {
      today: ymd(now),
      boardBeforeRoll: boardOf(all, todos, now, false),
      boardBeforeRollWeekend: boardOf(all, todos, now, true),
      rollOver: rolls,
      boardAfterRoll: boardOf(rolledAll, rolledNotes, now, false),
      thisWeek: thisWeek(todos, now).map(l => `${l.text} | ${l.badges.map(b => b.text).join(" / ")}`),
      thisWeekAfterRoll: thisWeek(rolledNotes, now).map(l => `${l.text} | ${l.badges.map(b => b.text).join(" / ")}`),
      projectAlpha: projectTodos(todos, hub, now).map(l => `${l.text} | ${l.badges.map(b => b.text).join(" / ")}`),
    };
  }
  return out;
}

describe("I2 baseline: current board, roll-over and lists on the old-style fixture", () => {
  const now = { vault: baseline("vault"), laptop: baseline("devices/laptop"), phone: baseline("devices/phone") };
  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + "\n");
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));

  it("the main vault matches the golden file for Wed, Sat and Mon", () => { expect(JSON.parse(JSON.stringify(now.vault))).toEqual(golden.vault); });
  it("the two device copies match the golden file", () => {
    expect(JSON.parse(JSON.stringify(now.laptop))).toEqual(golden.laptop);
    expect(JSON.parse(JSON.stringify(now.phone))).toEqual(golden.phone);
  });
  it("sanity: the fixture holds every state", () => {
    expect(todoNotes(loadVault("vault")).length).toBeGreaterThanOrEqual(34);
    expect(loadVault("vault").every(n => n.fm.scheduled === undefined)).toBe(true);
  });
});
