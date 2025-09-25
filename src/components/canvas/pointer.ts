import type { CanvasItem, ImageItem, TextItem } from "./canvas.component";

export interface SelectionState {
  images: ImageItem[];
  texts: TextItem[];
}

export interface SelectionUpdate {
  images: ImageItem[];
  texts: TextItem[];
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

  if (item.type === "image") {
    let updatedImages: ImageItem[];

    if (isMultiSelect) {
      // Toggle selection for multi-select
      updatedImages = currentState.images.map((img) =>
        img.id === item.id ? { ...img, isSelected: !img.isSelected } : img,
      );
    } else if (!isAlreadySelected) {
      // Single select - deselect all others, select this one
      updatedImages = currentState.images.map((img) => ({
        ...img,
        isSelected: img.id === item.id,
      }));
    } else {
      // Item is already selected and no multi-select - keep current state
      updatedImages = currentState.images;
    }

    // Deselect texts when selecting images
    const updatedTexts = currentState.texts.map((txt) => ({ ...txt, isSelected: false }));

    return { images: updatedImages, texts: updatedTexts };
  } else if (item.type === "text") {
    let updatedTexts: TextItem[];

    if (isMultiSelect) {
      // Toggle selection for multi-select
      updatedTexts = currentState.texts.map((txt) =>
        txt.id === item.id ? { ...txt, isSelected: !txt.isSelected } : txt,
      );
    } else if (!isAlreadySelected) {
      // Single select - deselect all others, select this one
      updatedTexts = currentState.texts.map((txt) => ({
        ...txt,
        isSelected: txt.id === item.id,
      }));
    } else {
      // Item is already selected and no multi-select - keep current state
      updatedTexts = currentState.texts;
    }

    // Deselect images when selecting texts
    const updatedImages = currentState.images.map((img) => ({ ...img, isSelected: false }));

    return { images: updatedImages, texts: updatedTexts };
  }

  // Fallback - no change
  return currentState;
}

/**
 * Deselect all items in the selection state
 */
export function deselectAll(currentState: SelectionState): SelectionUpdate {
  const updatedImages = currentState.images.map((img) => ({ ...img, isSelected: false }));
  const updatedTexts = currentState.texts.map((txt) => ({ ...txt, isSelected: false }));
  return { images: updatedImages, texts: updatedTexts };
}

/**
 * Prepare drag data for selected items
 */
export function prepareDragData(canvas: HTMLElement, selectedItems: CanvasItem[], mouseEvent: MouseEvent): DragData[] {
  return selectedItems.map((dragItem) => {
    const cssClass = dragItem.id.startsWith("img-") ? "canvas-image" : "canvas-text";
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
