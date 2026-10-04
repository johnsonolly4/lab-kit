import { afterEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { nodeModule } from "../src/node";
import { kitHash } from "../src/kit/updater";

afterEach(() => { Platform.isMobile = false; });

describe("nodeModule", () => {
  it("gives Node modules on desktop", () => {
    expect(nodeModule("fs")?.existsSync).toBeTypeOf("function");
    expect(nodeModule("path")?.join("a", "b")).toMatch(/^a[/\\]b$/);
  });

  it("gives null on mobile, also when mobile is emulated (isDesktopApp stays true)", () => {
    Platform.isMobile = true;
    expect(nodeModule("fs")).toBeNull();
    expect(nodeModule("crypto")).toBeNull();
    expect(nodeModule("electron")).toBeNull();
  });

  it("gives null for a module that can't be loaded (electron outside the app)", () => {
    expect(nodeModule("electron")).toBeNull();
  });
});

describe("kitHash", () => {
  const abc = new TextEncoder().encode("abc");
  it("is SHA-1 where Node exists", () => {
    expect(kitHash(abc)).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
  it("falls back to FNV-1a where it doesn't", () => {
    Platform.isMobile = true;
    expect(kitHash(abc)).toBe("1a47e90b");
  });
});
