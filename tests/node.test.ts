import { afterEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listFolderFiles, nodeModule } from "../src/node";

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

describe("listFolderFiles", () => {
  it("lists files at all levels with sizes, sorted, and says when the folder is missing; null on a phone", () => {
    const root = mkdtempSync(join(tmpdir(), "lk-data-"));
    try {
      mkdirSync(join(root, "raw"));
      writeFileSync(join(root, "b.csv"), "12345");
      writeFileSync(join(root, "raw", "a.txt"), "xy");
      expect(listFolderFiles(root)).toEqual({ exists: true, files: [["b.csv", 5], ["raw/a.txt", 2]] });
      expect(listFolderFiles(join(root, "nope"))).toEqual({ exists: false, files: [] });
      expect(listFolderFiles(join(root, "b.csv"))?.exists).toBe(false);   // a file, not a folder
      Platform.isMobile = true;
      expect(listFolderFiles(root)).toBeNull();
    } finally { rmSync(root, { recursive: true }); }
  });
});
