import { afterEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { nodeModule } from "../src/node";

afterEach(() => { Platform.isMobile = false; });

describe("nodeModule", () => {
  it("gives Node modules on desktop", () => {
    expect(nodeModule("fs")?.existsSync).toBeTypeOf("function");
    expect(nodeModule("path")?.join("a", "b")).toMatch(/^a[/\\]b$/);
  });

  it("gives null on mobile, also when mobile is emulated (isDesktopApp stays true)", () => {
    Platform.isMobile = true;
    expect(nodeModule("fs")).toBeNull();
    expect(nodeModule("electron")).toBeNull();
  });

  it("gives null for a module that can't be loaded (electron outside the app)", () => {
    expect(nodeModule("electron")).toBeNull();
  });
});
