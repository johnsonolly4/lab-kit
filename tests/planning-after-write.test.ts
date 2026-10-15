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

describe("insertBetweenMany: a to-do between a card and all its followers", () => {
  const T = "T/";
  const hub = { path: "P/Alpha.md", name: "Alpha", folder: "P", fm: { kind: "project" }, ctime: 0, mtime: 0 };
  const note = (name: string, fm: Record<string, unknown> = {}) => ({ path: `${T}${name}.md`, name, folder: "T", fm: { kind: "todo", project: "[[Alpha]]", ...fm }, ctime: 0, mtime: 0 });
  const setup = () => {
    const fms: Record<string, Record<string, unknown>> = { "T/A.md": {}, "T/B.md": { after: "[[A]]" }, "T/C.md": { after: ["[[A]]", "[[Z]]"] }, "T/X.md": {}, "T/Z.md": {} };
    const app = {
      vault: { getFileByPath: (p: string) => (p in fms ? { path: p } : null) },
      metadataCache: { fileToLinktext: (f: { path: string }) => f.path.replace(/^T\//, "").replace(/\.md$/, "") },
      fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(fms[f.path]); } },
    } as never;
    const todos = [note("A"), note("B", { after: "[[A]]" }), note("C", { after: ["[[A]]", "[[Z]]"] }), note("X"), note("Z")];
    return { fms, app, todos };
  };

  it("X comes after A, B and C come after X instead of A (C keeps its other link), as one Undo step; Undo and Redo restore all", async () => {
    const { readPlan } = await import("../src/planning/plan");
    const { PlanHistory } = await import("../src/planning/plan-history");
    const { insertBetweenMany, followersOf } = await import("../src/planning/add-after");
    const { runHistory } = await import("../src/planning/after-write");
    const { fms, app, todos } = setup();
    const plan = readPlan(todos, hub);
    expect(followersOf(plan, "T/A.md")).toEqual(["T/B.md", "T/C.md"]);
    const history = new PlanHistory();
    const step = await insertBetweenMany(app, history, plan, "T/A.md", ["T/B.md", "T/C.md"], "T/X.md", 9);
    expect(step).not.toBeNull();
    expect(fms["T/X.md"]).toEqual({ after: "[[A]]" });
    expect(fms["T/B.md"]).toEqual({ after: "[[X]]" });
    expect(fms["T/C.md"]).toEqual({ after: ["[[Z]]", "[[X]]"] });
    expect(history.size("undo")).toBe(3);
    expect(history.withGroup("undo", history.peek("undo")!)).toHaveLength(3);   // X, B and C are one group
    await runHistory(app, history, "undo", step!);
    expect(fms["T/X.md"]).toEqual({});
    expect(fms["T/B.md"]).toEqual({ after: "[[A]]" });
    expect(fms["T/C.md"]).toEqual({ after: ["[[A]]", "[[Z]]"] });
    await runHistory(app, history, "redo");
    expect(fms["T/B.md"]).toEqual({ after: "[[X]]" });
    expect(fms["T/C.md"]).toEqual({ after: ["[[Z]]", "[[X]]"] });
  });

  it("a to-do that would make a loop for any follower is refused and nothing is written", async () => {
    const { readPlan } = await import("../src/planning/plan");
    const { PlanHistory } = await import("../src/planning/plan-history");
    const { insertBetweenMany } = await import("../src/planning/add-after");
    const { fms, app } = setup();
    // D comes after C, C after A: D between A and both B and C would make C come after D, which already comes after C
    fms["T/D.md"] = { after: "[[C]]" };
    const plan = readPlan([note("A"), note("B", { after: "[[A]]" }), note("C", { after: "[[A]]" }), note("D", { after: "[[C]]" })], hub);
    const history = new PlanHistory();
    const step = await insertBetweenMany(app, history, plan, "T/A.md", ["T/B.md", "T/C.md"], "T/D.md", 10);
    expect(step).toBeNull();
    expect(history.size("undo")).toBe(0);
    expect(fms["T/B.md"]).toEqual({ after: "[[A]]" });
  });

  it("followersOf leaves out a subtask (its link is drawn to its parent)", async () => {
    const { readPlan } = await import("../src/planning/plan");
    const { followersOf } = await import("../src/planning/add-after");
    const plan = readPlan([note("A"), note("B", { after: "[[A]]" }), note("S", { after: "[[A]]", sub: "[[B]]" })], hub);
    expect(followersOf(plan, "T/A.md")).toEqual(["T/B.md"]);
  });
});
