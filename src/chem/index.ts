// Chemical database: the notes in the user's chemical folder, matched by file name or by their "Names" property (aliases).
// The pure functions work on plain data so they are tested without Obsidian.
import { TFile, TFolder, normalizePath, type App, type TAbstractFile } from "obsidian";
import { prop, toList } from "../frontmatter";

export interface Chemical {
  /** Note name (file name without .md): what a link to the note is written with. */
  name: string;
  path: string;
  /** Other names from the note's Names property (a list, a single value or empty). */
  aliases: string[];
}

export interface Suggestion {
  chemical: Chemical;
  /** The alias that matched, or null when the note name matched. */
  alias: string | null;
}

export interface Linkish { path: string; basename: string }

export function chemicalEntries(files: Linkish[], frontmatter: (path: string) => Record<string, unknown> | undefined): Chemical[] {
  return files.map(f => ({
    name: f.basename,
    path: f.path,
    aliases: toList(prop(frontmatter(f.path), "Names")).map(a => a.trim()).filter(a => a && a.toLowerCase() !== f.basename.toLowerCase())
  })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/** Entries whose name or alias matches the query, best first: name starts with it, alias starts with it, name contains it, alias contains it. */
export function matchChemicals(entries: Chemical[], query: string, limit = 50): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit).map(chemical => ({ chemical, alias: null }));
  const found: { s: Suggestion; rank: number }[] = [];
  for (const chemical of entries) {
    const labels: { text: string; alias: string | null }[] = [{ text: chemical.name, alias: null }, ...chemical.aliases.map(a => ({ text: a, alias: a }))];
    let best: { rank: number; alias: string | null } | undefined;
    for (const l of labels) {
      const at = l.text.toLowerCase().indexOf(q);
      if (at < 0) continue;
      const rank = (at === 0 ? 0 : 2) + (l.alias === null ? 0 : 1);
      if (!best || rank < best.rank) best = { rank, alias: l.alias };
    }
    if (best) found.push({ s: { chemical, alias: best.alias }, rank: best.rank });
  }
  return found.sort((a, b) => a.rank - b.rank).slice(0, limit).map(f => f.s);
}

/** The link text a suggestion inserts: [[Note]], or [[Note|alias]] when it was found through an alias that is safe inside a link. */
export function chemicalLink(s: Suggestion): string {
  const a = s.alias;
  return a && !/[[\]|#^]/.test(a) ? `[[${s.chemical.name}|${a}]]` : `[[${s.chemical.name}]]`;
}

/** An unfinished [[link at the cursor: where it starts (the first [) and what has been typed after the brackets. */
export function openLink(value: string, cursor: number): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const start = before.lastIndexOf("[[");
  if (start < 0) return null;
  const query = before.slice(start + 2);
  if (/[\]|\n]/.test(query)) return null;
  return { start, query };
}

/** Replaces the unfinished link with the finished one (and the closing ]] that may already follow). Returns the new text and cursor. */
export function insertLink(value: string, cursor: number, start: number, link: string): { value: string; cursor: number } {
  const after = value.slice(cursor).replace(/^\]\]/, "");
  return { value: value.slice(0, start) + link + after, cursor: start + link.length };
}

/** Every chemical note in the folder (subfolders included). Empty list when no folder is set or it does not exist. */
export function listChemicals(app: App, folder: string): Chemical[] {
  const path = folder.trim() ? normalizePath(folder.trim()) : "";
  const root = path ? app.vault.getFolderByPath(path) : null;
  if (!root) return [];
  const files: TFile[] = [];
  const walk = (children: TAbstractFile[]): void => {
    for (const c of children) {
      if (c instanceof TFile) { if (c.extension === "md") files.push(c); }
      else if (c instanceof TFolder) walk(c.children);
    }
  };
  walk(root.children);
  return chemicalEntries(files, p => {
    const f = app.vault.getFileByPath(p);
    return f ? app.metadataCache.getFileCache(f)?.frontmatter : undefined;
  });
}
