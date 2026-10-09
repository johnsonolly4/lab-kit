// Homepage and Projects overview lists (Phase 5a): which notes each block shows, in which order, with which badge.
// Pure (no Obsidian runtime). Each rule is ported from the Dataview / DataviewJS query it replaced in kits/planning/00 Home.md and
// 02 Projects/Projects overview.md (kit 0.5.2); docs/plans/phase-5-homepage-meetings.md.
import { DAYS, isoWeekday, parseDay, ymd } from "./todo";

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
const dayRank = (day: string): number => { const i = (DAYS as readonly string[]).indexOf(day); return i < 0 ? 6 : i + 1; };

/** The due date of a to-do when it is before today (a YYYY-MM-DD `due`, or the date part of a date-time). */
function overdue(fm: Record<string, unknown>, today: Date): Date | null {
  const due = parseDay(str(fm.due).slice(0, 10));
  return due && ymd(due) < ymd(today) ? due : null;
}
const isOpenTodo = (n: NoteRec): boolean => n.fm.kind === "todo" && n.fm.done !== true && str(n.fm.day) !== "Done";

/** This week: open to-dos planned Mon–Fri or overdue. Overdue first, then Mon → Fri. Badge: overdue (date) / today / the day; carried over. */
export function thisWeek(todos: NoteRec[], today: Date): ListLine[] {
  const todayName = isoWeekday(today) <= 5 ? DAYS[isoWeekday(today) - 1] : "";
  return todos
    .filter(n => isOpenTodo(n) && ((DAYS as readonly string[]).includes(str(n.fm.day)) || overdue(n.fm, today)))
    .map(n => ({ n, late: overdue(n.fm, today) }))
    .sort((a, b) => (a.late ? 0 : 1) - (b.late ? 0 : 1) || dayRank(str(a.n.fm.day)) - dayRank(str(b.n.fm.day)) || a.n.path.localeCompare(b.n.path))
    .map(({ n, late }) => {
      const day = str(n.fm.day);
      const badges: Badge[] = [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" }
        : day === todayName ? { text: "today", cls: "vt-badge vt-today" } : { text: `· ${day}`, cls: "vt-muted" }];
      if (n.fm.rolled === true) badges.push({ text: "carried over", cls: "vt-badge vt-rolled" });
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

const statusRank = (s: string): number => (s === "Active" ? 0 : s === "Paused" ? 1 : s === "Done" ? 2 : 3);

/** Projects: project hubs, Active → Paused → Done (others last), then by name. */
export function projects(notes: NoteRec[], limit = Infinity): ListLine[] {
  return notes.filter(n => n.fm.kind === "project")
    .sort((a, b) => statusRank(str(a.fm.Status)) - statusRank(str(b.fm.Status)) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(n => { const s = str(n.fm.Status); return { path: n.path, text: n.name, badges: s ? [{ text: s.toLowerCase(), cls: `vt-badge vt-${slug(s)}` }] : [] }; });
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

export interface ProjectCard { hub: ListLine; goal: string; todos: ListLine[]; more: number; open: number; papers: number; notes: number; folder: string }

/**
 * One card per project hub, in the projects order. Up to 3 open to-dos of the project (overdue first, then Mon → Fri → Backlog → other),
 * counts of open to-dos, papers (ZotLit collection `Projects/<name>`, or a link to the hub) and other notes in the project's folder.
 */
export function projectCards(hubs: NoteRec[], todos: NoteRec[], papers: NoteRec[], notes: NoteRec[], goals: Record<string, string>, today: Date): ProjectCard[] {
  const order = projects(hubs).map(l => hubs.find(h => h.path === l.path)!);
  const rank = (d: string): number => { const r = dayRank(d); return d === "Backlog" ? 6 : r === 6 ? 8 : r; };
  return order.map(h => {
    const mine = todos.filter(t => isOpenTodo(t) && pointsTo(t.fm.project, h))
      .map(t => ({ t, late: overdue(t.fm, today) }))
      .sort((a, b) => ((a.late ? 0 : 1) * 10 + rank(str(a.t.fm.day))) - ((b.late ? 0 : 1) * 10 + rank(str(b.t.fm.day))) || a.t.path.localeCompare(b.t.path));
    const cols = (p: NoteRec): string[] => (Array.isArray(p.fm.Collections) ? (p.fm.Collections as unknown[]).map(str) : [str(p.fm.Collections)]);
    const nPapers = papers.filter(p => p.fm.kind === "literature" && (cols(p).includes(`Projects/${h.name}`) || (p.links ?? []).includes(h.path))).length;
    return {
      hub: projects([h])[0], goal: goals[h.path] ?? "", folder: h.folder,
      todos: mine.slice(0, 3).map(({ t, late }) => ({ path: t.path, text: t.name,
        badges: [late ? { text: `overdue ${dayMonth(late)}`, cls: "vt-badge vt-overdue" } : { text: `· ${str(t.fm.day)}`, cls: "vt-muted" }] })),
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
    if (hub) out.push({ text: unnumbered(folder), path: hub.path, icon: folderIcon(folder) });
  }
  return out;
}

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
