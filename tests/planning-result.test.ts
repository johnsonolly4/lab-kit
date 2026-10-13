// Add result (src/planning/result.ts): the result as one line.
import { describe, it, expect } from "vitest";
import { cleanResult } from "../src/planning/result";

describe("cleanResult", () => {
  it("line breaks become one space; the ends are trimmed", () => {
    expect(cleanResult("  Mn 20 kDa\n\nand  D 1.2 \r\n ")).toBe("Mn 20 kDa and  D 1.2");
  });
  it("empty and blank give an empty result (the command removes the property)", () => {
    expect(cleanResult("")).toBe("");
    expect(cleanResult("  \n ")).toBe("");
  });
});
