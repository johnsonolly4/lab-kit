import { describe, it, expect } from "vitest";
import { DRAG_START_PX, LONG_PRESS_MS, MOVE_SLOP_PX, dropDay, edgeStep, pressState, targetAt, type Zone } from "../src/planning/board-drag";

describe("press state", () => {
  it("mouse and pen lift after a few pixels, at once", () => {
    expect(pressState("mouse", 0, DRAG_START_PX - 1)).toBe("wait");
    expect(pressState("mouse", 0, DRAG_START_PX)).toBe("drag");
    expect(pressState("pen", 10, 30)).toBe("drag");
  });
  it("touch lifts only at the long press, and only if the finger stayed put", () => {
    expect(pressState("touch", LONG_PRESS_MS - 1, 0)).toBe("wait");
    expect(pressState("touch", LONG_PRESS_MS, 0)).toBe("drag");
    expect(pressState("touch", LONG_PRESS_MS, MOVE_SLOP_PX)).toBe("drag");
  });
  it("touch that moves before the long press is a scroll or swipe: abandoned", () => {
    expect(pressState("touch", 100, MOVE_SLOP_PX + 1)).toBe("abandon");
    expect(pressState("touch", 100, MOVE_SLOP_PX)).toBe("wait");
  });
});

describe("target from a point", () => {
  const zones: Zone[] = [
    { key: "Mon", left: 0, top: 0, right: 100, bottom: 200 },
    { key: "Tue", left: 100, top: 0, right: 200, bottom: 200 },
    { key: "Hidden", left: 0, top: 0, right: 0, bottom: 0 },
    { key: "Backlog", left: 0, top: 220, right: 200, bottom: 300 },
  ];
  it("finds the zone under the point", () => {
    expect(targetAt(zones, 50, 50)).toBe("Mon");
    expect(targetAt(zones, 150, 199)).toBe("Tue");
    expect(targetAt(zones, 10, 250)).toBe("Backlog");
  });
  it("is null outside every zone and never matches a zone without area", () => {
    expect(targetAt(zones, 50, 210)).toBeNull();
    expect(targetAt(zones, 0, 0)).toBe("Mon");
    expect(targetAt([zones[2]], 0, 0)).toBeNull();
  });
});

describe("auto-scroll at the edges", () => {
  const box = { left: 0, top: 0, right: 400, bottom: 300 };
  it("scrolls toward the near edge", () => {
    expect(edgeStep(box, 10, 150)).toEqual({ dx: -14, dy: 0 });
    expect(edgeStep(box, 390, 150)).toEqual({ dx: 14, dy: 0 });
    expect(edgeStep(box, 200, 5)).toEqual({ dx: 0, dy: -14 });
    expect(edgeStep(box, 200, 295)).toEqual({ dx: 0, dy: 14 });
  });
  it("keeps scrolling past the edge, stands still in the middle and far outside both axes", () => {
    expect(edgeStep(box, 10, 500)).toEqual({ dx: 0, dy: 14 });
    expect(edgeStep(box, 200, 150)).toEqual({ dx: 0, dy: 0 });
    expect(edgeStep(box, 500, 500)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("what a drop writes", () => {
  it("the target day", () => expect(dropDay("Mon", "Wed", false)).toBe("Wed"));
  it("nothing when cancelled (Escape)", () => expect(dropDay("Mon", "Wed", true)).toBeNull());
  it("nothing outside a zone or on the card's own zone", () => {
    expect(dropDay("Mon", null, false)).toBeNull();
    expect(dropDay("Mon", "Mon", false)).toBeNull();
  });
});
