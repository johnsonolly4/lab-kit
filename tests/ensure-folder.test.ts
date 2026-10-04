// The Methods folder setting creates the folder when it does not exist yet.
import { describe, it } from "vitest";
import assert from "node:assert";
import { ensureFolder } from "../src/kit/ensure-folder";

function vault(existing: string[]) {
  const have = new Set(existing);
  const made: string[] = [];
  return {
    made,
    getAbstractFileByPath: (p: string) => have.has(p) ? ({ path: p } as any) : null,
    createFolder: async (p: string) => { have.add(p); made.push(p); return {} as any; },
  };
}

describe("ensureFolder", () => {
  it("creates a missing folder, and the missing folders above it, top first", async () => {
    const v = vault(["Lab"]);
    assert.strictEqual(await ensureFolder(v, "Lab/Analysis/Methods"), true);
    assert.deepStrictEqual(v.made, ["Lab/Analysis", "Lab/Analysis/Methods"]);
  });

  it("does nothing when something is already at that path", async () => {
    const v = vault(["Methods"]);
    assert.strictEqual(await ensureFolder(v, "Methods"), false);
    assert.deepStrictEqual(v.made, []);
  });

  it("does nothing for an empty path, a path with .. or a hidden folder", async () => {
    for (const path of ["", "/", "../Methods", "Lab/../x", ".obsidian/Methods", "Lab/.hidden"]) {
      const v = vault([]);
      assert.strictEqual(await ensureFolder(v, path), false, path);
      assert.deepStrictEqual(v.made, [], path);
    }
  });
});
