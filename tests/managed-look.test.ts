// The mark and summary line of the kit-file windows (docs/plans/windows-look.md, Phase 2).
import { describe, it, expect } from "vitest";
import { actionWinState, installSummary, outcomeWinState, reportSummary, reviewSummary } from "../src/kit/managed-look";
import { backupsSummary } from "../src/kit/backups";
import { movedSummary } from "../src/kit/moved-folders";
import type { ManagedAction, ManagedItem, ManagedResult } from "../src/kit/managed";

const item = (action: ManagedAction): ManagedItem => ({ action } as ManagedItem);
const result = (outcome: ManagedResult["outcome"]): ManagedResult => ({ id: "a", dest: "a.md", action: "create", outcome });

describe("kit file windows: marks and summary", () => {
  it("every action has the mark the plan names", () => {
    expect(actionWinState("needs-merge")).toBe("missing");
    for (const a of ["create", "fast-forward", "merge", "missing"] as const) expect(actionWinState(a), a).toBe("todo");
    expect(actionWinState("up-to-date")).toBe("ok");
    for (const a of ["user-modified", "keep", "detached", "off"] as const) expect(actionWinState(a), a).toBe("info");
  });

  it("the review summary: nothing waiting, one, many, conflicts", () => {
    expect(reviewSummary([item("up-to-date"), item("keep")])).toBe("Everything is up to date.");
    expect(reviewSummary([item("create"), item("up-to-date")])).toBe("1 file to update.");
    expect(reviewSummary([item("create"), item("fast-forward"), item("merge")])).toBe("3 files to update.");
    expect(reviewSummary([item("fast-forward"), item("needs-merge")])).toBe("1 file to update, 1 conflict.");
    expect(reviewSummary([item("needs-merge"), item("needs-merge")])).toBe("2 conflicts.");
  });

  it("the report: written files count, left-alone and already-right do not", () => {
    expect(reportSummary([result("skipped"), result("adopted")])).toBe("Nothing was changed.");
    expect(reportSummary([result("created")])).toBe("1 file changed.");
    expect(reportSummary([result("created"), result("updated"), result("merged"), result("moved"), result("adopted")])).toBe("4 files changed.");
    expect(outcomeWinState("skipped")).toBe("info");
    expect(outcomeWinState("adopted")).toBe("ok");
  });

  it("the install confirmation names what would be written", () => {
    const p = (create: number, update: number, folders: number) => ({ create: Array(create).fill("a"), update: Array(update).fill("b"), leftAlone: [], folders: Array(folders).fill("f"), about: {} });
    expect(installSummary(p(0, 0, 0), 0)).toBe("Nothing to write.");
    expect(installSummary(p(1, 0, 0), 0)).toBe("1 file to create.");
    expect(installSummary(p(3, 2, 1), 2)).toBe("3 files to create, 2 files to update, 1 folder to create, 2 settings to change.");
  });

  it("Clear old backups and Find moved folders summaries", () => {
    expect(backupsSummary(0, 0)).toBe("No backups.");
    expect(backupsSummary(4, 0)).toBe("4 backups, none match.");
    expect(backupsSummary(1, 1)).toBe("1 of 1 backup will be moved to the trash.");
    expect(backupsSummary(5, 3)).toBe("3 of 5 backups will be moved to the trash.");
    expect(movedSummary(0)).toBe("Nothing to fix.");
    expect(movedSummary(1)).toBe("1 folder is missing.");
    expect(movedSummary(3)).toBe("3 folders are missing.");
  });
});
