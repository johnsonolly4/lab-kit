// Where the "+ add after this" / "+ new here" box opens (chooseBoxSpot in src/planning/plan-map-render.ts).
import { describe, it, expect } from "vitest";
import { chooseBoxSpot, type Box } from "../src/planning/plan-map-render";

const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height });
const map = box(0, 0, 800, 400);
const point = (x: number, y: number): Box => box(x, y, 0, 0);

describe("chooseBoxSpot, the + new here box (a grabbed point on an arrow)", () => {
  it("sits just right of the grab point when that is free", () => {
    const p = chooseBoxSpot(map, [], point(300, 200), "right");
    expect(p.x).toBe(316);
    expect(Math.abs(p.y + 27 - 200)).toBeLessThanOrEqual(1);
  });
  it("goes below, left or above when the right is taken, and never to the far edge of the map", () => {
    const wall = [box(310, 100, 300, 200)];   // cards right of the point
    const p = chooseBoxSpot(map, wall, point(300, 200), "right");
    expect(p.x).toBeLessThan(400);
    const everywhere = [box(0, 0, 800, 400)];   // no free place at all
    const q = chooseBoxSpot(map, everywhere, point(300, 200), "right");
    expect(q.x).toBeLessThan(500);
    expect(q.y).toBeGreaterThan(100);
  });
  it("is kept inside the map when the grab is near an edge", () => {
    const q = chooseBoxSpot(map, [box(0, 0, 800, 400)], point(790, 395), "right");
    expect(q.x + 130).toBeLessThanOrEqual(800);
    expect(q.y + 54).toBeLessThanOrEqual(400);
  });
});

describe("chooseBoxSpot, the + add after this box (a card)", () => {
  it("is right of the card, below it in the top-to-bottom layout, else the right edge", () => {
    const card = box(50, 100, 200, 80);
    expect(chooseBoxSpot(map, [], card, "right").x).toBe(266);
    expect(chooseBoxSpot(map, [], card, "down").y).toBe(196);
    expect(chooseBoxSpot(map, [box(0, 0, 800, 400)], card, "right").x).toBe(800 - 130 - 12);
  });
});
