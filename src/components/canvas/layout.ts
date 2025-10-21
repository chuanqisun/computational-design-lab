import type { CanvasItem } from "./canvas.component";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface NextPositionsConfig {
  offsetX?: number;
  offsetY?: number;
}

export interface SortAxisConfig<T, V> {
  axis: "x" | "y";
  items: T[];
  getPosition: (item: T) => number;
  getValue: (item: T) => V;
}

/**
 * Creates an infinite generator that yields positions offset diagonally
 * from the center of the anchor items. Each position moves right and down.
 *
 * Pattern (with default 50px offset):
 * Position 0: center
 * Position 1: center + (50, 50)
 * Position 2: center + (100, 100)
 * Position 3: center + (150, 150)
 * ... continues infinitely
 */
export function* getNextPositions(anchorItems: CanvasItem[], config: NextPositionsConfig = {}): Generator<Position> {
  const { offsetX = 50, offsetY = 50 } = config;
  const center = calculateAnchorPoint(anchorItems);

  for (let index = 0; ; index++) {
    yield {
      x: center.x + index * offsetX,
      y: center.y + index * offsetY,
      z: center.z + index,
    };
  }
}

/**
 * Sorts items along an axis and distributes them evenly across the min/max range.
 * Sorts in ascending order for X axis, descending for Y axis.
 */
export function sortItemsAlongAxis<T, V extends number>(
  config: SortAxisConfig<T, V>,
): Array<{ item: T; position: number }> {
  const { axis, items, getPosition, getValue } = config;

  if (items.length < 2) {
    return items.map((item) => ({ item, position: getPosition(item) }));
  }

  const positions = items.map((item) => getPosition(item));
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  const spacing = (maxPos - minPos) / (items.length - 1);

  // Sort items by value: ascending for X, descending for Y
  const sorted = [...items].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    return axis === "x" ? aVal - bVal : bVal - aVal;
  });

  return sorted.map((item, index) => ({
    item,
    position: minPos + index * spacing,
  }));
}

function calculateAnchorPoint(items: CanvasItem[]): Position {
  if (items.length === 0) {
    return { x: 400, y: 300, z: 1 }; // Default center if no items
  }

  const sum = items.reduce(
    (acc, item) => ({
      x: acc.x + item.x + item.width / 2,
      y: acc.y + item.y + item.height / 2,
      z: Math.max(acc.z, item.zIndex ?? 1),
    }),
    { x: 0, y: 0, z: 1 },
  );

  return {
    x: sum.x / items.length,
    y: sum.y / items.length,
    z: sum.z + 1,
  };
}
