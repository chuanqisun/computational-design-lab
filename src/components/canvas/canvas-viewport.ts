import { BehaviorSubject } from "rxjs";
import type { CanvasItem } from "./canvas.component";

/**
 * Infinite canvas.
 *
 * Cards live in *world* coordinates (unbounded, may be negative). The scrollable `.canvas` element only
 * spans the current world `extent`; a `.canvas-world` layer inside it is offset by `-extent.minX/minY`, so
 *
 *   content (scroll) coordinate = world coordinate - extent.minX
 *
 * The extent grows in coarse steps whenever the view or the cards get within one screen of its edge. Growing
 * left/up shifts the world layer, and the scroll position is shifted by the same amount in the same frame,
 * so nothing moves on screen and card coordinates never change. A large empty extent costs nothing: the
 * browser paints only what is visible, and only cards near the view are rendered (see `visibleItemIds`).
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Growth granularity. A multiple of the 20px dot grid, and coarse so scroll shifts are rare. */
export const EXTENT_STEP = 2000;
/** The legacy fixed 8000x8000 board, so world == content coordinates for existing boards and saved views. */
export const DEFAULT_EXTENT: Extent = { minX: 0, minY: 0, maxX: 8000, maxY: 8000 };

const floorTo = (value: number, step: number) => Math.floor(value / step) * step;
const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;

/**
 * Grow `extent` (never shrink) to contain every rect padded by `pad` on each side, snapped outward to `step`.
 * Returns the same object when nothing changes.
 */
export function growExtent(extent: Extent, rects: Rect[], pad: { x: number; y: number }, step = EXTENT_STEP): Extent {
  let { minX, minY, maxX, maxY } = extent;
  for (const rect of rects) {
    minX = Math.min(minX, floorTo(rect.x - pad.x, step));
    minY = Math.min(minY, floorTo(rect.y - pad.y, step));
    maxX = Math.max(maxX, ceilTo(rect.x + rect.width + pad.x, step));
    maxY = Math.max(maxY, ceilTo(rect.y + rect.height + pad.y, step));
  }
  if (minX === extent.minX && minY === extent.minY && maxX === extent.maxX && maxY === extent.maxY) return extent;
  return { minX, minY, maxX, maxY };
}

export function itemsBounds(items: CanvasItem[]): Rect | null {
  if (!items.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Ids of cards to render: those intersecting the view expanded by `margin` (a fraction of the view size),
 * plus every selected card, so drag and selection styling always have a DOM element.
 */
export function visibleItemIds(items: CanvasItem[], view: Rect, margin = 0.5): string[] {
  const mx = view.width * margin;
  const my = view.height * margin;
  const left = view.x - mx;
  const top = view.y - my;
  const right = view.x + view.width + mx;
  const bottom = view.y + view.height + my;
  const ids: string[] = [];
  for (const item of items) {
    if (
      item.isSelected ||
      (item.x < right && item.x + item.width > left && item.y < bottom && item.y + item.height > top)
    ) {
      ids.push(item.id);
    }
  }
  return ids;
}

// --- DOM binding (one board per page) -------------------------------------------------------------------

const FALLBACK_VIEW: Rect = { x: 0, y: 0, width: 1200, height: 800 };

let extent: Extent = DEFAULT_EXTENT;
/** The visible world rect. Updated on scroll/resize (by the canvas component) and on extent changes. */
export const worldView$ = new BehaviorSubject<Rect>(FALLBACK_VIEW);

const getArea = () => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".canvas-area"));
const getCanvas = () => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-canvas]"));

const extentKey = (e: Extent) => `${e.minX},${e.minY},${e.maxX},${e.maxY}`;

/** Write the extent to the canvas element (idempotent; also catches up after the element mounts). */
function applyExtent(canvas: HTMLElement) {
  const key = extentKey(extent);
  if (canvas.dataset.extent === key) return;
  canvas.dataset.extent = key;
  canvas.style.setProperty("--origin-x", `${-extent.minX}px`);
  canvas.style.setProperty("--origin-y", `${-extent.minY}px`);
  canvas.style.setProperty("--canvas-width", `${extent.maxX - extent.minX}px`);
  canvas.style.setProperty("--canvas-height", `${extent.maxY - extent.minY}px`);
}

export function getExtent(): Extent {
  return extent;
}

/** The visible world rect, read from the DOM. */
export function getWorldViewport(): Rect {
  const area = getArea();
  if (!area) return FALLBACK_VIEW;
  return {
    x: area.scrollLeft + extent.minX,
    y: area.scrollTop + extent.minY,
    width: area.clientWidth,
    height: area.clientHeight,
  };
}

/**
 * Grow the extent so every rect (and the current view) has at least one screen of room around it.
 * Left/up growth is compensated by scrolling, so the view stays visually still.
 */
export function ensureExtent(rects: Rect[] = []) {
  const area = getArea();
  const canvas = getCanvas();
  const view = area ? getWorldViewport() : null;
  const pad = area
    ? { x: area.clientWidth, y: area.clientHeight }
    : { x: FALLBACK_VIEW.width, y: FALLBACK_VIEW.height };
  const prev = extent;
  extent = growExtent(prev, view ? [view, ...rects] : rects, pad);
  if (canvas) applyExtent(canvas);
  if (area && extent !== prev) {
    area.scrollLeft += prev.minX - extent.minX;
    area.scrollTop += prev.minY - extent.minY;
  }
}

/** Re-measure: grow the extent around the view and publish the visible world rect. */
export function refreshViewport() {
  ensureExtent();
  const next = getWorldViewport();
  const prev = worldView$.value;
  if (prev.x !== next.x || prev.y !== next.y || prev.width !== next.width || prev.height !== next.height) {
    worldView$.next(next);
  }
}

/** Scroll so the view's top-left is at world (x, y). */
export function scrollToWorld(x: number, y: number, behavior: ScrollBehavior = "auto") {
  const area = getArea();
  if (!area) return;
  // Make room for the destination first, so a smooth scroll never needs an extent shift mid-flight.
  ensureExtent([{ x, y, width: area.clientWidth, height: area.clientHeight }]);
  area.scrollTo({ left: x - extent.minX, top: y - extent.minY, behavior });
  if (behavior !== "smooth") refreshViewport();
}

/** Convert a client (mouse) position to world coordinates. */
export function clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const canvas = getCanvas();
  if (!canvas) return { x: clientX, y: clientY };
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left + extent.minX, y: clientY - rect.top + extent.minY };
}

/** Test-only: reset module state. */
export function resetViewportForTests() {
  extent = DEFAULT_EXTENT;
  worldView$.next(FALLBACK_VIEW);
}
