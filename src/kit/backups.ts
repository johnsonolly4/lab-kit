// Old kit backups: every update that replaces a file copies it to <backup folder>/<time stamp>/…; nothing ever removes those folders.
// This lists them (by the time in their name) and picks the ones to clear. Pure apart from the adapter calls.
import type { DataAdapter } from "obsidian";
import { kitJoin } from "./paths";

export interface BackupRun { name: string; path: string; time: number }

/** `2026-10-09T16-30-00-123Z` (the folder name `kitBackupPath` makes) as a time in ms; null for any other name. */
export function stampTime(name: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(name);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]) : null;
}

/** The time-stamped folders directly inside the backup folder, oldest first. Other folders and files there are not ours and are never listed. */
export async function listBackupRuns(adapter: Pick<DataAdapter, "exists" | "list">, folder: string): Promise<BackupRun[]> {
  if (!folder || !(await adapter.exists(folder))) return [];
  const { folders } = await adapter.list(folder);
  const runs: BackupRun[] = [];
  for (const f of folders) {
    const name = f.slice(f.lastIndexOf("/") + 1), time = stampTime(name);
    if (time !== null) runs.push({ name, path: kitJoin(folder, name), time });
  }
  return runs.sort((a, b) => a.time - b.time);
}

/** The runs older than `days` days before `now`; `days` 0 = all of them. */
export const olderThan = (runs: BackupRun[], days: number, now: number): BackupRun[] =>
  days <= 0 ? runs : runs.filter(r => r.time < now - days * 864e5);

/** The big line of Clear old backups: how many backups there are and how many the choice would move to the trash. */
export function backupsSummary(total: number, picked: number): string {
  if (!total) return "No backups.";
  return picked ? `${picked} of ${total} ${total === 1 ? "backup" : "backups"} will be moved to the trash.` : `${total} ${total === 1 ? "backup" : "backups"}, none match.`;
}
