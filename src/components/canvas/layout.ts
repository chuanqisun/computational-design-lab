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

/**
 * Gathers items that are outside the viewport into visible positions.
 * Uses a smart grid layout that:
 * 1. Identifies which items are outside the viewport bounds
 * 2. Positions them in a compact grid within the viewport
 * 3. Preserves relative positioning where possible
 * 4. Avoids overlapping with existing visible items
 */
export function gatherItemsIntoViewport(
  items: CanvasItem[],
  viewport: { width: number; height: number; scrollX: number; scrollY: number },
): Array<{ id: string; x: number; y: number }> {
  debugger;
  const margin = 20; // Padding from viewport edges
  const gap = 20; // Gap between items in grid

  // Calculate viewport bounds
  const viewportLeft = viewport.scrollX;
  const viewportRight = viewport.scrollX + viewport.width;
  const viewportTop = viewport.scrollY;
  const viewportBottom = viewport.scrollY + viewport.height;

  // Separate items into visible and outside viewport
  const { visible, outside } = items.reduce(
    (acc, item) => {
      const itemRight = item.x + item.width;
      const itemBottom = item.y + item.height;
      const isVisible =
        item.x < viewportRight && itemRight > viewportLeft && item.y < viewportBottom && itemBottom > viewportTop;

      if (isVisible) {
        acc.visible.push(item);
      } else {
        acc.outside.push(item);
      }
      return acc;
    },
    { visible: [] as CanvasItem[], outside: [] as CanvasItem[] },
  );

  if (outside.length === 0) return [];

  // Find available space in viewport
  // Start from top-left with margin
  const gridStartX = viewportLeft + margin;
  const gridStartY = viewportTop + margin;
  const maxWidth = viewport.width - 2 * margin;

  // Calculate grid layout for outside items
  const moves: Array<{ id: string; x: number; y: number }> = [];
  let currentX = gridStartX;
  let currentY = gridStartY;
  let rowHeight = 0;

  for (const item of outside) {
    // Check if item fits in current row
    if (currentX + item.width > gridStartX + maxWidth && currentX > gridStartX) {
      // Move to next row
      currentX = gridStartX;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    // Check for collision with visible items
    let finalX = currentX;
    let finalY = currentY;

    // Try current position and a few alternatives
    for (let attempt = 0; attempt < 5; attempt++) {
      const testX = finalX;
      const testY = finalY + attempt * (item.height + gap);

      const hasCollision = visible.some((visibleItem) => {
        return !(
          testX + item.width <= visibleItem.x ||
          testX >= visibleItem.x + visibleItem.width ||
          testY + item.height <= visibleItem.y ||
          testY >= visibleItem.y + visibleItem.height
        );
      });

      if (!hasCollision) {
        finalY = testY;
        break;
      }
    }

    moves.push({ id: item.id, x: finalX, y: finalY });

    // Update position for next item
    currentX += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }

  return moves;
}

/**
 * Moves unselected items out of the viewport to higher x and y positions.
 * This allows the user to focus on selected items by clearing the viewport.
 * Unselected items are arranged in a grid pattern just outside the visible viewport bounds,
 * but still within the canvas area so they can be scrolled to or gathered back.
 */
export function focusSelectedItems(
  items: CanvasItem[],
  viewport: { width: number; height: number; scrollX: number; scrollY: number },
): Array<{ id: string; x: number; y: number }> {
  const gap = 20; // Gap between items in grid
  const offsetFromViewport = 50; // Distance to move items beyond visible viewport edge

  // Calculate visible viewport bounds
  const viewportRight = viewport.scrollX + viewport.width;

  // Separate items into selected and unselected
  const unselectedItems = items.filter((item) => !item.isSelected);

  if (unselectedItems.length === 0) return [];

  // Position unselected items in a grid just outside the visible viewport
  // Start from the right edge of the visible viewport
  const gridStartX = viewportRight + offsetFromViewport;
  const gridStartY = viewport.scrollY + 20; // Start from top of viewport with small margin
  const maxWidth = viewport.width; // Use viewport width for grid wrapping

  const moves: Array<{ id: string; x: number; y: number }> = [];
  let currentX = gridStartX;
  let currentY = gridStartY;
  let rowHeight = 0;

  for (const item of unselectedItems) {
    // Check if item fits in current row
    if (currentX + item.width > gridStartX + maxWidth && currentX > gridStartX) {
      // Move to next row
      currentX = gridStartX;
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    moves.push({ id: item.id, x: currentX, y: currentY });

    // Update position for next item
    currentX += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }

  return moves;
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
