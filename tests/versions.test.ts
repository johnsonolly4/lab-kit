// The version lives in three files and only moves at release (the /release skill sets all three).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const version = (file: string): string => (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;

describe("versions", () => {
  it("package.json, manifest.json and kit/kit-manifest.json agree", () => {
    const v = version("manifest.json");
    expect(version("package.json")).toBe(v);
    expect(version("kit/kit-manifest.json")).toBe(v);
  });

  it("versions.json lists the current version with manifest.json's minAppVersion", () => {
    const m = JSON.parse(readFileSync("manifest.json", "utf8")) as { version: string; minAppVersion: string };
    const map = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;
    expect(map[m.version]).toBe(m.minAppVersion);
  });
});
