// Rig figure Phase 4: pixel maths, cap and file names (src/rig/figure-export.ts).
import { describe, it, expect } from "vitest";
import { PNG_MAX_PIXELS, PNG_MAX_SIDE, figureFileName, heightMm, pngSize, savedNote, sizeLine } from "../src/rig/figure-export";

const fig = { figWidth: 1080, figHeight: 458 };

describe("PNG pixel size", () => {
  it("is the width in mm over 25.4 times the dpi, with the figure's shape", () => {
    expect(pngSize({ widthMm: 25.4, dpi: 300, ...fig })).toEqual({ width: 300, height: 127, asked: { width: 300, height: 127 }, capped: false });
    const s = pngSize({ widthMm: 400, dpi: 300, ...fig })!;
    expect(s.width).toBe(4724);
    expect(s.height).toBe(Math.round(4724 * 458 / 1080));
    expect(s.capped).toBe(false);
  });
  it("A0 wide at 300 dpi (841 mm, 9,933 px) is under the cap", () => {
    const s = pngSize({ widthMm: 841, dpi: 300, figWidth: 1000, figHeight: 1414 })!;
    expect(s.width).toBe(9933);
    expect(s.width * s.height).toBeLessThanOrEqual(PNG_MAX_PIXELS);
    expect(s.capped).toBe(false);
  });
  it("lowers a size past the side cap, keeping the shape, and says what was asked", () => {
    const s = pngSize({ widthMm: 2000, dpi: 600, figWidth: 1000, figHeight: 100 })!;
    expect(s.asked.width).toBe(47244);
    expect(s.capped).toBe(true);
    expect(s.width).toBeLessThanOrEqual(PNG_MAX_SIDE);
    expect(s.width).toBe(PNG_MAX_SIDE);
    expect(s.height).toBe(1600);
  });
  it("lowers a size past the pixel cap even when each side is under the side cap", () => {
    const s = pngSize({ widthMm: 1100, dpi: 300, figWidth: 1000, figHeight: 1000 })!;   // 12,992 x 12,992 = 169 M
    expect(s.asked.width * s.asked.height).toBeGreaterThan(PNG_MAX_PIXELS);
    expect(s.capped).toBe(true);
    expect(s.width * s.height).toBeLessThanOrEqual(PNG_MAX_PIXELS);
    expect(Math.abs(s.width - s.height)).toBeLessThanOrEqual(1);
  });
  it("is null for a width or dpi that is not above zero", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(pngSize({ widthMm: bad, dpi: 300, ...fig })).toBeNull();
      expect(pngSize({ widthMm: 100, dpi: bad, ...fig })).toBeNull();
    }
    expect(pngSize({ widthMm: 0.001, dpi: 1, ...fig })).toBeNull();
  });
  it("gives the height in mm", () => { expect(heightMm(216, 1080, 540)).toBe(108); });
});

describe("the lines said to the user", () => {
  it("shows the pixel size, or why it is lowered, or what to fix", () => {
    expect(sizeLine(pngSize({ widthMm: 400, dpi: 300, ...fig }))).toBe("4,724 × 2,003 px");
    const capped = sizeLine(pngSize({ widthMm: 2000, dpi: 600, figWidth: 1000, figHeight: 100 }));
    expect(capped).toContain("47,244 × 4,724 px is more than this window makes");
    expect(capped).toContain("16,000 × 1,600 px");
    expect(sizeLine(null)).toContain("above zero");
  });
  it("the saved notice names the size got, and the asked size when lower", () => {
    expect(savedNote("A figure.png", { width: 10, height: 5 }, { width: 10, height: 5 })).toBe("Saved A figure.png: 10 × 5 px.");
    expect(savedNote("A figure.png", { width: 10, height: 5 }, { width: 20, height: 10 })).toContain("20 × 10 px was asked");
  });
});

describe("figure file names", () => {
  it("is '<note> figure.svg' / '.png', then ' 2', ' 3' while taken", () => {
    const names = new Set<string>();
    expect(figureFileName("Rig A", "svg", n => names.has(n))).toBe("Rig A figure.svg");
    names.add("Rig A figure.svg");
    expect(figureFileName("Rig A", "svg", n => names.has(n))).toBe("Rig A figure 2.svg");
    names.add("Rig A figure 2.svg");
    expect(figureFileName("Rig A", "svg", n => names.has(n))).toBe("Rig A figure 3.svg");
    expect(figureFileName("Rig A", "png", n => names.has(n))).toBe("Rig A figure.png");
  });
});
