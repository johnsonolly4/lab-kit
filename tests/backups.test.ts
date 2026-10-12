import { describe, it, expect } from "vitest";
import { listBackupRuns, olderThan, stampTime } from "../src/kit/backups";

const NOW = Date.UTC(2026, 9, 9, 12);
const adapter = (folders: string[]) => ({ exists: async () => true, list: async () => ({ files: [], folders }) });

describe("old kit backups", () => {
  it("reads the time from a backup folder's name and nothing else", () => {
    expect(stampTime("2026-10-09T16-30-00-123Z")).toBe(Date.UTC(2026, 9, 9, 16, 30, 0, 123));
    expect(stampTime("kit-base")).toBeNull();
    expect(stampTime("2026-10-09")).toBeNull();
  });
  it("lists only the stamped folders, oldest first", async () => {
    const runs = await listBackupRuns(adapter(["b/2026-10-09T10-00-00-000Z", "b/mine", "b/2026-08-01T10-00-00-000Z"]), "b");
    expect(runs.map(r => r.name)).toEqual(["2026-08-01T10-00-00-000Z", "2026-10-09T10-00-00-000Z"]);
    expect(runs[0].path).toBe("b/2026-08-01T10-00-00-000Z");
  });
  it("is empty when the backup folder does not exist", async () => {
    expect(await listBackupRuns({ exists: async () => false, list: async () => ({ files: [], folders: [] }) }, "b")).toEqual([]);
    expect(await listBackupRuns(adapter([]), "")).toEqual([]);
  });
  it("picks the runs older than N days, or all", async () => {
    const runs = await listBackupRuns(adapter(["b/2026-10-08T10-00-00-000Z", "b/2026-09-01T10-00-00-000Z", "b/2026-05-01T10-00-00-000Z"]), "b");
    expect(olderThan(runs, 30, NOW).map(r => r.name)).toEqual(["2026-05-01T10-00-00-000Z", "2026-09-01T10-00-00-000Z"]);
    expect(olderThan(runs, 7, NOW)).toHaveLength(2);
    expect(olderThan(runs, 0, NOW)).toHaveLength(3);
  });
});
