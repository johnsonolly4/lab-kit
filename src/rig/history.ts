// The `## Rig history` table in a rig note: a plain Markdown table, newest row last, under a format line. Pure (no Obsidian runtime).
// Lab Kit only ever adds a row at the end of the table (or the whole section when it is missing); it never changes a row it did not write.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 4. Format version 1 (a missing format line also means 1).
import { isSeparator, splitRow } from "../calc/engine";

export const HISTORY_FORMAT = 1;
export const HISTORY_HEADING = "Rig history";
const FORMAT_LINE = `<!-- lab-kit rig-history format: ${HISTORY_FORMAT} -->`;
const HEADER = ["Date", "Snapshot", "Change"];

export interface HistoryRow { date: string; /** The link to the snapshot file, as the cell holds it. */ snapshot: string; change: string }
export interface History {
  /** Index of the `## Rig history` line, -1 when the note has none. */
  heading: number;
  /** The format number of the format line; 1 when there is no format line. */
  format: number;
  /** Index of the format line, -1 when there is none. */
  formatLine: number;
  /** Header cells as written, and the rows (every cell, by header name; unknown columns kept). */
  header: string[]; rows: Record<string, string>[];
  /** Lines of the table (first, last), -1 when the section has no table. */
  tableFirst: number; tableLast: number;
}

/** Headings and fenced code are told apart the way the rest of Lab Kit reads notes (parts.ts). */
export function readHistory(text: string): History {
  const lines = text.split("\n");
  const none: History = { heading: -1, format: HISTORY_FORMAT, formatLine: -1, header: [], rows: [], tableFirst: -1, tableLast: -1 };
  let fence = "", at = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && line === f[1] && f[1][0] === fence[0] && f[1].length >= fence.length) fence = ""; continue; }
    if (f) { fence = f[1]; continue; }
    if (new RegExp(`^#{1,6}\\s+${HISTORY_HEADING}\\s*#*$`, "i").test(line)) { at = i; break; }
  }
  if (at < 0) return none;
  const out: History = { ...none, heading: at };
  let i = at + 1;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,6}\s/.test(line)) break;   // the next heading ends the section
    const fm = /^<!--\s*lab-kit rig-history format:\s*(\d+)\s*-->$/.exec(line);
    if (fm) { out.format = Number(fm[1]); out.formatLine = i; continue; }
    if (line.startsWith("|") && isSeparator(lines[i + 1] ?? "")) {
      out.tableFirst = i; out.header = splitRow(line);
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i]);
        out.rows.push(Object.fromEntries(out.header.map((h, n) => [h, cells[n] ?? ""])));
        i++;
      }
      out.tableLast = i - 1;
      break;
    }
  }
  return out;
}

const cell = (s: string): string => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();

export type Appended = { text: string } | { refused: string };

/** The note with one row added at the end of its history table. Every other byte stays. A missing table is added (with the format line); a missing section is added at the end of the note. A newer format, or a table without Date and Snapshot columns, adds nothing (`refused` says why). */
export function appendRow(text: string, row: HistoryRow): Appended {
  const h = readHistory(text);
  const crlf = text.includes("\r\n");
  const eol = crlf ? "\r\n" : "\n";
  if (h.heading >= 0 && h.format > HISTORY_FORMAT) return { refused: `The ${HISTORY_HEADING} table was made with a newer Lab Kit: update the plugin.` };
  const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
  if (h.heading >= 0 && h.tableFirst >= 0) {
    const col = (name: string): number => h.header.findIndex(c => c.trim().toLowerCase() === name.toLowerCase());
    if (col("Date") < 0 || col("Snapshot") < 0) return { refused: `The ${HISTORY_HEADING} table has no Date and Snapshot columns, so no row was added.` };
    const cells = h.header.map(() => "");
    cells[col("Date")] = cell(row.date); cells[col("Snapshot")] = cell(row.snapshot);
    if (col("Change") >= 0) cells[col("Change")] = cell(row.change);
    const lines = text.split("\n");
    lines.splice(h.tableLast + 1, 0, line(cells) + (crlf ? "\r" : ""));
    return { text: lines.join("\n") };
  }
  const block = [FORMAT_LINE, line(HEADER), line(HEADER.map(() => "---")).replace(/ /g, ""), line([cell(row.date), cell(row.snapshot), cell(row.change)])];
  if (h.heading >= 0) {
    const lines = text.split("\n");
    lines.splice(h.heading + 1, 0, ...(h.formatLine >= 0 ? block.slice(1) : block).map(l => l + (crlf ? "\r" : "")));
    return { text: lines.join("\n") };
  }
  const body = text.endsWith("\n") || text === "" ? text : text + eol;
  return { text: `${body}${text === "" ? "" : eol}## ${HISTORY_HEADING}${eol}${block.join(eol)}${eol}` };
}

/** The file a Snapshot cell links to: `[[path]]`, `[[path|text]]`, `[[path#x]]`, `![[path]]` or `[text](path)`; null for a cell with no link. */
export function linkTarget(cell: string): string | null {
  const w = /!?\[\[([^\]|#]+?)\\?(?:[|#][^\]]*)?\]\]/.exec(cell);
  if (w) return w[1].trim() || null;
  const m = /\[[^\]]*\]\(\s*<?([^)>]+?)>?\s*\)/.exec(cell);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).trim() || null; } catch { return m[1].trim(); }
}

/** The snapshot links of the rig note's history table, in table order. null when the table cannot be used (no section, no table, no Snapshot column, or a newer format: Lab Kit then does not read it). Rows without a link are skipped. */
export function historyTargets(text: string): string[] | null {
  const h = readHistory(text);
  if (h.heading < 0 || h.tableFirst < 0 || h.format > HISTORY_FORMAT) return null;
  const col = h.header.find(c => c.trim().toLowerCase() === "snapshot");
  if (col === undefined) return null;
  return h.rows.flatMap(r => { const t = linkTarget((r[col] ?? "").replace(/\r/g, "")); return t ? [t] : []; });
}

export interface Listed { /** The link target as the row holds it. */ target: string; /** The vault path of the file it points to, null when there is no such file. */ path: string | null }
export interface Reconciled { /** The vault path of the last row whose file exists, null when no row has one. */ latest: string | null; problems: string[] }

const baseName = (p: string): string => p.slice(p.lastIndexOf("/") + 1);

/** Compares the table with the folder (`folderPaths`: the snapshot files found there). Nothing is changed; the problems are texts for the rig block. With no linked row there is nothing to compare, so no problems. */
export function reconcile(listed: Listed[], folderPaths: string[]): Reconciled {
  if (!listed.length) return { latest: null, problems: [] };
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const l of listed) {
    if (l.path !== null || seen.has(l.target)) continue;
    seen.add(l.target);
    problems.push(`History lists "${baseName(l.target)}" but the file is missing.`);
  }
  const known = new Set(listed.flatMap(l => l.path === null ? [] : [l.path]));
  for (const p of folderPaths) if (!known.has(p)) problems.push(`"${baseName(p)}" is in the history folder but not in the table.`);
  const latest = [...listed].reverse().find(l => l.path !== null)?.path ?? null;
  return { latest, problems };
}
