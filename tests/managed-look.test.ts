// The mark and summary line of the kit-file windows (docs/plans/windows-look.md, Phase 2).
import { describe, it, expect } from "vitest";
import { actionWinState, outcomeWinState, reportSummary, reviewSummary } from "../src/kit/managed-look";
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
});
