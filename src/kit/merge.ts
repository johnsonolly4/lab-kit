// Three-way line merge for kit files: base = what the kit installed, ours = your file, theirs = the new kit version.
// Pure (no Obsidian). Conflicts are only counted or offered as hunks: conflict markers are never written into a live file.
import { diff3Merge } from "node-diff3";

export interface MergeResult {
  /** True when every edit could be combined (no overlapping changes). */
  clean: boolean;
  /** The merged file text; empty when `clean` is false. */
  text: string;
  /** How many places both sides changed differently. */
  conflicts: number;
}

/** A stretch of the file: the same on both sides / combined cleanly (`ok`), or changed differently by you and the kit (`conflict`). */
export type Region = { ok: string[] } | { conflict: { ours: string[]; base: string[]; theirs: string[] } };
/** What to do with one conflict: your lines, the kit's lines, both (yours first), or text typed in the window. */
export type HunkChoice = "mine" | "kit" | "both" | { edit: string };

/** Same normalising as the hash in managed.ts (BOM off, "\n" line ends), split into lines. */
const lines = (text: string): string[] => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n/g, "\n").split("\n");
const join = (parts: string[], ours: string): string => {
  const text = parts.join("\n");
  return ours.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text;
};

export function mergeRegions(base: string, ours: string, theirs: string): Region[] {
  return diff3Merge(lines(ours), lines(base), lines(theirs), { excludeFalseConflicts: true })
    .map((r): Region => r.conflict ? { conflict: { ours: r.conflict.a, base: r.conflict.o, theirs: r.conflict.b } } : { ok: r.ok ?? [] });
}

export function merge3(base: string, ours: string, theirs: string): MergeResult {
  const regions = mergeRegions(base, ours, theirs);
  const conflicts = regions.filter(r => "conflict" in r).length;
  if (conflicts) return { clean: false, text: "", conflicts };
  return { clean: true, text: join(regions.flatMap(r => "ok" in r ? r.ok : []), ours), conflicts: 0 };
}

/** The lines a choice puts in the file. */
export function hunkLines(h: { ours: string[]; theirs: string[] }, choice: HunkChoice): string[] {
  if (choice === "mine") return h.ours;
  if (choice === "kit") return h.theirs;
  if (choice === "both") return [...h.ours, ...h.theirs];
  return choice.edit === "" ? [] : choice.edit.replace(/\r\n/g, "\n").split("\n");
}

/** The file with every conflict resolved. `choices` is one entry per conflict, in order; returns null while any is undecided (null / missing). */
export function resolveRegions(regions: Region[], choices: (HunkChoice | null | undefined)[], ours: string): string | null {
  const out: string[] = [];
  let n = 0;
  for (const r of regions) {
    if ("ok" in r) { out.push(...r.ok); continue; }
    const c = choices[n++];
    if (c === null || c === undefined) return null;
    out.push(...hunkLines(r.conflict, c));
  }
  return join(out, ours);
}
