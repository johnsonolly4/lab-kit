// Homepage and Projects overview lists (Phase 5a): which notes each block shows, in which order, with which badge.
// Pure (no Obsidian runtime). Each rule is ported from the Dataview / DataviewJS query it replaced in kits/planning/00 Home.md and
// 02 Projects/Projects overview.md (kit 0.5.2); docs/plans/phase-5-homepage-meetings.md.
import { dateOf, dayOf, dueCountdown, isFinishedTodo, isoWeekday, parseDay, waitingOf, weekdayOf, weekStart, ymd, type CountdownMode } from "./todo";

/** A note as the lists see it. `links`: paths of the notes it links to (resolved). Times in ms. */
export interface NoteRec { path: string; name: string; folder: string; fm: Record<string, unknown>; ctime: number; mtime: number; links?: string[] }
/** One list line: the note, the text to show (its name, or a title), and badges. */
export interface Badge { text: string; cls: string }
export interface ListLine { path: string; text: string; badges: Badge[] }

/** A property as text; a list gives its first item (lab notes from before issue #32 keep Status as a one-item list). */
const str = (v: unknown): string => (Array.isArray(v) ? str(v[0]) : typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
/** `path` is in `folder` or a folder below it (as Dataview's FROM "folder"). */
export const inFolder = (path: string, folder: string): boolean => !!folder && path.startsWith(folder + "/");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "d MMM", as Dataview's dateformat(…, "d MMM"). */
export const dayMonth = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
/** A CSS class part from a status: lower case, spaces to dashes ("Processing results" → "processing-results"). */
const slug = (s: string): string => s.toLowerCase().replace(/ /g, "-");

/** The due date of a to-do when it is before today (a YYYY-MM-DD `due`, or the date part of a date-time). */
function overdue(fm: Record<string, unknown>, today: Date): Date | null {
  const due = parseDay(str(fm.due).slice(0, 10));
  return due && ymd(due) < ymd(today) ? due : null;
}
/** The "waiting: <text>" badge of a to-do that waits on something; none otherwise. */
const waitingBadge = (fm: Record<string, unknown>): Badge[] => { const w = waitingOf(fm); return w ? [{ text: `waiting: ${w}`, cls: "vt-badge vt-waiting" }] : []; };
export const isOpenTodo = (n: NoteRec): boolean => n.fm.kind === "todo" && !isFinishedTodo(n.fm);

/** Plain text order (code points: "~" after digits, unlike localeCompare). */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** Where an open to-do sits on the board, as YYYY-MM-DD: its planned date (`dateOf`), today when that is past (carried over); "" for the Backlog. */
function shownOn(fm: Record<string, unknown>, today: Date): { on: string; carried: boolean } {
  const d = dateOf(fm, today), iso = ymd(dayOf(today));
  if (!d) return { on: "", carried: false };
  return ymd(d) < iso ? { on: iso, carried: true } : { on: ymd(d), carried: false };
}
/** The planned day of a list line: `Mon` in this week, `Tue 27 Oct` in another week, `Backlog` with no date (an unknown `day` value as it is written). */
function dayLabel(fm: Record<string, unknown>, today: Date): string {
  const d = dateOf(fm, today), day = str(fm.day).trim();
  if (!d) return day && day !== "Backlog" && !str(fm.scheduled).trim() ? day : "Backlog";
  const monday = weekStart(today);
  return d >= monday && d <= dayOf(monday, 6) ? weekdayOf(d) : `${weekdayOf(d)} ${dayMonth(d)}`;
}

/** This week: open to-dos the board shows in this week's Mon–Fri columns (carried over ones in today's), or overdue. Overdue first, then by day. Badge: overdue (date) / today / the day; carried over. */
export function thisWeek(todos: NoteRec[], today: Date): ListLine[] {
  const iso = ymd(dayOf(today)), friday = ymd(dayOf(weekStart(today), 4));
  return todos.filter(isOpenTodo)
    .map(n => ({ n, late: overdue(n.fm, today), ...shownOn(n.fm, today) }))
    .filter(x => x.carried || (x.on && x.on <= friday) || x.late)
    .sort((a, b) => (a.late ? 0 : 1) - (b.late ? 0 : 1) || cmp(a.on || "~", b.on || "~") || a.n.path.localeCompare(b.n.path))
    .map(({ n, late, on, carried }) => {
      const badges: Badge[] = [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" }
        : on === iso && isoWeekday(today) <= 5 ? { text: "today", cls: "vt-badge vt-today" } : { text: `· ${dayLabel(n.fm, today)}`, cls: "vt-muted" }];
      if (carried) badges.push({ text: "carried over", cls: "vt-badge vt-rolled" });
      badges.push(...waitingBadge(n.fm));
      return { path: n.path, text: n.name, badges };
    });
}

/** Experiments on the go: lab notes with a Status other than Closed. Started → Processing results → the rest, then name Z → A. */
export function experiments(notes: NoteRec[], limit = 8): ListLine[] {
  const rank = (s: string): number => (s === "Started" ? 0 : s === "Processing results" ? 1 : 2);
  return notes.filter(n => str(n.fm.Status) && str(n.fm.Status) !== "Closed")
    .sort((a, b) => rank(str(a.fm.Status)) - rank(str(b.fm.Status)) || b.name.localeCompare(a.name))
    .slice(0, limit)
    .map(n => { const s = str(n.fm.Status); return { path: n.path, text: n.name, badges: [{ text: s.toLowerCase(), cls: `vt-badge vt-${slug(s)}` }] }; });
}

/** The values of a project's Status, in the order the hub's drop-down lists them. */
export const PROJECT_STATUSES = ["Active", "Paused", "Done"];
const statusRank = (s: string): number => (s === "Active" ? 0 : s === "Paused" ? 1 : s === "Done" ? 2 : 3);

/** The deadline badge of a project hub: its `deadline` date counted down like a to-do's `due`, none once the project is Done; "off" hides it. */
export function deadlineBadge(fm: Record<string, unknown>, mode: CountdownMode, now: Date): Badge | null {
  if (str(fm.Status) === "Done") return null;
  const cd = dueCountdown({ due: fm.deadline }, mode, now);
  if (!cd) return null;
  return { text: `deadline ${cd.text}`, cls: `vt-badge ${cd.level === "late" ? "vt-overdue" : cd.level === "soon" ? "vt-today" : "vt-planned"}` };
}

/** An Active project (Status not Done or Paused; none counts as Active) with no open to-do: nothing is planned next. */
export function noNextStep(hub: NoteRec, todos: NoteRec[]): boolean {
  const s = str(hub.fm.Status).trim().toLowerCase();
  return hub.fm.kind === "project" && s !== "done" && s !== "paused" && !todos.some(t => isOpenTodo(t) && pointsTo(t.fm.project, hub));
}
export const NO_NEXT_STEP: Badge = { text: "no next step", cls: "vt-badge vt-nonext" };

/** Projects: project hubs, Active → Paused → Done (others last), then by name. A hub with a `deadline` gets the countdown badge (mode "off" = none). With `todos`, an Active project with no open to-do gets the "no next step" badge. */
export function projects(notes: NoteRec[], limit = Infinity, mode: CountdownMode = "off", now: Date = new Date(), todos?: NoteRec[]): ListLine[] {
  return notes.filter(n => n.fm.kind === "project")
    .sort((a, b) => statusRank(str(a.fm.Status)) - statusRank(str(b.fm.Status)) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(n => {
      const s = str(n.fm.Status), d = deadlineBadge(n.fm, mode, now);
      return { path: n.path, text: n.name, badges: [...(s ? [{ text: s.toLowerCase(), cls: `vt-badge vt-${slug(s)}` }] : []), ...(d ? [d] : []), ...(todos && noNextStep(n, todos) ? [NO_NEXT_STEP] : [])] };
    });
}

/** When a literature note was imported: its `imported` property, else the file's creation time. */
const importedAt = (n: NoteRec): number => { const t = Date.parse(str(n.fm.imported)); return Number.isNaN(t) ? n.ctime : t; };

/** Recently read: literature notes, newest import first, shown by Title; processed (has a takeaway) or to process. */
export function recentlyRead(notes: NoteRec[], limit = 5): ListLine[] {
  return notes.filter(n => n.fm.kind === "literature")
    .sort((a, b) => importedAt(b) - importedAt(a))
    .slice(0, limit)
    .map(n => ({ path: n.path, text: str(n.fm.Title) || n.name,
      badges: [str(n.fm.takeaway) ? { text: "processed", cls: "vt-badge vt-closed" } : { text: "to process", cls: "vt-badge vt-planned" }] }));
}

/** A meeting note's window: its `since` and `date` properties (YYYY-MM-DD), null when either is missing. */
export function meetingWindow(fm: Record<string, unknown>): { since: string; date: string } | null {
  const since = str(fm.since).slice(0, 10), date = str(fm.date).slice(0, 10);
  return parseDay(since) && parseDay(date) ? { since, date } : null;
}

/** Meeting note, Experiments: lab notes changed after `since` and before the end of the meeting day, by name; badge: its Status. */
export function meetingExperiments(notes: NoteRec[], w: { since: string; date: string }): ListLine[] {
  const from = parseDay(w.since)!.getTime(), to = parseDay(w.date)!.getTime() + 86400000;
  return notes.filter(n => n.mtime > from && n.mtime < to).sort((a, b) => a.name.localeCompare(b.name))
    .map(n => { const s = str(n.fm.Status); return { path: n.path, text: n.name, badges: s ? [{ text: s.toLowerCase(), cls: `vt-badge vt-${slug(s)}` }] : [] }; });
}

/** `priority` is 1, 2 or 3 (a number or text); anything else (none, 0, 4, words) is no priority. */
export function hasPriority(v: unknown): boolean {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return n === 1 || n === 2 || n === 3;
}

/** Meeting note, Done this week: the to-dos finished after `since` up to the meeting day that have a priority (1 to 3), without ticked subtasks (a to-do with `sub`); badge: its project.
 *  `hidden`: how many finished to-dos were left out for having no priority (subtasks are not counted). */
export function meetingDone(todos: NoteRec[], w: { since: string; date: string }): { lines: ListLine[]; hidden: number } {
  const finished = todos.filter(n => n.fm.kind === "todo" && n.fm.done === true && str(n.fm.done_on).slice(0, 10) > w.since && str(n.fm.done_on).slice(0, 10) <= w.date && !linkTarget(n.fm.sub));
  const shown = finished.filter(n => hasPriority(n.fm.priority));
  const lines = shown.sort((a, b) => a.name.localeCompare(b.name))
    .map(n => { const p = linkTarget(n.fm.project); return { path: n.path, text: n.name, badges: p ? [{ text: `· ${p}`, cls: "vt-muted" }] : [] }; });
  return { lines, hidden: finished.length - shown.length };
}

/** Meeting note, Papers read: literature notes imported after `since` up to the meeting day, shown by Title; badge: its takeaway. */
export function meetingPapers(notes: NoteRec[], w: { since: string; date: string }): ListLine[] {
  const day = (n: NoteRec): string => { const t = str(n.fm.imported).slice(0, 10); return parseDay(t) ? t : ymd(new Date(n.ctime)); };
  return notes.filter(n => n.fm.kind === "literature" && day(n) > w.since && day(n) <= w.date)
    .sort((a, b) => importedAt(b) - importedAt(a))
    .map(n => { const t = str(n.fm.takeaway); return { path: n.path, text: str(n.fm.Title) || n.name, badges: t ? [{ text: `· ${t}`, cls: "vt-muted" }] : [] }; });
}

/** Notes in the inbox (and folders below it), as Dataview counted them. */
export const inboxCount = (notes: NoteRec[]): number => notes.length;

/** The note a link value points at: `[[Alpha]]`, `[[Projects/Alpha|A]]`, `Alpha` → `Alpha` / `Projects/Alpha` (no .md, no heading). */
export function linkTarget(v: unknown): string {
  const s = str(v).trim().replace(/^\[\[|\]\]$/g, "");
  return s.split("|")[0].split("#")[0].replace(/\.md$/, "").trim();
}
/** A project value (one link or a list) points at the hub `hub`. */
export function pointsTo(v: unknown, hub: NoteRec): boolean {
  const vals = Array.isArray(v) ? (v as unknown[]) : [v];
  return vals.some(x => { const t = linkTarget(x); return !!t && (t === hub.name || t === hub.path.replace(/\.md$/, "") || t.endsWith("/" + hub.name)); });
}

/** The `goal::` inline field of a project hub (`[goal:: Make the thing]`), "" when empty. Dataview read it; the plugin reads the text. */
export function goalOf(text: string): string {
  return /\[goal::[ \t]*([^\]\n]*)\]/.exec(text)?.[1]?.trim() ?? "";
}

/** The hub one level up from the hub note at `hubPath`: a note in the parent of its folder, found at the time of the click so a renamed folder cannot break it. Prefers `kind: hub`, else the note named like the folder without its number ("08 Meetings" > Meetings). */
export function parentHub(notes: NoteRec[], hubPath: string): NoteRec | null {
  const me = notes.find(n => n.path === hubPath);
  if (!me) return null;
  const parent = me.folder.includes("/") ? me.folder.slice(0, me.folder.lastIndexOf("/")) : "";
  const siblings = notes.filter(n => n.folder === parent && n.path !== hubPath);
  const named = unnumbered(parent.split("/").pop() ?? "").toLowerCase();
  return siblings.find(n => n.fm.kind === "hub") ?? siblings.find(n => n.name.toLowerCase() === named) ?? null;
}

/** The hub of a note's own folder (a project note's project hub): the note named like the folder or a `kind: project | hub | meeting-series` note in it; else the note its `project` property links to. null for the hub itself. */
export function folderHub(notes: NoteRec[], path: string): NoteRec | null {
  const me = notes.find(n => n.path === path);
  if (!me) return null;
  const named = unnumbered(me.folder.split("/").pop() ?? "").toLowerCase();
  const hub = notes.find(n => n.folder === me.folder && n.path !== path && (n.name.toLowerCase() === named || ["project", "hub", "meeting-series"].includes(String(n.fm.kind))));
  if (hub) return hub;
  const linked = linkTarget(Array.isArray(me.fm.project) ? me.fm.project[0] : me.fm.project);
  return (linked && notes.find(n => n.name === linked.split("/").pop())) || null;
}

export interface ProjectCard { hub: ListLine; goal: string; todos: ListLine[]; more: number; open: number; papers: number; notes: number; folder: string }

/** Priority 1 (highest), 2 or 3, as a number or text; empty or anything else last. */
const priorityRank = (p: unknown): number => { const n = Number(typeof p === "string" ? p.trim() || NaN : p); return n === 1 || n === 2 || n === 3 ? n : 4; };

/** The open to-dos of one project hub: overdue first, then by planned day (carried over as today), then the Backlog, then unknown `day` values; within a day priority 1 → 2 → 3 → none, then by name. */
function openProjectTodos(todos: NoteRec[], hub: NoteRec, today: Date): { t: NoteRec; late: Date | null }[] {
  /** Dated cards by date; "~" sorts the Backlog after every date, "~~" an unknown `day` after it. */
  const key = (t: NoteRec): string => shownOn(t.fm, today).on || (dayLabel(t.fm, today) === "Backlog" ? "~" : "~~");
  return todos.filter(t => isOpenTodo(t) && pointsTo(t.fm.project, hub))
    .map(t => ({ t, late: overdue(t.fm, today), key: key(t) }))
    .sort((a, b) => (a.late ? 0 : 1) - (b.late ? 0 : 1) || cmp(a.key, b.key)
      || priorityRank(a.t.fm.priority) - priorityRank(b.t.fm.priority) || a.t.path.localeCompare(b.t.path));
}

/** A project hub's To-dos tile: all its open to-dos, with the overdue date or the planned day. */
export function projectTodos(todos: NoteRec[], hub: NoteRec, today: Date): ListLine[] {
  return openProjectTodos(todos, hub, today).map(({ t, late }) => ({ path: t.path, text: t.name,
    badges: [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" } : { text: `· ${dayLabel(t.fm, today)}`, cls: "vt-muted" }, ...waitingBadge(t.fm)] }));
}

export interface WaitingGroup { who: string; lines: ListLine[] }

/** The Waiting on list: open to-dos with `waiting` set (only those of `hub` when given), grouped by what they wait on (same text in any case is one group, shown as the first note by path spells it), groups A → Z, to-dos by priority then name. Each line carries its day or overdue date. */
export function waitingOn(todos: NoteRec[], today: Date, hub?: NoteRec): WaitingGroup[] {
  const groups = new Map<string, { who: string; items: NoteRec[] }>();
  for (const t of [...todos].sort((a, b) => a.path.localeCompare(b.path))) {
    const who = waitingOf(t.fm);
    if (!who || !isOpenTodo(t) || (hub && !pointsTo(t.fm.project, hub))) continue;
    const g = groups.get(who.toLowerCase()) ?? { who, items: [] };
    g.items.push(t);
    groups.set(who.toLowerCase(), g);
  }
  return [...groups.values()].sort((a, b) => a.who.localeCompare(b.who)).map(g => ({
    who: g.who,
    lines: g.items.sort((a, b) => priorityRank(a.fm.priority) - priorityRank(b.fm.priority) || a.name.localeCompare(b.name)).map(t => {
      const late = overdue(t.fm, today);
      return { path: t.path, text: t.name, badges: [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" } : { text: `· ${dayLabel(t.fm, today)}`, cls: "vt-muted" }] };
    }),
  }));
}

/** A project hub's Notes tile: every other note in the project's folder (sub-folders too), newest first, with its last-changed date. */
export function projectNotes(notes: NoteRec[], hub: NoteRec): ListLine[] {
  return notes.filter(n => n.path !== hub.path && inFolder(n.path, hub.folder))
    .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name))
    .map(n => ({ path: n.path, text: n.name, badges: [{ text: `· ${dayMonth(new Date(n.mtime))}`, cls: "vt-muted" }] }));
}

/** The Knowledge index: every topic (a folder directly under Knowledge) with its hub and the notes in it. A topic with no notes yet is listed too. */
export interface TopicLine { hub: ListLine; notes: ListLine[] }
export function topicIndex(notes: NoteRec[], knowledge: string): TopicLine[] {
  const root = knowledge.replace(/\/+$/, "");
  const direct = (n: NoteRec): boolean => n.folder.startsWith(root + "/") && !n.folder.slice(root.length + 1).includes("/");
  const isHub = (n: NoteRec): boolean => n.fm.kind === "hub" || n.name === n.folder.split("/").pop();
  return notes.filter(n => direct(n) && isHub(n)).sort((a, b) => a.name.localeCompare(b.name))
    .map(h => ({
      hub: { path: h.path, text: h.name, badges: [] },
      notes: notes.filter(n => n.path !== h.path && inFolder(n.path, h.folder) && !(direct(n) && isHub(n)))
        .sort((a, b) => a.name.localeCompare(b.name)).map(n => ({ path: n.path, text: n.name, badges: [] })),
    }));
}

/** How many rows a project hub's To-dos and Notes tiles show before "Show all". */
export const PROJECT_TILE_ROWS = 10;

/**
 * One card per project hub, in the projects order. Up to 3 open to-dos of the project (overdue first, then by planned day, then the Backlog),
 * counts of open to-dos, papers (ZotLit collection `Projects/<name>`, or a link to the hub) and other notes in the project's folder.
 */
export function projectCards(hubs: NoteRec[], todos: NoteRec[], papers: NoteRec[], notes: NoteRec[], goals: Record<string, string>, today: Date, mode: CountdownMode = "off"): ProjectCard[] {
  const order = projects(hubs, Infinity, mode, today).map(l => hubs.find(h => h.path === l.path)!);
  return order.map(h => {
    const mine = openProjectTodos(todos, h, today);
    const cols = (p: NoteRec): string[] => (Array.isArray(p.fm.Collections) ? (p.fm.Collections as unknown[]).map(str) : [str(p.fm.Collections)]);
    const nPapers = papers.filter(p => p.fm.kind === "literature" && (cols(p).includes(`Projects/${h.name}`) || (p.links ?? []).includes(h.path))).length;
    return {
      hub: projects([h], Infinity, mode, today)[0], goal: goals[h.path] ?? "", folder: h.folder,
      todos: mine.slice(0, 3).map(({ t, late }) => ({ path: t.path, text: t.name,
        badges: [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" } : { text: `· ${dayLabel(t.fm, today)}`, cls: "vt-muted" }, ...waitingBadge(t.fm)] })),
      more: Math.max(0, mine.length - 3), open: mine.length, papers: nPapers,
      notes: notes.filter(n => n.path !== h.path && inFolder(n.path, h.folder)).length,
    };
  });
}

/** One Go to link: a folder's hub note or base, or an extra note / base / command. */
export interface GotoLink { text: string; path?: string; command?: string; icon?: string }

/** Lucide icon per folder, by its name without the number (the old Go to buttons' icons); any other folder gets `folder`. */
const FOLDER_ICONS: [RegExp, string][] = [
  [/^plan/i, "kanban"], [/^(lab|experiment)/i, "notebook-pen"], [/^literature/i, "library"], [/^chemical/i, "atom"], [/^knowledge/i, "lightbulb"],
  [/^how-?to/i, "wrench"], [/^meeting/i, "users"], [/^project/i, "folder-kanban"], [/^inbox/i, "inbox"], [/^daily/i, "calendar"], [/^archive/i, "archive"],
];
export const folderIcon = (folder: string): string => FOLDER_ICONS.find(([re]) => re.test(unnumbered(folder)))?.[1] ?? "folder";

/** The folder name without its number: "02 Projects" → "Projects". */
export const unnumbered = (folder: string): string => folder.replace(/^\d+\s*[-_.]?\s*/, "");

/**
 * Go to: one link per top-level folder that has a hub, in name (number) order. The hub is the first of: a note with `kind: hub`
 * directly in the folder; a note named like the folder without its number; a .base file directly in it. `hide`: folder names left out.
 */
export function gotoTargets(topFolders: string[], files: NoteRec[], hide: string[] = []): GotoLink[] {
  const out: GotoLink[] = [];
  for (const folder of [...topFolders].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (hide.some(h => h === folder || h === unnumbered(folder))) continue;
    const direct = files.filter(f => f.folder === folder);
    const hub = direct.find(f => f.path.endsWith(".md") && f.fm.kind === "hub")
      ?? direct.find(f => f.path.endsWith(".md") && f.name === unnumbered(folder))
      ?? direct.find(f => f.path.endsWith(".base"));
    // The planning folder opens the to-do board: label it for what it opens
    if (hub) out.push({ text: hub.path.endsWith("/To-do board.base") ? "To-do" : unnumbered(folder), path: hub.path, icon: folderIcon(folder) });
  }
  return out;
}

/** Meeting notes (`kind: meeting`) whose `project` (one link or a list) points at `hub`, newest first by `date`: text is the note name, badge the series. */
export function projectMeetings(notes: NoteRec[], hub: NoteRec): ListLine[] {
  return notes.filter(n => n.fm.kind === "meeting" && pointsTo(n.fm.project, hub))
    .sort((a, b) => str(b.fm.date).localeCompare(str(a.fm.date)) || b.name.localeCompare(a.name))
    .map(n => { const s = linkTarget(n.fm.series); return { path: n.path, text: n.name, badges: s ? [{ text: s, cls: "vt-muted" }] : [] }; });
}

/** How many project meetings a hub shows before "Show all". */
export const PROJECT_MEETINGS = 8;

/** Rows a Home tile shows when its block has no `limit:`. */
export const TILE_ROWS = 8;

/** The Go to links: the automatic ones, then the `extra:` ones that do not open a note an automatic link already opens. */
export function withExtras(auto: GotoLink[], extras: GotoLink[]): GotoLink[] {
  const taken = new Set(auto.flatMap(l => l.path ? [l.path] : []));
  return [...auto, ...extras.filter(l => !l.path || !taken.has(l.path))];
}

/** `key: value` lines of a block (as lab-header's options); `extra:` / `hide:` may repeat or hold a comma list. */
export function blockOptions(source: string): { show: string; limit?: number; hide: string[]; extra: string[] } {
  const out = { show: "", limit: undefined as number | undefined, hide: [] as string[], extra: [] as string[] };
  for (const line of source.split("\n")) {
    const m = /^\s*([a-z]+)\s*:\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2];
    if (key === "show") out.show = val.toLowerCase();
    else if (key === "limit" && /^\d+$/.test(val)) out.limit = Number(val);
    else if (key === "hide") out.hide.push(...val.split(",").map(s => s.trim()).filter(Boolean));
    else if (key === "extra" && val) out.extra.push(val);
  }
  return out;
}
