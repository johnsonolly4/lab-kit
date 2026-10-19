// What the kit-file windows (Review update, Manage kit files, the report) show per file: the round mark and the summary line. Pure.
import type { InstallPreview, ManagedAction, ManagedItem, ManagedResult } from "./managed";
import type { WinState } from "./window-look";

/** Conflict = red; something the kit would add, change or merge = amber; same = green; everything left alone on purpose = grey. */
export function actionWinState(action: ManagedAction): WinState {
  switch (action) {
    case "needs-merge": return "missing";
    case "create": case "fast-forward": case "merge": case "missing": return "todo";
    case "up-to-date": return "ok";
    case "user-modified": case "keep": case "detached": case "off": return "info";
  }
}

const files = (n: number): string => `${n} ${n === 1 ? "file" : "files"}`;
/** The Kit files window's "Tick or untick all N files with a box" line and "Update (N files)" button text. */
export const tickAllLine = (n: number): string => `Tick or untick all ${files(n)} with a box`;
export const updateLabel = (n: number): string => n ? `Update (${files(n)})` : "Update";

/** The big line: files waiting for an update (new, updated, to merge, deleted by you, and kept files the kit has a newer version of: `newer`), plus conflicts; or that everything is up to date. */
export function reviewSummary(items: ManagedItem[], newer: (i: ManagedItem) => boolean = () => false): string {
  const waiting = items.filter(i => actionWinState(i.action) === "todo" || newer(i)).length, conflicts = items.filter(i => i.action === "needs-merge").length;
  if (!waiting && !conflicts) return "Everything is up to date.";
  return [waiting ? `${files(waiting)} to update` : "", conflicts ? `${conflicts} ${conflicts === 1 ? "conflict" : "conflicts"}` : ""].filter(Boolean).join(", ") + ".";
}

/** A report row: written or already right = ✓, left alone = grey i. */
export const outcomeWinState = (o: ManagedResult["outcome"]): WinState => (o === "skipped" ? "info" : "ok");

/** The big line of the report: how many files were written. */
export function reportSummary(results: ManagedResult[]): string {
  const n = results.filter(r => r.outcome === "created" || r.outcome === "updated" || r.outcome === "merged" || r.outcome === "moved").length;
  return n ? `${files(n)} changed.` : "Nothing was changed.";
}

/** The big line of the install confirmation: what would be written, and how many settings would change. */
export function installSummary(p: InstallPreview, settings: number): string {
  const parts = [p.create.length ? `${files(p.create.length)} to create` : "", p.update.length ? `${files(p.update.length)} to update` : "",
    p.folders.length ? `${p.folders.length} ${p.folders.length === 1 ? "folder" : "folders"} to create` : "", settings ? `${settings} ${settings === 1 ? "setting" : "settings"} to change` : ""].filter(Boolean);
  return parts.length ? parts.join(", ") + "." : "Nothing to write.";
}
