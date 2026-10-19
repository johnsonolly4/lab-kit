// I2-TEST step 3: what planned dates (I2) would do to the old-style fixture, with the I2 model as a test helper (tests/helpers/i2-model.ts).
// Golden: tests/fixtures/i2-old-vaults/golden/findings.json (UPDATE_GOLDEN=1 rewrites it). I2_PRINT=1 prints the tables for docs/plans/planned-dates.md.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { DAYS, type TodoFm } from "../src/planning/todo";
import { ymd } from "../src/planning/todo";
import { I2_ROOT, loadVault, todoNotes } from "./helpers/i2-vault";
import { DATES, MTIME, afterRoll, afterRollI2, apply, nextWeekday, oldPluginWrites, placeI2, placeNow, placeText, repair, tidyDates, weekdayName, type Fm, type OldOp, type Place } from "./helpers/i2-model";

const WED = DATES.wed;
const GOLDEN = join(I2_ROOT, "golden", "findings.json");
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The state a card is in, in the owner's words (the cases of the test plan). */
function caseOf(name: string, fm: Fm): string {
  if (fm.kind !== "todo") return "no kind";
  if (name.startsWith("Plan step")) return "subtask with after";
  if (name.startsWith("Flagged")) return "meeting-flagged";
  if (fm.day === "Done") return fm.done === true ? "day Done, ticked" : "day Done, not ticked";
  if (fm.done === true) return fm.done_on ? "done, with done_on" : "done, no done_on";
  const day = str(fm.day);
  if (day === "Sat" || day === "Sun") return "weekend planned";
  if (day === "Backlog") return fm.due ? "due only (Backlog)" : "Backlog";
  if (!(DAYS as readonly string[]).includes(day)) return "day typo / empty / lower case";
  if (fm.rolled === true) return "rolled";
  return fm.planned ? "Mon-Fri, with planned" : "Mon-Fri, no planned";
}
const colKey = (p: Place): string => (p.col === "done" ? `done@${p.at}` : p.col === "hidden" ? "hidden" : p.col);

const all = loadVault("vault");
const cards = todoNotes(all).map(n => ({ name: n.name, fm: n.fm as Fm, kase: caseOf(n.name, n.fm as Fm) }));

interface Tally { n: number; changed: number; cards: string[] }
function tally(pick: (c: typeof cards[number]) => [string, string]): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const c of cards) {
    const [a, b] = pick(c);
    const t = (out[c.kase] ??= { n: 0, changed: 0, cards: [] });
    t.n++;
    if (a !== b) { t.changed++; t.cards.push(`${c.name}: ${a} -> ${b}`); }
  }
  return out;
}
const sum = (t: Record<string, Tally>): number => Object.values(t).reduce((s, x) => s + x.changed, 0);

function views() {
  const out: Record<string, unknown> = {};
  for (const [label, V] of Object.entries(DATES)) {
    // Q9 (a) Tidy rule off: the board reads old cards through the fallback; (b) on: the rule ran on Wed (`tidyDates`) and the board is viewed on V
    const migrated = (fm: Fm): Fm => apply(fm, tidyDates(fm, WED));
    const phone = tally(c => [colKey(placeNow(c.fm)), colKey(placeI2(c.fm, V))]);
    const phoneB = tally(c => [colKey(placeNow(c.fm)), colKey(placeI2(migrated(c.fm), V))]);
    const computer = tally(c => [colKey(placeNow(afterRoll(c.fm, MTIME, V))), colKey(placeI2(afterRollI2(c.fm, MTIME, V), V))]);
    const aVsB = tally(c => [placeText(placeI2(c.fm, V)), placeText(placeI2(migrated(c.fm), V))]);
    out[label] = { today: ymd(V), vsToday_phone_a: phone, vsToday_phone_b: phoneB, vsToday_computer_a: computer, aVsB, weekendOn: weekendOn(V) };
  }
  return out;
}
function weekendOn(V: Date) {
  const t = tally(c => [colKey(placeNow(c.fm, true)), colKey(placeI2(c.fm, V, true))]);
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v.changed).map(([k, v]) => [k, v]));
}

/** Cards where the finished / open verdict differs between readers. */
function doneFlips() {
  const out: string[] = [];
  for (const c of cards) {
    const nowFinished = c.fm.done === true || c.fm.day === "Done";
    const dateOnly = c.fm.done === true;   // a reader that stops reading `day` (Q10 b)
    if (nowFinished !== dateOnly) out.push(`${c.name}: finished (day Done) -> open without day`);
  }
  // the roll-over's "ticked" write is what turns day Done + not done into done: on a vault it already ran on, nothing is left
  return out;
}

/** Two devices' copies of one note: the date each would get, and whether I2 draws them in the same place. */
function devicePairs() {
  const lap = Object.fromEntries(todoNotes(loadVault("devices/laptop")).map(n => [n.name, n.fm as Fm]));
  const pho = Object.fromEntries(todoNotes(loadVault("devices/phone")).map(n => [n.name, n.fm as Fm]));
  return Object.keys(lap).map(name => {
    const a = lap[name], b = pho[name];
    const sa = tidyDates(a, WED)?.set.scheduled ?? null, sb = tidyDates(b, WED)?.set.scheduled ?? null;
    return {
      name, scheduledLaptop: sa, scheduledPhone: sb, sameDate: sa === sb, sameDone: (a.done === true) === (b.done === true),
      shownLaptop: placeText(placeI2(apply(a, tidyDates(a, WED)), WED)), shownPhone: placeText(placeI2(apply(b, tidyDates(b, WED)), WED)),
      nowLaptop: placeText(placeNow(a)), nowPhone: placeText(placeNow(b)),
    };
  });
}

/** What an older plugin writes next on a migrated note (run Wed, one op at a time), and how I2 draws it before / after the mirror repair. */
function oldPlugin() {
  const ops: OldOp[] = ["drag to Fri", "drag to Backlog", "roll-over"];   // a tick writes done / done_on / rolled only: nothing to disagree with
  const out: Record<string, { n: number; stale: number; afterRepair: number; samples: string[] }> = {};
  for (const op of ops) {
    const t = { n: 0, stale: 0, afterRepair: 0, samples: [] as string[] };
    for (const c of cards) {
      if (c.fm.kind !== "todo" || c.fm.done === true || c.fm.day === "Done") continue;
      const base = apply(c.fm, tidyDates(c.fm, WED));
      const before = { day: str(base.day), scheduled: str(base.scheduled) };
      const written = oldPluginWrites(base, op, WED, MTIME);
      if (JSON.stringify(written) === JSON.stringify(base)) continue;   // the old plugin wrote nothing
      t.n++;
      // intent = where the old plugin's own reading puts it (day column / Backlog / done); view = I2 reading `scheduled` first
      const intent = colKey(placeNow(written));
      const view = colKey(placeI2(written, WED));
      const fixed = colKey(placeI2(apply(written, repair(written, before, WED)), WED));
      if (view !== intent) { t.stale++; if (t.samples.length < 3) t.samples.push(`${c.name}: old plugin intends ${intent}, I2 shows ${view} (scheduled ${str(written.scheduled)}, day ${str(written.day)})`); }
      if (fixed !== intent) t.afterRepair++;
    }
    out[op] = t;
  }
  return out;
}

/** A card the I2 board put in NEXT week (day mirrors the weekday, `scheduled` is next week's date, no `planned` written) meets an older plugin's roll-over on Wed 21 Oct. */
function futureMeetsOldRoll() {
  return (["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map(w => {
    const next = nextWeekday(w, new Date(2026, 9, 26));   // that weekday of next week
    const fm: Fm = { kind: "todo", day: w, scheduled: ymd(next), done: false, rolled: false };
    const rolled = afterRoll(fm, MTIME, WED);
    return `${w} ${ymd(next)}: old roll-over ${rolled.day !== fm.day || rolled.rolled === true ? `moves it to ${String(rolled.day)} (today)` : "leaves it"}; the old board draws it in this week's ${w} column`;
  });
}

/** The readers of `day` outside the plugin's own code: the kept notes' Dataview queries and the fixture's own query, run on notes before / after a week of I2 use. */
function readers() {
  const start = todoNotes(all).filter(n => n.fm.kind === "todo").map(n => ({ name: n.name, fm: apply(n.fm as Fm, tidyDates(n.fm as Fm, WED)) }));
  // a week of use on Wed 21 Oct under I2: drags, a tick, two new cards
  const act = (list: { name: string; fm: Fm }[], mirror: boolean) => {
    const out = list.map(c => ({ name: c.name, fm: { ...c.fm } }));
    const get = (n: string) => out.find(c => c.name === n)!.fm;
    const put = (n: string, date: string | null, day: string) => { const f = get(n); if (date) f.scheduled = date; else delete f.scheduled; if (mirror) f.day = day; f.rolled = false; };
    put("Backlog with planned stamp", "2026-10-23", "Fri");
    put("Mon planned this week", "2026-10-26", "Mon");
    put("Wed planned today", null, "Backlog");
    Object.assign(get("Tue planned this week"), { done: true, done_on: "2026-10-21" });
    out.push({ name: "New card for today", fm: { kind: "todo", ...(mirror ? { day: "Wed" } : {}), scheduled: "2026-10-21", done: false, rolled: false } });
    out.push({ name: "New card next Tue", fm: { kind: "todo", ...(mirror ? { day: "Tue" } : {}), scheduled: "2026-10-27", done: false, rolled: false } });
    return out;
  };
  const TOUCHED = ["Backlog with planned stamp", "Mon planned this week", "Wed planned today", "Tue planned this week", "New card for today", "New card next Tue"];
  const q = {
    "Weekly review: Backlog list (day = Backlog, open)": (f: Fm) => f.day === "Backlog" && f.done !== true,
    "Daily note 2026-10-21: Planned for today (day = Wed, open)": (f: Fm) => f.done !== true && f.day !== "Done" && f.day === "Wed",
    "Project hub: Done to-dos (done or day = Done)": (f: Fm) => String(f.project ?? "").includes("Alpha") && (f.done === true || f.day === "Done"),
    "Own query 1: open, grouped by day (not Backlog)": (f: Fm) => f.done !== true && f.day !== "Done" && f.day !== "Backlog" && !!f.day,
    "Own query 2: open on Fri": (f: Fm) => f.day === "Fri" && f.done !== true,
    "Own query 3: TASK where day = Mon": (f: Fm) => f.day === "Mon",
  };
  // what each query SHOULD list under I2 (the date is the truth; carried-over cards are already on today)
  const truth: Record<string, (f: Fm) => boolean> = {
    [Object.keys(q)[0]]: f => f.done !== true && f.day !== "Done" && !f.scheduled,
    [Object.keys(q)[1]]: f => f.done !== true && f.day !== "Done" && !!f.scheduled && String(f.scheduled) <= "2026-10-21",
    [Object.keys(q)[2]]: q[Object.keys(q)[2] as keyof typeof q],
    [Object.keys(q)[3]]: f => f.done !== true && f.day !== "Done" && !!f.scheduled,
    [Object.keys(q)[4]]: f => f.done !== true && String(f.scheduled) === "2026-10-23",
    [Object.keys(q)[5]]: f => String(f.scheduled).length === 10 && weekdayName(new Date(Number(String(f.scheduled).slice(0, 4)), Number(String(f.scheduled).slice(5, 7)) - 1, Number(String(f.scheduled).slice(8)))) === "Mon",
  };
  const run = (list: { name: string; fm: Fm }[], f: (x: Fm) => boolean) => list.filter(c => c.fm.kind === "todo" && f(c.fm)).map(c => c.name).sort();
  const mirror = act(start, true), dropped = act(start, false);
  const out: Record<string, { today: number; mirror: number; dropped: number; mirrorWrong: string[]; droppedWrong: string[] }> = {};
  for (const [name, f] of Object.entries(q)) {
    const want = run(mirror.map(c => ({ name: c.name, fm: { ...c.fm, day: c.fm.day, scheduled: c.fm.scheduled } })), truth[name]);
    const m = run(mirror, f), d = run(dropped, f);
    // only the cards the week of use touched: the others show the same in both versions (and keep the old limits of the query)
    const diff = (got: string[]) => [...got.filter(x => !want.includes(x) && TOUCHED.includes(x)).map(x => `+${x}`), ...want.filter(x => !got.includes(x) && TOUCHED.includes(x)).map(x => `-${x}`)];
    out[name] = { today: run(start, f).length, mirror: m.length, dropped: d.length, mirrorWrong: diff(m), droppedWrong: diff(d) };
  }
  return out;
}

const findings = { caseCounts: cards.reduce<Record<string, number>>((m, c) => ((m[c.kase] = (m[c.kase] ?? 0) + 1), m), {}), views: views(), doneFlips: doneFlips(), devices: devicePairs(), oldPlugin: oldPlugin(), futureMeetsOldRoll: futureMeetsOldRoll(), readers: readers() };

describe("I2 on old-style vaults: findings (simulated, helper only)", () => {
  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(findings, null, 2) + "\n");
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  it("matches the golden findings", () => { expect(JSON.parse(JSON.stringify(findings))).toEqual(golden); });
  it("every case of the test plan is in the fixture", () => {
    for (const k of ["Backlog", "Mon-Fri, with planned", "Mon-Fri, no planned", "rolled", "done, with done_on", "done, no done_on", "day Done, ticked", "day Done, not ticked", "no kind", "day typo / empty / lower case", "weekend planned", "due only (Backlog)", "subtask with after", "meeting-flagged"]) expect(findings.caseCounts[k], k).toBeGreaterThan(0);
  });
  it("a card with no `scheduled` and a weekday `day` is read through the old rule (cardDate)", () => {
    const fm = { kind: "todo", day: "Thu", planned: "2026-10-14" } as TodoFm & Fm;
    // planned Wed 14 Oct for Thu: Thu 15 Oct is past, so it is carried over to Wed (today)
    expect(placeText(placeI2(fm, WED))).toBe("Wed*");
  });
  it("the model's placeNow agrees with today's buildBoard (golden baseline) for every column on all three days", () => {
    const base = JSON.parse(readFileSync(join(I2_ROOT, "golden", "baseline.json"), "utf8")).vault;
    for (const [label, V] of Object.entries(DATES)) {
      void V;
      for (const [head, col] of Object.entries(base[label].boardBeforeRoll.days as Record<string, { open: string[]; done: number }>)) {
        const day = head.slice(0, 3);
        const open = cards.filter(c => { const p = placeNow(c.fm); return p.col === day; }).map(c => c.name);
        const done = cards.filter(c => { const p = placeNow(c.fm); return p.col === "done" && p.at === day; }).length;
        expect(open.sort(), `${label} ${day}`).toEqual(col.open.map(t => t.replace(/ \*$/, "")).sort());
        expect(done, `${label} ${day} done`).toBe(col.done);
      }
    }
  });
  it("prints the tables when I2_PRINT=1", () => {
    if (process.env.I2_PRINT !== "1") return;
    const v = findings.views as Record<string, Record<string, Record<string, Tally>>>;
    console.log(JSON.stringify({ caseCounts: findings.caseCounts, totals: Object.fromEntries(Object.entries(v).map(([d, x]) => [d, { phone_a: sum(x.vsToday_phone_a), phone_b: sum(x.vsToday_phone_b), computer_a: sum(x.vsToday_computer_a), aVsB: sum(x.aVsB), weekend: Object.values(x.weekendOn).reduce((s, t) => s + (t as Tally).changed, 0) }])) }, null, 1));
    console.log(JSON.stringify(findings, null, 1));
  });
});
