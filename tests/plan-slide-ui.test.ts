import { describe, expect, it } from "vitest";
import { layoutOf, readableNote } from "../src/planning/plan-slide-ui";

describe("slide window helpers", () => {
  it("turns the choice into a layout", () => {
    expect(layoutOf({ whole: true, ahead: 5 })).toEqual({ kind: "whole" });
    expect(layoutOf({ whole: false, ahead: 3 })).toEqual({ kind: "compact", ahead: 3 });
  });
  it("warns only when the text is too small", () => {
    expect(readableNote({ minText: 24, tooSmall: false }, false)).toBe("");
    expect(readableNote({ minText: 18.9, tooSmall: true }, false)).toContain("fewer columns");
    expect(readableNote({ minText: 18.9, tooSmall: true }, true)).toContain("19 px");
  });
});
