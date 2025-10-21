import type { Observable } from "rxjs";
import { defer, generate } from "rxjs";
import type { CanvasItem } from "./canvas.component";

export interface Position {
  x: number;
  y: number;
}

export interface NextPositionsConfig {
  offsetX?: number;
  offsetY?: number;
}

/**
 * Creates an infinite observable that generates positions offset diagonally
 * from the center of the anchor items. Each position moves right and down.
 *
 * Pattern (with default 50px offset):
 * Position 0: center
 * Position 1: center + (50, 50)
 * Position 2: center + (100, 100)
 * Position 3: center + (150, 150)
 * ... continues infinitely
 */
export function getNextPositions(anchorItems: CanvasItem[], config: NextPositionsConfig = {}): Observable<Position> {
  const { offsetX = 50, offsetY = 50 } = config;

  return defer(() => {
    const center = calculateCenter(anchorItems);

    return generate({
      initialState: 0,
      condition: () => true,
      iterate: (x) => x + 1,
      resultSelector: (index: number) => ({
        x: center.x + index * offsetX,
        y: center.y + index * offsetY,
      }),
    });
  });
}

function calculateCenter(items: CanvasItem[]): Position {
  if (items.length === 0) {
    return { x: 400, y: 300 }; // Default center if no items
  }

  const sum = items.reduce(
    (acc, item) => ({
      x: acc.x + item.x + item.width / 2,
      y: acc.y + item.y + item.height / 2,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / items.length,
    y: sum.y / items.length,
  };
}
