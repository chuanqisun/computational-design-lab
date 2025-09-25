import type { CanvasItem } from "./canvas.component";

export interface SelectionState {
  items: CanvasItem[];
}

export interface SelectionUpdate {
  items: CanvasItem[];
}

export interface DragData {
  el: HTMLElement;
  offsetX: number;
  offsetY: number;
  item: CanvasItem;
}

export interface MoveUpdate {
  id: string;
  x: number;
  y: number;
}

/**
 * Calculate selection state update when an item is clicked
 */
export function calculateSelectionUpdate(
  item: CanvasItem,
  currentState: SelectionState,
  isCtrlPressed: boolean,
  isShiftPressed: boolean,
): SelectionUpdate {
  const isMultiSelect = isCtrlPressed || isShiftPressed;
  const isAlreadySelected = item.isSelected;

  let updatedItems: CanvasItem[];

  if (isMultiSelect) {
    // Toggle selection for multi-select
    updatedItems = currentState.items.map((currentItem) =>
      currentItem.id === item.id ? { ...currentItem, isSelected: !currentItem.isSelected } : currentItem,
    );
  } else if (!isAlreadySelected) {
    // Single select - deselect all others, select this one
    updatedItems = currentState.items.map((currentItem) => ({
      ...currentItem,
      isSelected: currentItem.id === item.id,
    }));
  } else {
    // Item is already selected and no multi-select - keep current state
    updatedItems = currentState.items;
  }

  return { items: updatedItems };
}

/**
 * Deselect all items in the selection state
 */
export function deselectAll(currentState: SelectionState): SelectionUpdate {
  const updatedItems = currentState.items.map((item) => ({ ...item, isSelected: false }));
  return { items: updatedItems };
}

/**
 * Prepare drag data for selected items
 */
export function prepareDragData(canvas: HTMLElement, selectedItems: CanvasItem[], mouseEvent: MouseEvent): DragData[] {
  return selectedItems.map((dragItem) => {
    const cssClass = dragItem.type === "image" ? "canvas-image" : "canvas-text";
    const el = canvas.querySelector(`.${cssClass}[data-id="${dragItem.id}"]`) as HTMLElement;
    const offsetX = mouseEvent.clientX - dragItem.x;
    const offsetY = mouseEvent.clientY - dragItem.y;
    return { el, offsetX, offsetY, item: dragItem };
  });
}

/**
 * Update element positions during drag
 */
export function updateDragPositions(dragData: DragData[], mouseEvent: MouseEvent): void {
  dragData.forEach(({ el, offsetX, offsetY }) => {
    const x = mouseEvent.clientX - offsetX;
    const y = mouseEvent.clientY - offsetY;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
}

/**
 * Calculate final positions after drag ends
 */
export function calculateFinalPositions(dragData: DragData[]): MoveUpdate[] {
  return dragData.map(({ el, item }) => {
    const x = parseFloat(el.style.left || "0");
    const y = parseFloat(el.style.top || "0");
    return { id: item.id, x, y };
  });
}

/**
 * Update z-index for elements to bring them to top
 */
export function updateZIndex(elements: HTMLElement[], startingZIndex: number): number {
  let zSeq = startingZIndex;
  elements.forEach((el) => {
    el.style.zIndex = String(++zSeq);
  });
  return zSeq;
}

/**
 * Check if a target element is the canvas itself (not a child item)
 */
export function isCanvasDirectClick(event: MouseEvent): boolean {
  return event.target === event.currentTarget;
}

/**
 * Extract modifier keys from mouse event
 */
export function getModifierKeys(event: MouseEvent): { isCtrl: boolean; isShift: boolean } {
  return {
    isCtrl: event.ctrlKey || event.metaKey,
    isShift: event.shiftKey,
  };
}
