import { describe, it, expect } from "vitest";
import { BOARD_STATUSES, progressFraction, rgbTriplet } from "../src/kit/board-colours";
import { KIT_DEFAULTS, kitLoad } from "../src/kit/paths";
import { readFileSync } from "fs";

describe("board colours", () => {
  it("turns a hex colour into an rgb triplet, and refuses anything else", () => {
    expect(rgbTriplet("#10b981")).toBe("16, 185, 129");
    expect(rgbTriplet("#FFFFFF")).toBe("255, 255, 255");
    for (const bad of ["", "red", "#fff", "#12345g", "10b981"]) expect(rgbTriplet(bad), bad).toBeNull();
  });
  it("is on by default with no custom colours, and an old data.json gets that", () => {
    expect(KIT_DEFAULTS.boardColours).toEqual({ enabled: true, colours: {} });
    expect(kitLoad({}).boardColours).toEqual({ enabled: true, colours: {} });
    expect(kitLoad({ boardColours: { enabled: false, colours: { planned: "#000000" } } }).boardColours).toEqual({ enabled: false, colours: { planned: "#000000" } });
  });
  it("styles.css has a rule and a default for every status the settings list", () => {
    const css = readFileSync("styles.css", "utf8");
    for (const [name, key, hex] of BOARD_STATUSES) {
      expect(css, name).toContain(`[data-lab-kit-group="${name}"] { --lab-kit-col: var(--lab-kit-col-${key}, ${rgbTriplet(hex)}); }`);
    }
  });
  it("reads 3/7 from a card's progress text", () => {
    expect(progressFraction("3/7")).toEqual([3, 7]);
    expect(progressFraction("progress 10 / 12")).toEqual([10, 12]);
    expect(progressFraction("9/7")).toEqual([7, 7]);
    for (const bad of ["", "—", "0/0", "none"]) expect(progressFraction(bad), bad).toBeNull();
  });
});
