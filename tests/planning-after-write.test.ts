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
