// S3: the property-type manager (private) is reached only through obsidian-private.ts; the planning templates call window.vtEnsureType.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { assignedType, ensurePropertyType } from "../src/kit/obsidian-private";

const appWith = (m: unknown): any => ({ metadataTypeManager: m });

describe("ensurePropertyType", () => {
  it("sets the type when the manager reports another one", async () => {
    const setType = vi.fn(async () => {});
    expect(await ensurePropertyType(appWith({ getAssignedType: () => "text", setType }), "due", "date")).toBe(true);
    expect(setType).toHaveBeenCalledWith("due", "date");
  });
  it("leaves a property that already has the type", async () => {
    const setType = vi.fn(async () => {});
    expect(await ensurePropertyType(appWith({ getAssignedType: () => "date", setType }), "due", "date")).toBe(false);
    expect(setType).not.toHaveBeenCalled();
  });
  it("sets it when this Obsidian has no getAssignedType (as the templates did)", async () => {
    const setType = vi.fn(async () => {});
    expect(assignedType(appWith({ setType }), "due")).toBeUndefined();
    expect(await ensurePropertyType(appWith({ setType }), "due", "date")).toBe(true);
  });
  it("soft-fails without a manager, or when setType throws", async () => {
    expect(await ensurePropertyType({} as any, "due", "date")).toBe(false);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ensurePropertyType(appWith({ setType: async () => { throw new Error("x"); } }), "due", "date")).toBe(false);
    err.mockRestore();
  });
});

describe("planning templates", () => {
  it("no planning template sets property types any more: New project sets deadline's type itself (Templater Phase 6)", () => {
    const s = readFileSync("kits/planning/Extras/Templates/Project hub.md", "utf8");
    expect(s).not.toContain("metadataTypeManager");
    expect(s).not.toContain("vtEnsureType");
    expect(readFileSync("src/planning/commands.ts", "utf8")).toContain('ensurePropertyType(this.app, "deadline", "date")');
  });
});
