import { describe, expect, it } from "vitest";
import type { CanvasItem } from "./canvas.component";
import { organizeChronologically, placeRows } from "./layout";

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

describe("organizeChronologically", () => {
  const card = (id: string, runId?: string, createdAt?: number, size: Partial<CanvasItem> = {}): CanvasItem => ({
    id,
    x: 500,
    y: 500,
    width: 200,
    height: 300,
    ...size,
    metadata: runId ? { createdAt, createdBy: { runId, action: "scan_concept", actor: "user" } } : undefined,
  });
  const at = (moves: { id: string; x: number; y: number }[], id: string) => moves.find((m) => m.id === id);

  it("puts each action's cards in one row, oldest action on top", () => {
    const items = [
      card("b1", "run-b", 2000),
      card("a1", "run-a", 1000),
      card("b2", "run-b", 2000),
      card("a2", "run-a", 1000),
      card("c1", "run-c", 3000),
    ];
    const moves = organizeChronologically(items, { origin: { x: 0, y: 0 }, gap: 10 });
    expect(at(moves, "a1")).toEqual({ id: "a1", x: 0, y: 0 });
    expect(at(moves, "a2")).toEqual({ id: "a2", x: 210, y: 0 });
    expect(at(moves, "b1")).toEqual({ id: "b1", x: 0, y: 310 });
    expect(at(moves, "b2")).toEqual({ id: "b2", x: 210, y: 310 });
    expect(at(moves, "c1")).toEqual({ id: "c1", x: 0, y: 620 });
  });

  it("uses the tallest card of a row and actual card widths", () => {
    const items = [card("a1", "run-a", 1, { width: 400, height: 500 }), card("a2", "run-a", 1), card("b1", "run-b", 2)];
    const moves = organizeChronologically(items, { origin: { x: 0, y: 0 }, gap: 10 });
    expect(at(moves, "a2")).toMatchObject({ x: 410, y: 0 });
    expect(at(moves, "b1")).toMatchObject({ x: 0, y: 510 });
  });

  it("defaults the origin to the items' top-left", () => {
    const items = [card("a1", "run-a", 1, { x: 40, y: 900 }), card("b1", "run-b", 2, { x: 300, y: 60 })];
    const moves = organizeChronologically(items);
    expect(at(moves, "a1")).toMatchObject({ x: 40, y: 60 });
  });

  it("places unstamped cards first, grouped by contiguous id prefix in board order", () => {
    const items = [
      card("scan-aaaaaaaa"),
      card("scan-bbbbbbbb"),
      card("rendered-cccccccc"),
      card("new-1", "run-x", 5),
      card("scan-dddddddd"),
    ];
    const moves = organizeChronologically(items, { origin: { x: 0, y: 0 }, gap: 0 });
    expect(at(moves, "scan-aaaaaaaa")).toMatchObject({ x: 0, y: 0 });
    expect(at(moves, "scan-bbbbbbbb")).toMatchObject({ x: 200, y: 0 });
    expect(at(moves, "rendered-cccccccc")).toMatchObject({ x: 0, y: 300 });
    expect(at(moves, "scan-dddddddd")).toMatchObject({ x: 0, y: 600 });
    expect(at(moves, "new-1")).toMatchObject({ x: 0, y: 900 });
  });

  it("returns nothing for no items", () => {
    expect(organizeChronologically([])).toEqual([]);
  });
});
