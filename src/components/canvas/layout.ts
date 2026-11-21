import type { CanvasItem } from "./canvas.component";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PlaceRowsOptions {
  /** Card ids whose left edge new rows align to. Defaults to all cards. */
  near?: string[];
  columns?: number;
  gap?: number;
  cardWidth?: number;
  cardHeight?: number;
  /** Used as origin when the board is empty. */
  viewport?: { x: number; y: number; width: number; height: number };
}

/**
 * Left-to-right rows below the lowest existing card (used by the "rows" arrangement).
 * New cards use {@link placeCentered} instead.
 */
export function placeRows(items: CanvasItem[], count: number, options: PlaceRowsOptions = {}): Position[] {
  const { near, columns = 4, gap = 24, cardWidth = 200, cardHeight = 300, viewport } = options;
  if (count <= 0) return [];

  const maxZ = items.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
  let originX: number;
  let originY: number;

  if (items.length === 0) {
    originX = (viewport?.x ?? 0) + gap;
    originY = (viewport?.y ?? 0) + gap;
  } else {
    const nearItems = near?.length ? items.filter((item) => near.includes(item.id)) : [];
    const alignItems = nearItems.length > 0 ? nearItems : items;
    originX = Math.min(...alignItems.map((item) => item.x));
    originY = Math.max(...items.map((item) => item.y + item.height)) + gap;
  }

  return Array.from({ length: count }, (_, index) => ({
    x: originX + (index % columns) * (cardWidth + gap),
    y: originY + Math.floor(index / columns) * (cardHeight + gap),
    z: maxZ + index + 1,
  }));
}

export interface PlaceCenteredOptions {
  viewport: { x: number; y: number; width: number; height: number };
  columns?: number;
  gap?: number;
  cardWidth?: number;
  cardHeight?: number;
  /**
   * How many leading rows to center and keep clear of existing cards. Defaults to all rows.
   * Streamed placement asks for many slots up front but usually fills only the first row, so it passes 1.
   */
  centerRows?: number;
  /** How many grid steps outward to search for a free spot before overlapping. */
  searchRadius?: number;
}

/**
 * Shared placement policy for every card-creating action (human or AI).
 * New cards go in left-to-right rows centered on the visible viewport. If that spot is covered by
 * existing cards, the block shifts to the nearest free spot (by grid steps); if none is found nearby,
 * it stays centered and overlaps.
 */
export function placeCentered(items: CanvasItem[], count: number, options: PlaceCenteredOptions): Position[] {
  const { viewport, columns = 4, gap = 24, cardWidth = 200, cardHeight = 300, searchRadius = 4 } = options;
  if (count <= 0) return [];

  const maxZ = items.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
  const cols = Math.min(count, columns);
  const rows = Math.ceil(count / cols);
  const centerRows = Math.max(1, Math.min(rows, options.centerRows ?? rows));
  const blockWidth = cols * cardWidth + (cols - 1) * gap;
  const blockHeight = centerRows * cardHeight + (centerRows - 1) * gap;
  const baseX = viewport.x + viewport.width / 2 - blockWidth / 2;
  const baseY = viewport.y + viewport.height / 2 - blockHeight / 2;

  const isFree = (x: number, y: number) =>
    !items.some(
      (item) =>
        x < item.x + item.width + gap &&
        x + blockWidth + gap > item.x &&
        y < item.y + item.height + gap &&
        y + blockHeight + gap > item.y,
    );

  // Candidate offsets in grid steps, nearest (Euclidean, in pixels) first.
  const stepX = cardWidth + gap;
  const stepY = cardHeight + gap;
  const offsets: { dx: number; dy: number; distance: number }[] = [];
  for (let i = -searchRadius; i <= searchRadius; i++) {
    for (let j = -searchRadius; j <= searchRadius; j++) {
      offsets.push({ dx: i * stepX, dy: j * stepY, distance: Math.hypot(i * stepX, j * stepY) });
    }
  }
  offsets.sort((a, b) => a.distance - b.distance);
  const free = offsets.find(({ dx, dy }) => isFree(baseX + dx, baseY + dy)) ?? { dx: 0, dy: 0 };

  const originX = Math.round(baseX + free.dx);
  const originY = Math.round(baseY + free.dy);
  return Array.from({ length: count }, (_, index) => ({
    x: originX + (index % cols) * (cardWidth + gap),
    y: originY + Math.floor(index / cols) * (cardHeight + gap),
    z: maxZ + index + 1,
  }));
}

export interface PlaceBelowOptions {
  columns?: number;
  gap?: number;
  cardWidth?: number;
  cardHeight?: number;
  /** How many leading rows must not overlap other cards. Defaults to all rows (streamed placement passes 1). */
  clearRows?: number;
}

/**
 * Workflow placement: rows starting at the bottom-left of `anchor` (the previous step's cards), plus `gap`.
 * If that block would overlap other cards, it moves down past them, keeping the left edge.
 */
export function placeBelow(
  items: CanvasItem[],
  anchor: CanvasItem[],
  count: number,
  options: PlaceBelowOptions = {},
): Position[] {
  const { columns = 4, gap = 24, cardWidth = 200, cardHeight = 300 } = options;
  if (count <= 0 || anchor.length === 0) return [];

  const maxZ = items.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
  const cols = Math.min(count, columns);
  const rows = Math.ceil(count / cols);
  const clearRows = Math.max(1, Math.min(rows, options.clearRows ?? rows));
  const blockWidth = cols * cardWidth + (cols - 1) * gap;
  const blockHeight = clearRows * cardHeight + (clearRows - 1) * gap;

  const originX = Math.min(...anchor.map((item) => item.x));
  let originY = Math.max(...anchor.map((item) => item.y + item.height)) + gap;

  // Each pass moves strictly downward past at least one card, so this terminates within items.length passes.
  for (let pass = 0; pass <= items.length; pass++) {
    const blockers = items.filter(
      (item) =>
        originX < item.x + item.width + gap &&
        originX + blockWidth + gap > item.x &&
        originY < item.y + item.height + gap &&
        originY + blockHeight + gap > item.y,
    );
    if (!blockers.length) break;
    originY = Math.max(...blockers.map((item) => item.y + item.height)) + gap;
  }

  return Array.from({ length: count }, (_, index) => ({
    x: originX + (index % cols) * (cardWidth + gap),
    y: originY + Math.floor(index / cols) * (cardHeight + gap),
    z: maxZ + index + 1,
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

export interface OrganizeOptions {
  gap?: number;
  /** Top-left of the first row. Defaults to the top-left of the items' bounding box. */
  origin?: { x: number; y: number };
}

/** Fallback grouping key for cards without a creation stamp: the id prefix (e.g. "scan" in "scan-ab12cd34"). */
const idPrefix = (id: string) => /^(.+)-[a-z0-9]+$/i.exec(id)?.[1] ?? id;

/**
 * Lay items out chronologically: one row per creating action (left to right in creation order),
 * rows stacked top to bottom from oldest to newest.
 *
 * Grouping uses `metadata.createdBy.runId` / `metadata.createdAt`. Unstamped cards (older boards) keep
 * their array order (which is insertion order) and are grouped into contiguous runs of the same id prefix.
 * They are placed before stamped cards, since they predate stamping.
 */
export function organizeChronologically(
  items: CanvasItem[],
  options: OrganizeOptions = {},
): { id: string; x: number; y: number }[] {
  if (!items.length) return [];
  const gap = options.gap ?? 24;
  const originX = options.origin?.x ?? Math.min(...items.map((item) => item.x));
  const originY = options.origin?.y ?? Math.min(...items.map((item) => item.y));

  interface Group {
    key: string;
    at: number;
    order: number;
    cards: CanvasItem[];
  }
  const groups = new Map<string, Group>();
  let legacyRun = 0;
  let lastLegacyPrefix: string | null = null;

  items.forEach((item, order) => {
    const runId = item.metadata?.createdBy?.runId;
    let key: string;
    let at: number;
    if (runId) {
      key = `run:${runId}`;
      at = item.metadata?.createdAt ?? 0;
      lastLegacyPrefix = null;
    } else {
      const prefix = idPrefix(item.id);
      if (prefix !== lastLegacyPrefix) legacyRun++;
      lastLegacyPrefix = prefix;
      key = `legacy:${legacyRun}`;
      at = -Infinity;
    }
    const group = groups.get(key);
    if (group) {
      group.cards.push(item);
      group.at = Math.min(group.at, at);
    } else {
      groups.set(key, { key, at, order, cards: [item] });
    }
  });

  const rows = [...groups.values()].sort((a, b) => a.at - b.at || a.order - b.order);

  const moves: { id: string; x: number; y: number }[] = [];
  let y = originY;
  for (const row of rows) {
    let x = originX;
    for (const card of row.cards) {
      moves.push({ id: card.id, x, y });
      x += card.width + gap;
    }
    y += Math.max(...row.cards.map((card) => card.height)) + gap;
  }
  return moves;
}
