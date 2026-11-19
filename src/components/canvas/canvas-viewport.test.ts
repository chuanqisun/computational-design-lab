import { describe, expect, it } from "vitest";
import type { CanvasItem } from "./canvas.component";
import { DEFAULT_EXTENT, growExtent, itemsBounds, visibleItemIds } from "./canvas-viewport";

const card = (id: string, x: number, y: number, extra: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  x,
  y,
  width: 200,
  height: 300,
  ...extra,
});

describe("growExtent", () => {
  const pad = { x: 1000, y: 800 };

  it("returns the same object when everything already fits", () => {
    const view = { x: 3000, y: 3000, width: 1000, height: 800 };
    expect(growExtent(DEFAULT_EXTENT, [view], pad)).toBe(DEFAULT_EXTENT);
  });

  it("grows into negative space in whole steps, keeping one screen of room", () => {
    const view = { x: 500, y: 300, width: 1000, height: 800 };
    expect(growExtent(DEFAULT_EXTENT, [view], pad, 2000)).toEqual({ minX: -2000, minY: -2000, maxX: 8000, maxY: 8000 });
  });

  it("grows right/down to cover far cards plus padding", () => {
    const far = { x: 20_000, y: 9000, width: 200, height: 300 };
    expect(growExtent(DEFAULT_EXTENT, [far], pad, 2000)).toEqual({ minX: 0, minY: 0, maxX: 22_000, maxY: 12_000 });
  });

  it("never shrinks", () => {
    const big = { minX: -10_000, minY: -10_000, maxX: 30_000, maxY: 30_000 };
    expect(growExtent(big, [{ x: 0, y: 0, width: 10, height: 10 }], pad)).toBe(big);
  });
});

describe("itemsBounds", () => {
  it("covers all items including negative coordinates", () => {
    expect(itemsBounds([card("a", -500, 100), card("b", 1000, -200)])).toEqual({
      x: -500,
      y: -200,
      width: 1700,
      height: 600,
    });
  });

  it("is null for an empty board", () => {
    expect(itemsBounds([])).toBeNull();
  });
});

describe("visibleItemIds", () => {
  const view = { x: 0, y: 0, width: 1000, height: 1000 };

  it("renders cards in or near the view and skips far ones", () => {
    const items = [card("in", 100, 100), card("near", 1300, 0), card("far", 5000, 5000), card("left", -1600, 0)];
    expect(visibleItemIds(items, view, 0.5)).toEqual(["in", "near"]);
  });

  it("always renders selected cards so they can be dragged", () => {
    const items = [card("far", 5000, 5000, { isSelected: true })];
    expect(visibleItemIds(items, view)).toEqual(["far"]);
  });

  it("keeps board order", () => {
    const items = [card("b", 10, 10), card("a", 20, 20)];
    expect(visibleItemIds(items, view)).toEqual(["b", "a"]);
  });
});
