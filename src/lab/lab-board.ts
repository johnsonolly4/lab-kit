// The lab notes board (own Bases view, lab-board-view.ts): rows, running columns, summary counts and the completed table. Pure (no Obsidian runtime).
// Built from prototype B3 (owner chat 2026-10-21); plan docs/plans/lab-notes-board-and-completed-view.md, "Build phases from B3".
import { prop, toList } from "../frontmatter";
import { linkTarget } from "../planning/lists";
import { isFinishedTodo } from "../planning/todo";

/** The running columns, in board order. A drop on one writes that Status. There is no Closed column: Close experiment closes a note. */
export const RUNNING = ["Planned", "Started", "Processing results"] as const;
/** The column for running notes whose Status is none of RUNNING (empty or a word of the user's own). Not a drop target. */
export const OTHER = "(other)";
/** Result words the Close window offers, with the badge look each gets. */
export const RESULT_LOOK: Record<string, string> = { Worked: "is-ok", Partly: "is-warn", Failed: "is-bad", Unclear: "is-info" };

/** What the view reads from one lab note: front matter, its check boxes (from the metadata cache) and the open to-dos that link to it. */
export interface LabNoteIn { path: string; name: string; fm: Record<string, unknown>; boxes: number; ticked: number; todos: number }

export interface LabRow {
  path: string; name: string;
  /** `ABC0014-A` of `ABC0014-A - RAFT chain extension`; the whole name when there is no ` - `. */
  code: string;
  /** The part after the first ` - `, "" when none. */
  title: string;
  status: string; cls: string; start: string; chems: string[]; outcome: string; result: string;
  /** `closed_on` as YYYY-MM-DD, "" when not set. */
  closedOn: string;
  boxes: number; ticked: number; todos: number;
}

const first = (v: unknown): string => (toList(v)[0] ?? "").trim();
/** YYYY-MM-DD from a date value (text or Date), "" when there is none. */
export function isoDay(v: unknown): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return /\d{4}-\d{2}-\d{2}/.exec(first(v))?.[0] ?? "";
}

/** `ABC0014-A - RAFT chain extension` → code `ABC0014-A`, title `RAFT chain extension`. */
export function splitName(name: string): { code: string; title: string } {
  const i = name.indexOf(" - ");
  return i < 0 ? { code: name, title: "" } : { code: name.slice(0, i), title: name.slice(i + 3) };
}

export function labRow(n: LabNoteIn): LabRow {
  const { code, title } = splitName(n.name);
  return {
    path: n.path, name: n.name, code, title,
    status: first(prop(n.fm, "Status")), cls: first(prop(n.fm, "Exp. Class")), start: isoDay(prop(n.fm, "Exp. Start")),
    chems: toList(prop(n.fm, "Chemicals")).map(linkTarget).map(c => c.split("/").pop() ?? c).filter(Boolean),
    outcome: toList(prop(n.fm, "Outcome")).join(", "), result: first(prop(n.fm, "Result")), closedOn: isoDay(prop(n.fm, "closed_on")),
    boxes: n.boxes, ticked: n.ticked, todos: n.todos,
  };
}

/** Open to-dos per lab note name, from to-dos whose `experiment` links to it (`done` not true). Keyed by the note's name (no folder, no .md). */
export function openTodosByNote(todos: { fm: Record<string, unknown> }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of todos) {
    if (t.fm.experiment == null || isFinishedTodo(t.fm)) continue;
    for (const v of toList(t.fm.experiment)) {
      const name = linkTarget(v).split("/").pop() ?? "";
      if (name) out.set(name, (out.get(name) ?? 0) + 1);
    }
  }
  return out;
}

/** Completed = Status Closed or `closed_on` set (the same rule as the base's Completed experiments view). */
export const isCompleted = (r: LabRow): boolean => r.status === "Closed" || !!r.closedOn;

export interface Column { key: string; label: string; rows: LabRow[] }
/** The running board: one column per RUNNING status (always shown, even empty), then Other only when a running note has another Status. Rows by name, newest number first. */
export function runningColumns(rows: LabRow[]): Column[] {
  const run = rows.filter(r => !isCompleted(r)).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  const cols: Column[] = RUNNING.map(s => ({ key: s, label: s, rows: run.filter(r => r.status === s) }));
  const other = run.filter(r => !(RUNNING as readonly string[]).includes(r.status));
  if (other.length) cols.push({ key: OTHER, label: "Other", rows: other });
  return cols;
}

/** The column a narrow pane shows: the one picked before while it still exists, else Started, else the first. */
export function pickColumn(cols: Column[], picked: string): string {
  return cols.some(c => c.key === picked) ? picked : cols.find(c => c.key === "Started")?.key ?? cols[0]?.key ?? "";
}

/** `DCM, AIBN, Styrene +2`: the first three chemicals, then how many more. */
export function chemText(chems: string[]): string {
  return chems.slice(0, 3).join(", ") + (chems.length > 3 ? ` +${chems.length - 3}` : "");
}

/** Progress as a whole percent, null when the note has no check boxes. */
export const progress = (r: LabRow): number | null => (r.boxes ? Math.round((100 * r.ticked) / r.boxes) : null);

export interface TileGroup { title: string; tiles: [string, number][] }
const tally = (rows: LabRow[], f: (r: LabRow) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) { const k = f(r) || "(none)"; m.set(k, (m.get(k) ?? 0) + 1); }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
/** The Summary tab: overview, by Status, by Exp. Class, by Result (completed only). A group with nothing to count is left out. */
export function summary(rows: LabRow[]): TileGroup[] {
  const done = rows.filter(isCompleted);
  const groups: TileGroup[] = [
    { title: "Overview", tiles: [["All", rows.length], ["Running", rows.length - done.length], ["Completed", done.length]] },
    { title: "By status", tiles: tally(rows, r => r.status) },
    { title: "By Exp. Class", tiles: tally(rows, r => r.cls) },
    { title: "By result (completed only)", tiles: tally(done, r => r.result) },
  ];
  return groups.filter(g => g.tiles.length);
}

/** The completed table's columns, in order. `closedOn` is shown as Ended. */
export const COMPLETED_COLS = [["name", "Name"], ["cls", "Exp. Class"], ["chems", "Chemicals"], ["outcome", "Outcome"], ["result", "Result"], ["closedOn", "Ended"]] as const;
export type ColKey = (typeof COMPLETED_COLS)[number][0];
export interface CompletedState { q: string; cls: string; result: string; sortKey: ColKey; sortDir: 1 | -1 }
export const COMPLETED_START: CompletedState = { q: "", cls: "", result: "", sortKey: "closedOn", sortDir: -1 };

export const cellText = (r: LabRow, k: ColKey): string => (k === "chems" ? r.chems.join(", ") : r[k]);

/** The chip values of a filter: the ones the completed notes use, sorted. */
export function chipValues(rows: LabRow[], key: "cls" | "result"): string[] {
  return Array.from(new Set(rows.filter(isCompleted).map(r => r[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/** Completed notes that pass the chips and the search, sorted. The search matches every word (any case) in the shown fields or in the note's text from `body` (when read). */
export function completedRows(rows: LabRow[], st: CompletedState, body: (path: string) => string | undefined = () => undefined): LabRow[] {
  const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (r: LabRow): string => (COMPLETED_COLS.map(([k]) => cellText(r, k)).join(" ") + " " + (body(r.path) ?? "")).toLowerCase();
  return rows
    .filter(r => isCompleted(r) && (!st.cls || r.cls === st.cls) && (!st.result || r.result === st.result))
    .filter(r => { if (!words.length) return true; const h = hay(r); return words.every(w => h.includes(w)); })
    .sort((a, b) => cellText(a, st.sortKey).localeCompare(cellText(b, st.sortKey), undefined, { numeric: true }) * st.sortDir || b.name.localeCompare(a.name, undefined, { numeric: true }));
}

/** A header click: the same column flips the direction; another column sorts by it (Ended newest first, the rest A to Z). */
export function nextSort(st: CompletedState, key: ColKey): Pick<CompletedState, "sortKey" | "sortDir"> {
  if (st.sortKey === key) return { sortKey: key, sortDir: st.sortDir === 1 ? -1 : 1 };
  return { sortKey: key, sortDir: key === "closedOn" ? -1 : 1 };
}
