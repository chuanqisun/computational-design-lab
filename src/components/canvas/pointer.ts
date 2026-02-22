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

export interface ClickContext {
  item: CanvasItem;
  currentState: SelectionState;
  isCtrl: boolean;
  isShift: boolean;
}

export interface ClickAnalysis {
  isMultiSelectMode: boolean;
  isAlreadySelected: boolean;
  selectedCount: number;
  shouldDeferSingleSelect: boolean;
}

/**
 * Analyze click context to determine selection behavior
 */
export function analyzeClick(context: ClickContext): ClickAnalysis {
  const { item, currentState, isCtrl, isShift } = context;
  const isMultiSelectMode = isCtrl || isShift;
  const isAlreadySelected = item.isSelected || false;
  const selectedCount = currentState.items.filter((i) => i.isSelected).length;
  const shouldDeferSingleSelect = !isMultiSelectMode && isAlreadySelected && selectedCount > 1;

  return {
    isMultiSelectMode,
    isAlreadySelected,
    selectedCount,
    shouldDeferSingleSelect,
  };
}

/**
 * Apply single selection to a specific item
 */
export function applySingleSelection(items: CanvasItem[], itemId: string): CanvasItem[] {
  return items.map((i) => ({
    ...i,
    isSelected: i.id === itemId,
  }));
}

/**
 * Calculate selection state update when an item is clicked
 */
export function calculateSelectionUpdate(
  item: CanvasItem,
  currentState: SelectionState,
  isCtrlPressed: boolean,
  isShiftPressed: boolean,
  deferSingleSelect: boolean = false,
): SelectionUpdate {
  const isMultiSelect = isCtrlPressed || isShiftPressed;
  const isAlreadySelected = item.isSelected;
  const selectedCount = currentState.items.filter((i) => i.isSelected).length;

  let updatedItems: CanvasItem[];

  if (isMultiSelect) {
    // Toggle selection for multi-select - this should work for both selected and unselected items
    updatedItems = currentState.items.map((currentItem) =>
      currentItem.id === item.id ? { ...currentItem, isSelected: !currentItem.isSelected } : currentItem,
    );
  } else {
    // Without modifier keys, if multiple items are selected and clicking on an already selected item,
    // defer single selection switch if requested (for drag detection)
    if (isAlreadySelected && selectedCount > 1) {
      if (deferSingleSelect) {
        // Keep all items selected for now, will switch to single selection later if not dragging
        updatedItems = currentState.items;
      } else {
        // Switch to single selection immediately
        updatedItems = currentState.items.map((currentItem) => ({
          ...currentItem,
          isSelected: currentItem.id === item.id,
        }));
      }
    } else if (!isAlreadySelected) {
      // Single select - deselect all others, select this one
      updatedItems = currentState.items.map((currentItem) => ({
        ...currentItem,
        isSelected: currentItem.id === item.id,
      }));
    } else {
      // Item is already selected and is the only selected item - keep current state
      updatedItems = currentState.items;
    }
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
    const el = canvas.querySelector(`.canvas-card[data-id="${dragItem.id}"]`) as HTMLElement;
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
