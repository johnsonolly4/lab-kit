// I2-TEST step 3: the planned-dates (I2) model of docs/plans/planned-dates.md as a PURE TEST HELPER (no src/ code exists yet).
// Used only to measure what I2 would do to old-style to-dos; it is not the implementation.
import { DAYS, dayOf, isoWeekday, parseDay, weekStart, ymd, type TodoFm, type TodoPatch } from "../../src/planning/todo";
import { cardDate, changePatch, rollOverPatch, todayColumn } from "./old-todo";

/** The three days of the test: a Wednesday, the Saturday and the next Monday; MTIME = the notes' last change (a Friday before the test week). */
export const DATES = { wed: new Date(2026, 9, 21), sat: new Date(2026, 9, 24), mon: new Date(2026, 9, 26) };
export const MTIME = new Date(2026, 9, 16);
export const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const weekdayName = (d: Date): string => NAMES[isoWeekday(d) - 1];
const str = (v: unknown): string => (typeof v === "string" ? v : "");
export type Fm = Record<string, unknown>;

/** The date of a card the I2 way: `scheduled`, else the old rule (`day` + `planned`, else `run`'s Monday as the roll-over reads a card with no `planned`). null = none. */
export function dateOf(fm: Fm, run: Date): Date | null {
  const s = parseDay(fm.scheduled);
  if (s) return s;
  if (fm.scheduled != null && fm.scheduled !== "") return null;
  return cardDate({ ...(fm as TodoFm), planned: parseDay(fm.planned) ? fm.planned : ymd(weekStart(run)) });
}

/** The Tidy rule `todo-dates` (plan, "Migration of old to-dos") run on `run`: the keys to add, or null (note skipped). */
export function tidyDates(fm: Fm, run: Date): TodoPatch | null {
  if (fm.kind !== "todo" || (fm.scheduled != null && fm.scheduled !== "")) return null;
  if (!(DAYS as readonly string[]).includes(str(fm.day))) return null;
  const d = dateOf(fm, run);
  return d ? { set: { scheduled: ymd(d) }, remove: [] } : null;
}

export type Place = { col: string; carried?: boolean; pill?: string } | { col: "tray"; pill?: string } | { col: "done"; at: string } | { col: "hidden"; why: string };
export const placeText = (p: Place): string => p.col === "done" ? `done@${p.at}` : p.col === "hidden" ? `hidden(${p.why})` : p.col + ("carried" in p && p.carried ? "*" : "") + ("pill" in p && p.pill ? ` [${p.pill}]` : "");

/** Where the I2 board draws a card (the table in the plan: "Where a card shows"), shown week = this week. */
export function placeI2(fm: Fm, today: Date, weekend = false): Place {
  if (fm.day === "Done") return { col: "hidden", why: "day Done" };   // the base's own filter stays
  const mon = weekStart(today), sun = dayOf(mon, 6);
  const sched = dateOf(fm, today);
  const shown = (d: Date): boolean => weekend || isoWeekday(d) <= 5;
  if (fm.done === true) {
    const when = parseDay(fm.done_on) ?? sched;
    if (!when) return { col: "hidden", why: "done, no date" };
    if (when < mon || when > sun) return { col: "hidden", why: "done before this week" };
    return shown(when) ? { col: "done", at: weekdayName(when) } : { col: "hidden", why: "done at the weekend" };
  }
  if (!sched) return { col: "tray" };
  const pill = `${weekdayName(sched)} ${sched.getDate()}`;
  if (ymd(sched) < ymd(today)) return { col: todayColumn(today), carried: true };
  if (sched > sun) return { col: "tray", pill };
  return shown(sched) ? { col: weekdayName(sched) } : { col: "tray", pill };
}

/** Where today's code draws a card (mirror of buildBoard: the column named by `day`; finished cards collapse; the rest in the tray). */
export function placeNow(fm: Fm, weekend = false): Place {
  if (fm.day === "Done") return { col: "hidden", why: "day Done" };
  const names = [...DAYS, ...(weekend ? ["Sat", "Sun"] : [])] as string[];
  const day = str(fm.day);
  if (fm.done === true) return names.includes(day) ? { col: "done", at: day } : { col: "hidden", why: "done in tray" };
  return names.includes(day) ? { col: day, ...(fm.rolled === true ? { carried: true } : {}) } : { col: "tray" };
}

/** Today's code after the roll-over wrote its patch (computers). */
export function afterRoll(fm: Fm, mtime: Date, now: Date): Fm {
  const r = rollOverPatch(fm as TodoFm, mtime, now);
  if (!r) return fm;
  const x = { ...fm };
  for (const [k, v] of Object.entries(r.patch.set)) x[k] = v;
  for (const k of r.patch.remove) delete x[k];
  return x;
}

/** The I2 roll-over (computers) on one card, per the plan: ticked / cleared as now; an open card dated before today gets `scheduled: today`; a weekday card with no date gets one. */
export function afterRollI2(fm: Fm, mtime: Date, now: Date): Fm {
  const r = rollOverPatch(fm as TodoFm, mtime, now);
  if (!r) return fm;
  if (r.kind === "ticked" || r.kind === "cleared") return afterRoll(fm, mtime, now);
  const x = afterRoll(fm, mtime, now);
  const d = dateOf(fm, now);
  if (r.kind === "rolled") return { ...x, scheduled: ymd(now) };
  return d ? { ...x, scheduled: ymd(d) } : x;   // "planned" kind becomes "dated"
}

export const apply = (fm: Fm, p: TodoPatch | null): Fm => { if (!p) return fm; const x = { ...fm }; for (const [k, v] of Object.entries(p.set)) x[k] = v; for (const k of p.remove) delete x[k]; return x; };

/** The next date on or after `today` that is the weekday `name` (the old kanban-drag meaning). */
export const nextWeekday = (name: string, today: Date): Date => dayOf(today, (NAMES.indexOf(name) + 1 - isoWeekday(today) + 7) % 7);

/** The engine's mirror repair (plan, Sync rule 3): `day` changed without `scheduled` → scheduled from day; `scheduled` changed → day from it. */
export function repair(fm: Fm, before: { day: string; scheduled: string }, today: Date): TodoPatch | null {
  if (fm.kind !== "todo" || fm.day === "Done") return null;
  const day = str(fm.day), sched = str(fm.scheduled);
  if (day !== before.day && sched === before.scheduled) {
    if ((NAMES as string[]).includes(day)) return { set: { scheduled: ymd(nextWeekday(day, today)), rolled: false }, remove: [] };
    if (day === "Backlog" && sched) return { set: {}, remove: ["scheduled"] };
    return null;
  }
  if (sched !== before.scheduled) {
    const d = parseDay(sched);
    const want = d ? weekdayName(d) : "Backlog";
    return want !== day ? { set: { day: want }, remove: [] } : null;
  }
  return null;
}

/** What an OLDER plugin (1.4.x: `changePatch`, `rollOverPatch`) writes next on a card, on top of a migrated note. */
export type OldOp = "drag to Fri" | "drag to Backlog" | "roll-over";
export function oldPluginWrites(fm: Fm, op: OldOp, today: Date, mtime: Date): Fm {
  const before = { day: str(fm.day), done: fm.done === true };
  if (op === "roll-over") return afterRoll(fm, mtime, today);
  const moved = { ...fm, day: op === "drag to Fri" ? "Fri" : "Backlog" };
  return apply(moved, changePatch(moved as TodoFm, before, { day: str(moved.day), done: moved.done === true }, today));
}
