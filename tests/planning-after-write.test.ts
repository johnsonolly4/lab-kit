// Writing `after` and `sub` on a to-do's front matter (src/planning/after-write.ts).
import { describe, it, expect } from "vitest";
import { changeAfter, changeSub } from "../src/planning/after-write";

const appWith = (fm: Record<string, unknown>) => ({
  vault: { getFileByPath: (p: string) => (p === "T/B.md" ? { path: p } : null) },
  fileManager: { processFrontMatter: async (_f: unknown, fn: (fm: Record<string, unknown>) => void) => { fn(fm); } },
}) as never;

describe("changeSub", () => {
  it("sets, replaces and clears `sub` and leaves `after` and other properties alone", async () => {
    const fm: Record<string, unknown> = { kind: "todo", after: "[[A]]" };
    const app = appWith(fm);
    await changeSub(app, "T/B.md", () => "[[D]]");
    expect(fm).toEqual({ kind: "todo", after: "[[A]]", sub: "[[D]]" });
    await changeSub(app, "T/B.md", () => "[[E]]");
    expect(fm.sub).toBe("[[E]]");
    await changeSub(app, "T/B.md", () => undefined);
    expect(fm).toEqual({ kind: "todo", after: "[[A]]" });
    expect("sub" in fm).toBe(false);   // the key is deleted, not left empty
  });
  it("passes the old value to `change` (so an undo can restore it)", async () => {
    const fm: Record<string, unknown> = { sub: "[[D]]" };
    let old: unknown;
    await changeSub(appWith(fm), "T/B.md", v => { old = v; return undefined; });
    expect(old).toBe("[[D]]");
  });
  it("a to-do that is not there throws", async () => {
    await expect(changeSub(appWith({}), "T/Missing.md", () => "[[D]]")).rejects.toThrow("to-do not found");
  });
});

describe("changeAfter (unchanged behaviour)", () => {
  it("still writes `after` and deletes it on undefined", async () => {
    const fm: Record<string, unknown> = { sub: "[[D]]" };
    const app = appWith(fm);
    await changeAfter(app, "T/B.md", () => "[[A]]");
    expect(fm).toEqual({ sub: "[[D]]", after: "[[A]]" });
    await changeAfter(app, "T/B.md", () => undefined);
    expect(fm).toEqual({ sub: "[[D]]" });
  });
});

describe("insertBetween", () => {
  const T = "T/";
  const hub = { path: "P/Alpha.md", name: "Alpha", folder: "P", fm: { kind: "project" }, ctime: 0, mtime: 0 };
  const note = (name: string, fm: Record<string, unknown> = {}) => ({ path: `${T}${name}.md`, name, folder: "T", fm: { kind: "todo", project: "[[Alpha]]", ...fm }, ctime: 0, mtime: 0 });
  const fms: Record<string, Record<string, unknown>> = { "T/A.md": {}, "T/B.md": { after: "[[A]]" }, "T/X.md": {} };
  const app = {
    vault: { getFileByPath: (p: string) => (p in fms ? { path: p } : null) },
    metadataCache: { fileToLinktext: (f: { path: string }) => f.path.replace(/^T\//, "").replace(/\.md$/, "") },
    fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(fms[f.path]); } },
  } as never;

  it("writes N after A and B after N instead of A, as one Undo step, and Undo puts both back", async () => {
    const { readPlan } = await import("../src/planning/plan");
    const { PlanHistory } = await import("../src/planning/plan-history");
    const { insertBetween } = await import("../src/planning/add-after");
    const { runHistory } = await import("../src/planning/after-write");
    const plan = readPlan([note("A"), note("B", { after: "[[A]]" }), note("X")], hub);
    const history = new PlanHistory();
    const step = await insertBetween(app, history, plan, "T/A.md", "T/B.md", "T/X.md", 7);
    expect(step).not.toBeNull();
    expect(fms["T/X.md"]).toEqual({ after: "[[A]]" });
    expect(fms["T/B.md"]).toEqual({ after: "[[X]]" });
    await runHistory(app, history, "undo", step!);
    expect(fms["T/X.md"]).toEqual({});
    expect(fms["T/B.md"]).toEqual({ after: "[[A]]" });
  });
});
