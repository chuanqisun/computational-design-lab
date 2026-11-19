import { describe, expect, it } from "vitest";
import { fitMinimap, mapToWorld, unionRects, worldToMap } from "./minimap";

describe("minimap transform", () => {
  it("fits wide bounds by width and centers vertically", () => {
    const t = fitMinimap({ x: -1000, y: 0, width: 4000, height: 1000 }, 200, 140, 0);
    expect(t.scale).toBe(0.05);
    expect(worldToMap(t, -1000, 0)).toEqual({ x: 0, y: 45 });
    expect(worldToMap(t, 3000, 1000)).toEqual({ x: 200, y: 95 });
  });

  it("round-trips map and world coordinates", () => {
    const t = fitMinimap({ x: -3000, y: -2000, width: 21000, height: 20000 }, 200, 140);
    const world = { x: 1234, y: -567 };
    const back = mapToWorld(t, worldToMap(t, world.x, world.y).x, worldToMap(t, world.x, world.y).y);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });

  it("unions cards and view", () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: -5, y: 20, width: 10, height: 10 },
      ]),
    ).toEqual({ x: -5, y: 0, width: 15, height: 30 });
    expect(unionRects([])).toBeNull();
  });
});
