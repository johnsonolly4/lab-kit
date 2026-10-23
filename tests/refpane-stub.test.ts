import { describe, expect, it } from "vitest";
import { refpaneAbsent } from "../src/planning/refpane-stub";

describe("refpane stub (option a)", () => {
  it("draws the empty box only while the refpane plugin is not enabled", () => {
    expect(refpaneAbsent(new Set(["lab-kit"]))).toBe(true);
    expect(refpaneAbsent(new Set(["lab-kit", "refpane"]))).toBe(false);
  });
});
