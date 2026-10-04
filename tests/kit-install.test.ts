// First install of the built-in kit (CSS snippet, Templater's user scripts folder) and the version compare behind the update notice.
import { describe, it, expect } from "vitest";
import { firstInstallOptions, type EmbeddedKit } from "../src/kit/managed";
import { kitCompare } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const real = embeddedKit() as EmbeddedKit;
const bare: EmbeddedKit = { manifest: { schema: 1, kitVersion: "1.0.0", files: [], removed: [] }, contents: {} };

describe("first install options", () => {
  it("the real kit carries its CSS snippet and Templater settings into main.js", () => {
    expect(real.manifest.enableCss).toContain("scrolling-mermaid.css");
    expect(real.manifest.templater?.userScripts).toBe(true);
  });

  it("offers the CSS snippet from the kit", () => {
    const o = firstInstallOptions(real, { installed: false }, "Scripts/lab-kit");
    expect(o.css?.enable).toEqual(real.manifest.enableCss);
    expect(o.css?.disable).toEqual(real.manifest.disableCss ?? []);
  });

  it("offers Templater's folder only when Templater is installed and has none", () => {
    expect(firstInstallOptions(real, { installed: true }, "Scripts/lab-kit").templaterFolder).toBe("Scripts/lab-kit");
    expect(firstInstallOptions(real, { installed: true, folder: "  " }, "Scripts/lab-kit").templaterFolder).toBe("Scripts/lab-kit");
  });

  it("never replaces a folder Templater already has", () => {
    expect(firstInstallOptions(real, { installed: true, folder: "My scripts" }, "Scripts/lab-kit").templaterFolder).toBeNull();
  });

  it("offers nothing without Templater, or for a kit that asks for nothing", () => {
    expect(firstInstallOptions(real, { installed: false }, "Scripts/lab-kit").templaterFolder).toBeNull();
    expect(firstInstallOptions(bare, { installed: true }, "Scripts/lab-kit")).toEqual({ css: null, templaterFolder: null });
  });
});

describe("kitCompare (update notice)", () => {
  it("compares versions number by number", () => {
    expect(kitCompare("0.3.0", "0.2.9")).toBeGreaterThan(0);
    expect(kitCompare("0.10.0", "0.9.1")).toBeGreaterThan(0);
    expect(kitCompare("1.0", "1.0.0")).toBe(0);
    expect(kitCompare("0.4.8", "0.4.9")).toBeLessThan(0);
  });
});
