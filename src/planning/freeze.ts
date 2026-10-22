// Freezing a meeting note (I19, I20): its generated lists become plain wikilink lists, so the note stays a record.
// Pure (no Obsidian runtime). Plan: docs/plans/freeze-meeting-notes.md.
import { dayMonth, isOpenTodo, linkTarget, meetingDone, meetingExperiments, meetingWindow, waitingOn, type ListLine, type NoteRec } from "./lists";
import { flaggedFor } from "./meetings";
import type { Plan } from "./plan";
import { statusLines } from "./plan-slide";
import { parseDay } from "./todo";

/** The lists of a meeting note as plain markdown lines (no callout prefix), by what the block shows: `meeting-experiments`, `meeting-done`, `waiting`, `meeting-flagged`. A missing key leaves that block as it is. */
export type FreezeLists = Record<string, string[]>;

/** The Settings → Planning switch (owner board 5, 2026-10-20; the wording is new, recorded in BACKLOG for the owner's OK). */
export const FREEZE_AUTO = { name: "Freeze meeting notes automatically", desc: "Freeze a meeting note the day after its date." };
export const FROZEN = "frozen";
export const RAISED = "raised_on";
export const FLAGGED_EMPTY = "Nothing is flagged for this meeting.";
const BLOCKS = ["meeting-experiments", "meeting-done", "waiting", "meeting-flagged"];

const baseOf = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/, "");
const plain = (t: string): string => t.replace(/^·\s*/, "");

/** One bullet: `- [[Note]] · badge · badge` (the text becomes the link's alias when it differs from the note's name). */
export function lineMarkdown(l: ListLine): string {
  const base = baseOf(l.path), link = l.text === base ? `[[${base}]]` : `[[${base}|${l.text}]]`;
  return `- ${[link, ...l.badges.map(b => plain(b.text))].join(" · ")}`;
}

const listOf = (lines: ListLine[], empty: string): string[] => lines.length ? lines.map(lineMarkdown) : [empty];

/** The earlier of an existing `raised_on` and the meeting's date; null when the existing one already is (nothing to write). */
export function raisedStamp(existing: unknown, date: string): string | null {
  const e = (existing instanceof Date ? "" : typeof existing === "string" ? existing : "").slice(0, 10);
  return parseDay(e) && e <= date ? null : date;
}

/** Meeting note, Flagged: the open to-dos whose `meeting` points at the series hub, by name; badge "raised d Mon" for a to-do first raised at an earlier meeting. */
export function flaggedLines(todos: NoteRec[], hub: NoteRec, isFirst: boolean, date: string): ListLine[] {
  return flaggedFor(todos.filter(isOpenTodo), hub, isFirst).sort((a, b) => a.name.localeCompare(b.name)).map(t => {
    const r = typeof t.fm.raised_on === "string" ? t.fm.raised_on.slice(0, 10) : "", day = parseDay(r);
    return { path: t.path, text: t.name, badges: day && r < date ? [{ text: `raised ${dayMonth(day)}`, cls: "vt-badge vt-planned" }] : [] };
  });
}

/** A `plan-picture` block frozen (plan-map Phase 3, Q5 a): the project's open to-dos that are late or waiting, with that status, late first, then by name (as of `today`, the meeting's date). */
export function pictureFreezeLines(plan: Plan, today: string): string[] {
  const lines = plan.rows.filter(r => !r.parent && !r.done)
    .map(r => ({ r, marks: statusLines(r, plan.rows, today).filter(l => l.tone === "late" || l.tone === "waiting") }))
    .filter(x => x.marks.length)
    .sort((a, b) => Number(b.marks[0].tone === "late") - Number(a.marks[0].tone === "late") || a.r.name.localeCompare(b.r.name))
    .map(x => lineMarkdown({ path: x.r.path, text: x.r.name, badges: x.marks.map(m => ({ text: m.text, cls: "" })) }));
  return lines.length ? lines : ["Nothing is late or waiting."];
}

/** What a meeting note's lists hold at freeze time. `lab` undefined = that folder is missing: its block is left alone. `planOf` finds the plan of the project a `plan-picture` block names (null: not a project hub). */
export interface FreezeSource { fm: Record<string, unknown>; lab?: NoteRec[]; todos: NoteRec[]; hub: NoteRec | null; isFirst: boolean; planOf?: (link: string) => Plan | null }
/** `pictures`: the list for a `plan-picture` block by the project it names; null leaves the block. */
export interface FreezeData { lists: FreezeLists; flagged: NoteRec[]; pictures?: (link: string) => string[] | null }

/** The frozen lists (every one, not capped) and the to-dos to stamp; null when the note has no since and date. */
export function meetingFreezeLists(src: FreezeSource, today: Date): FreezeData | null {
  const w = meetingWindow(src.fm);
  if (!w) return null;
  const lists: FreezeLists = {};
  if (src.lab) lists["meeting-experiments"] = listOf(meetingExperiments(src.lab, w), "No experiments changed since the last meeting.");
  lists["meeting-done"] = listOf(meetingDone(src.todos, w).lines, "No to-dos finished since the last meeting.");
  const groups = waitingOn(src.todos, today);
  lists.waiting = groups.length ? groups.flatMap(g => [`**${g.who}**`, ...g.lines.map(lineMarkdown)]) : ["Nothing is waiting."];
  const flagged = src.hub ? flaggedFor(src.todos.filter(isOpenTodo), src.hub, src.isFirst) : [];
  lists["meeting-flagged"] = listOf(src.hub ? flaggedLines(src.todos, src.hub, src.isFirst, w.date) : [], FLAGGED_EMPTY);
  const planOf = src.planOf;
  return { lists, flagged, pictures: planOf ? link => { const plan = planOf(link); return plan ? pictureFreezeLines(plan, w.date) : null; } : undefined };
}

const OPEN = /^((?:>[ \t]?)*)(`{3,})(vault-card|dataview)[ \t]*$/;
const CLOSE = /^(?:>[ \t]?)*`{3,}[ \t]*$/;
const unprefix = (l: string): string => l.replace(/^(?:>[ \t]?)*/, "");

/** Which generated list a code block is: a `show:` block, `plan-picture:<project>` for a plan picture naming its project, or the old Flagged Dataview query; null for anything else. */
function blockKind(lang: string, lines: string[]): string | null {
  if (lang === "vault-card") {
    const show = lines.map(l => /^\s*show:\s*(\S+)/i.exec(unprefix(l))?.[1]?.toLowerCase()).find(Boolean);
    if (show === "plan-picture") { const project = linkTarget(lines.map(l => /^\s*project\s*:\s*(.*?)\s*$/i.exec(unprefix(l))?.[1]).find(Boolean)); return project ? `${PICTURE}${project}` : null; }
    return show && BLOCKS.includes(show) ? show : null;
  }
  const q = lines.map(unprefix).join("\n");
  return /\bkind\s*=\s*"todo"/.test(q) && /\bmeeting\s*=/.test(q) ? "meeting-flagged" : null;
}

const PICTURE = "plan-picture:";

/** The page with each generated block (inside a callout or not) replaced by its list (a plan picture by `pictures` of its project); the lines outside the blocks are copied as they are. */
export function freezeBody(body: string, lists: FreezeLists, pictures?: (link: string) => string[] | null): string {
  const src = body.split("\n"), out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const open = OPEN.exec(src[i]);
    let end = -1;
    if (open) for (let j = i + 1; j < src.length; j++) if (CLOSE.test(src[j])) { end = j; break; }
    const kind = open && end > i ? blockKind(open[3], src.slice(i + 1, end)) : null;
    const list = kind?.startsWith(PICTURE) ? pictures?.(kind.slice(PICTURE.length)) : kind ? lists[kind] : null;
    if (open && end > i && list) {
      out.push(...list.map(l => `${open[1]}${l}`));
      i = end;
    } else out.push(src[i]);
  }
  return out.join("\n");
}

/** Splits `---` properties from the page; null when there are none. */
function parts(text: string): { head: string[]; body: string } | null {
  const lines = text.split("\n");
  if (lines[0].trimEnd() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---");
  return end < 0 ? null : { head: lines.slice(1, end), body: lines.slice(end).join("\n") };
}

/** Is this note a meeting note that has not been frozen? */
export function isFreezable(text: string): boolean {
  const p = parts(text);
  return !!p && p.head.some(l => /^kind:\s*["']?meeting["']?\s*$/.test(l)) && !p.head.some(l => new RegExp(`^${FROZEN}:`).test(l));
}

/** The `frozen: <today>` line was already set? Returns its value ("" when not frozen). */
export function frozenOn(text: string): string {
  const m = parts(text)?.head.map(l => new RegExp(`^${FROZEN}:\\s*(.*?)\\s*$`).exec(l)).find(Boolean);
  return m?.[1] ?? "";
}

/** The note frozen: its blocks as plain lists and `frozen: <today>` at the end of the properties. Null when it is not a meeting note or is frozen already (a frozen note is never frozen again). */
export function freezeMeeting(text: string, lists: FreezeLists, today: string, pictures?: (link: string) => string[] | null): string | null {
  if (!isFreezable(text)) return null;
  const crlf = text.includes("\r\n"), t = text.replace(/\r\n/g, "\n"), p = parts(t)!;
  const out = ["---", ...p.head, `${FROZEN}: ${today}`, freezeBody(p.body, lists, pictures)].join("\n");
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

/** The meeting's date as YYYY-MM-DD; "" when the property is missing or not a real day (such a note is never frozen by date). */
export function meetingDay(fm: Record<string, unknown>): string {
  const d = typeof fm.date === "string" ? fm.date.slice(0, 10) : "";
  return parseDay(d) ? d : "";
}

/** Freeze timing (I19, owner 2026-10-20): a meeting note freezes the day after its meeting date, i.e. when `today` (YYYY-MM-DD) is after the date. Not on the day itself; never without a readable date; never when `frozen` is set (so a date edited later after the freeze changes nothing). */
export function dueToFreeze(fm: Record<string, unknown>, today: string): boolean {
  const d = meetingDay(fm);
  return fm.kind === "meeting" && !fm[FROZEN] && !!d && d < today;
}

/** The series link of a meeting note's properties as a hub name. */
export const seriesName = (fm: Record<string, unknown>): string => linkTarget(fm.series).split("/").pop() ?? "";
