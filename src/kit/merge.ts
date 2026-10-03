// Three-way line merge for kit files: base = what the kit installed, ours = your file, theirs = the new kit version.
// Pure (no Obsidian). Conflicts are only counted: conflict markers are never written into a live file.
import { diff3Merge } from "node-diff3";

export interface MergeResult {
  /** True when every edit could be combined (no overlapping changes). */
  clean: boolean;
  /** The merged file text; empty when `clean` is false. */
  text: string;
  /** How many places both sides changed differently. */
  conflicts: number;
}

/** Same normalising as the hash in managed.ts (BOM off, "\n" line ends), split into lines. */
const lines = (text: string): string[] => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n/g, "\n").split("\n");

export function merge3(base: string, ours: string, theirs: string): MergeResult {
  const regions = diff3Merge(lines(ours), lines(base), lines(theirs), { excludeFalseConflicts: true });
  const conflicts = regions.filter(r => r.conflict).length;
  if (conflicts) return { clean: false, text: "", conflicts };
  const text = regions.flatMap(r => r.ok ?? []).join("\n");
  return { clean: true, text: ours.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text, conflicts: 0 };
}
