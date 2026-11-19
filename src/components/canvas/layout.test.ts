import { describe, expect, it } from "vitest";
import type { CanvasItem } from "./canvas.component";
import { placeRows } from "./layout";

const card = (id: string, x: number, y: number, width = 200, height = 300, zIndex = 1): CanvasItem => ({
  id,
  x,
  y,
  width,
  height,
  zIndex,
});

describe("placeRows", () => {
  it("places the first row below the lowest existing card, aligned to the leftmost card", () => {
    const items = [card("a", 100, 100), card("b", 400, 200)]; // lowest bottom = 500
    const positions = placeRows(items, 2, { gap: 24 });
    expect(positions).toEqual([
      { x: 100, y: 524, z: 2 },
      { x: 324, y: 524, z: 3 },
    ]);
  });

  it("wraps after `columns` cards", () => {
    const items = [card("a", 0, 0)];
    const positions = placeRows(items, 5, { columns: 2, gap: 10, cardWidth: 200, cardHeight: 300 });
    expect(positions.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 310 },
      { x: 210, y: 310 },
      { x: 0, y: 620 },
      { x: 210, y: 620 },
      { x: 0, y: 930 },
    ]);
  });

  it("aligns to the left edge of `near` cards but still goes below everything", () => {
    const items = [card("a", 0, 0), card("b", 800, 1000, 200, 300)];
    const positions = placeRows(items, 1, { near: ["b"], gap: 20 });
    expect(positions[0]).toMatchObject({ x: 800, y: 1320 });
  });

  it("uses the viewport origin on an empty board", () => {
    const positions = placeRows([], 2, { gap: 20, viewport: { x: 1000, y: 2000, width: 800, height: 600 } });
    expect(positions.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 1020, y: 2020 },
      { x: 1240, y: 2020 },
    ]);
  });

  it("assigns increasing z-index above the current max", () => {
    const items = [card("a", 0, 0, 200, 300, 7)];
    expect(placeRows(items, 3).map((p) => p.z)).toEqual([8, 9, 10]);
  });

  it("returns an empty array for count 0", () => {
    expect(placeRows([card("a", 0, 0)], 0)).toEqual([]);
  });
});
