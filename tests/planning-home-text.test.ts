import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const kit = (p: string) => readFileSync(`kits/planning/${p}`, "utf8");

describe("Home and the how-tos have no focus lines", () => {
  it("00 Home has no focus properties, inputs or button", () => {
    const home = kit("00 Home.md");
    expect(home).not.toMatch(/focus\d/);
    expect(home).not.toContain("clear-focus");
    expect(home).not.toContain("Today's focus");
  });
  it("the how-tos do not describe the focus lines or say lab orders only", () => {
    for (const f of ["How my vault works.md", "Vault spec.md"]) {
      const t = kit(`07 How-tos/Obsidian/${f}`);
      expect(t, f).not.toContain("Today's focus");
      expect(t, f).not.toContain("Clear for tomorrow");
      expect(t, f).not.toContain("Lab orders only");
    }
  });
});
