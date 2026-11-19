import type { Rect } from "./canvas-viewport";

export interface MinimapTransform {
  scale: number;
  /** Map pixel = (world - origin) * scale + offset */
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
}

/** Fit `bounds` (padded by `padding` px of map space) into a map of `width` x `height`, centered. */
export function fitMinimap(bounds: Rect, width: number, height: number, padding = 6): MinimapTransform {
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / Math.max(1, bounds.width), innerH / Math.max(1, bounds.height));
  return {
    scale,
    originX: bounds.x,
    originY: bounds.y,
    offsetX: padding + (innerW - bounds.width * scale) / 2,
    offsetY: padding + (innerH - bounds.height * scale) / 2,
  };
}

export function worldToMap(t: MinimapTransform, x: number, y: number) {
  return { x: (x - t.originX) * t.scale + t.offsetX, y: (y - t.originY) * t.scale + t.offsetY };
}

export function mapToWorld(t: MinimapTransform, x: number, y: number) {
  return { x: (x - t.offsetX) / t.scale + t.originX, y: (y - t.offsetY) / t.scale + t.originY };
}

/** Union of rects (cards + current view) so the view rectangle is always on the map. */
export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
