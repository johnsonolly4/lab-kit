// What the kit-file windows (Review update, Manage kit files, the report) show per file: the round mark and the summary line. Pure.
import type { ManagedAction, ManagedItem, ManagedResult } from "./managed";
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

/** The big line: files waiting for an update (new, updated, to merge, deleted by you), plus conflicts; or that everything is up to date. */
export function reviewSummary(items: ManagedItem[]): string {
  const waiting = items.filter(i => actionWinState(i.action) === "todo").length, conflicts = items.filter(i => i.action === "needs-merge").length;
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
