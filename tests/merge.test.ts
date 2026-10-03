import { describe, it, expect } from "vitest";
import { merge3 } from "../src/kit/merge";

const base = "top\nmiddle\nbottom\n";

describe("merge3", () => {
  it("keeps your edit at the top and the kit's edit at the bottom", () => {
    const r = merge3(base, "top mine\nmiddle\nbottom\n", "top\nmiddle\nbottom kit\n");
    expect(r).toEqual({ clean: true, text: "top mine\nmiddle\nbottom kit\n", conflicts: 0 });
  });

  it("reports a conflict when both change the same line, and never writes markers", () => {
    const r = merge3(base, "top\nmiddle mine\nbottom\n", "top\nmiddle kit\nbottom\n");
    expect(r.clean).toBe(false);
    expect(r.conflicts).toBe(1);
    expect(r.text).toBe("");
  });

  it("is clean when you and the kit made the same edit", () => {
    const r = merge3(base, "top\nmiddle same\nbottom\n", "top\nmiddle same\nbottom\n");
    expect(r).toEqual({ clean: true, text: "top\nmiddle same\nbottom\n", conflicts: 0 });
  });

  it("keeps Windows line endings when your file has them", () => {
    const r = merge3(base, "top mine\r\nmiddle\r\nbottom\r\n", "top\nmiddle\nbottom kit\n");
    expect(r.clean).toBe(true);
    expect(r.text).toBe("top mine\r\nmiddle\r\nbottom kit\r\n");
  });

  it("ignores a BOM at the start of your file", () => {
    const r = merge3(base, String.fromCharCode(0xfeff) + "top\nmiddle\nbottom\n", "top\nmiddle\nbottom kit\n");
    expect(r).toEqual({ clean: true, text: "top\nmiddle\nbottom kit\n", conflicts: 0 });
  });

  it("merges into an empty base (both added different text) as a conflict", () => {
    const r = merge3("", "mine\n", "kit\n");
    expect(r.clean).toBe(false);
  });
});
