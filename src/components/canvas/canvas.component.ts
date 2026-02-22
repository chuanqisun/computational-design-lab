import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, Subject, catchError, ignoreElements, map, mergeWith, of, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { generateTitle$ } from "../context-tray/llm/generate-title-gemini";
import "./canvas.component.css";
import { processClipboardPaste } from "./clipboard";
import { getViewportCenter } from "./layout";
import {
  analyzeClick,
  applySingleSelection,
  calculateFinalPositions,
  calculateSelectionUpdate,
  deselectAll,
  getModifierKeys,
  isCanvasDirectClick,
  prepareDragData,
  updateDragPositions,
  type SelectionState,
} from "./pointer";

export interface CanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected?: boolean;
  zIndex?: number;
  title?: string;
  body?: string;
  imageSrc?: string;
  imagePrompt?: string;
  metadata?: Record<string, any>;
}

export function hasImage(item: CanvasItem): boolean {
  return !!(item.imageSrc || item.imagePrompt);
}

export function hasText(item: CanvasItem): boolean {
  return !!(item.body);
}

/** Migrate legacy items from IndexedDB */
export function migrateItem(item: any): CanvasItem {
  if (item.type === "image") {
    return { ...item, imageSrc: item.imageSrc ?? item.src, type: undefined, src: undefined };
  }
  if (item.type === "text") {
    return { ...item, body: item.body ?? item.content, type: undefined, content: undefined };
  }
  return item;
}

export const CanvasComponent = createComponent(
  (props: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    // Internal state
    const items$ = props.items$;

    // Helper: Get next z-index atomically
    const getNextZIndex = () => {
      const currentItems = props.items$.value;
      const maxZ = currentItems.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
      return maxZ + 1;
    };

    // Actions
    const pasteImage$ = new Subject<string>();
    const pasteText$ = new Subject<string>();
    const moveItems$ = new Subject<{ moves: { id: string; x: number; y: number }[] }>();
    const deleteSelected$ = new Subject<void>();
    const updateCard$ = new Subject<{ id: string; updates: Partial<CanvasItem> }>();

    // Effects
    const pasteEffect$ = pasteImage$.pipe(
      tap((src) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const cardId = `img-${Date.now()}`;

        const card: CanvasItem = {
          id: cardId,
          imageSrc: src,
          x: center.x - 100,
          y: center.y - 150,
          width: 200,
          height: 300,
          zIndex: getNextZIndex(),
        };
        props.items$.next([...props.items$.value, card]);

        // Eventually generate title
        const apiKey = props.apiKeys$.value.gemini;
        if (apiKey) {
          generateTitle$({ text: "Describe this pasted image briefly", apiKey })
            .pipe(catchError(() => of("Image")))
            .subscribe((title) => updateCard$.next({ id: cardId, updates: { title } }));
        }
      }),
    );

    const pasteTextEffect$ = pasteText$.pipe(
      tap((text) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const cardId = `text-${Date.now()}`;

        const card: CanvasItem = {
          id: cardId,
          title: "Text",
          body: text,
          imagePrompt: text,
          x: center.x - 100,
          y: center.y - 150,
          width: 200,
          height: 300,
          zIndex: getNextZIndex(),
        };
        props.items$.next([...props.items$.value, card]);

        // Generate title
        const apiKey = props.apiKeys$.value.gemini;
        if (apiKey) {
          generateTitle$({ text, apiKey })
            .pipe(catchError(() => of("Text")))
            .subscribe((title) => updateCard$.next({ id: cardId, updates: { title } }));
        }
      }),
    );

    const moveEffect$ = moveItems$.pipe(
      tap(({ moves }) => {
        const currentItems = props.items$.value;
        const updatedItems = currentItems.map((item) => {
          const move = moves.find((m) => m.id === item.id);
          return move ? { ...item, x: move.x, y: move.y } : item;
        });
        props.items$.next(updatedItems);
      }),
    );

    const deleteEffect$ = deleteSelected$.pipe(
      tap(() => {
        const currentItems = props.items$.value;
        const filteredItems = currentItems.filter((item) => !item.isSelected);
        props.items$.next(filteredItems);
      }),
    );

    const updateCardEffect$ = updateCard$.pipe(
      tap(({ id, updates }) => {
        const currentItems = props.items$.value;
        const updatedItems = currentItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
        props.items$.next(updatedItems);
      }),
    );

    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      e.stopPropagation(); // Prevent canvas click when clicking on item

      const { isCtrl, isShift } = getModifierKeys(e);
      const currentState: SelectionState = {
        items: props.items$.value,
      };

      // Analyze the click context
      const analysis = analyzeClick({ item, currentState, isCtrl, isShift });

      // Calculate selection update, but defer single-selection if we might be dragging
      const selectionUpdate = calculateSelectionUpdate(
        item,
        currentState,
        isCtrl,
        isShift,
        analysis.shouldDeferSingleSelect,
      );
      props.items$.next(selectionUpdate.items);

      // Check if the clicked item is selected after update
      const updatedItem = selectionUpdate.items.find((i) => i.id === item.id);

      if (!updatedItem?.isSelected) return;

      // Bring the clicked item to the top (highest z-index)
      const currentItems = props.items$.value;
      const nextZ = getNextZIndex();
      const updatedItems = currentItems.map((i) => (i.id === item.id ? { ...i, zIndex: nextZ } : i));
      props.items$.next(updatedItems);

      // Get all selected items to drag (sorted by z-index for proper visual stacking)
      const allSelectedItems = updatedItems
        .filter((i) => i.isSelected)
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      const canvas = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
      const draggedData = prepareDragData(canvas, allSelectedItems, e);

      let hasMoved = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        hasMoved = true;
        updateDragPositions(draggedData, moveEvent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (hasMoved) {
          const newPositions = calculateFinalPositions(draggedData);
          moveItems$.next({ moves: newPositions });
        } else if (analysis.shouldDeferSingleSelect) {
          // If we didn't move and should switch to single selection, do it now
          const singleSelectItems = applySingleSelection(props.items$.value, item.id);
          props.items$.next(singleSelectItems);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Handle canvas click to deselect all
    const handleCanvasClick = (e: MouseEvent) => {
      // Only deselect if clicking directly on canvas (not on an image)
      if (isCanvasDirectClick(e)) {
        const currentState: SelectionState = {
          items: props.items$.value,
        };
        const selectionUpdate = deselectAll(currentState);
        props.items$.next(selectionUpdate.items);
      }
    };

    // Handle paste event
    const handlePaste = (event: ClipboardEvent) => {
      processClipboardPaste(event).subscribe((action) => {
        if (action.type === "image") pasteImage$.next(action.src);
        else pasteText$.next(action.content);
      });
    };

    // Handle keydown event for delete/backspace
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const hasSelected = props.items$.value.some((item) => item.isSelected);
        if (hasSelected) {
          event.preventDefault();
          deleteSelected$.next();
        }
      }
    };

    // Template
    const template$ = items$.pipe(
      map(
        (items) => html`
          <div
            class="canvas"
            data-canvas
            tabindex="0"
            @paste=${handlePaste}
            @click=${handleCanvasClick}
            @keydown=${handleKeyDown}
          >
            ${repeat(
              items,
              (item) => item.id,
              (item) => html`
                <div
                  class="canvas-card ${item.isSelected ? "selected" : ""}"
                  data-id="${item.id}"
                  style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex || 0};"
                  @mousedown=${(e: MouseEvent) => handleMouseDown(item, e)}
                >
                  <div class="card-image-area">
                    ${item.imageSrc
                      ? html`<img src="${item.imageSrc}" alt="${item.title || "Image"}" />`
                      : item.imagePrompt
                        ? html`<generative-image prompt="${item.imagePrompt}" width="200" height="200"></generative-image>`
                        : html``}
                  </div>
                  <div class="card-text-area">
                    ${item.title ? html`<div class="card-title">${item.title}</div>` : html``}
                    ${item.body ? html`<div class="card-body">${item.body}</div>` : html``}
                  </div>
                </div>
              `,
            )}
          </div>
        `,
      ),
    );

    // Combine template with effects
    return template$.pipe(
      mergeWith(
        pasteEffect$.pipe(ignoreElements()),
        pasteTextEffect$.pipe(ignoreElements()),
        moveEffect$.pipe(ignoreElements()),
        deleteEffect$.pipe(ignoreElements()),
        updateCardEffect$.pipe(ignoreElements()),
      ),
    );
  },
);
