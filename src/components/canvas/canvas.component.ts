import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, Subject, catchError, ignoreElements, map, mergeWith, of, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { generateTitle$ } from "../context-tray/llm/generate-title";
import "./canvas.component.css";
import { processClipboardPaste } from "./clipboard";
import {
  calculateFinalPositions,
  calculateSelectionUpdate,
  deselectAll,
  getModifierKeys,
  isCanvasDirectClick,
  prepareDragData,
  updateDragPositions,
  updateZIndex,
  type SelectionState,
} from "./pointer";

export interface CanvasItem {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected?: boolean;
  zIndex?: number;
  src?: string;
  title?: string;
  content?: string;
}

// Legacy interfaces for backward compatibility
export interface ImageItem extends CanvasItem {
  type: "image";
  src: string;
}

export interface TextItem extends CanvasItem {
  type: "text";
  title: string;
  content: string;
}

export const CanvasComponent = createComponent(
  (props: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    // Internal state
    const items$ = props.items$;
    // Local z-index sequence for ephemeral drag stacking without re-render
    let zSeq = 0;

    // Actions
    const pasteImage$ = new Subject<string>();
    const pasteText$ = new Subject<string>();
    const moveItems$ = new Subject<{ moves: { id: string; x: number; y: number }[] }>();
    const deleteSelected$ = new Subject<void>();
    const updateTextTitle$ = new Subject<{ id: string; title: string }>();

    // Effects
    const pasteEffect$ = pasteImage$.pipe(
      tap((src) => {
        const newImage: CanvasItem = {
          id: `img-${Date.now()}`,
          type: "image",
          src,
          x: Math.random() * 400, // Random position
          y: Math.random() * 400,
          width: 200,
          height: 200,
          zIndex: ++zSeq,
        };
        props.items$.next([...props.items$.value, newImage]);
      }),
    );

    const pasteTextEffect$ = pasteText$.pipe(
      tap((text) => {
        const textId = `text-${Date.now()}`;
        const newText: CanvasItem = {
          id: textId,
          type: "text",
          title: "Text",
          content: text,
          x: Math.random() * 400,
          y: Math.random() * 400,
          width: 200,
          height: 200,
          zIndex: ++zSeq,
        };
        props.items$.next([...props.items$.value, newText]);

        // Generate title for the new text item
        const apiKey = props.apiKeys$.value.openai;
        if (apiKey) {
          generateTitle$({ fullText: text, apiKey })
            .pipe(
              catchError(() => of("Text")), // Fallback to "Text" if generation fails
            )
            .subscribe((generatedTitle) => {
              updateTextTitle$.next({ id: textId, title: generatedTitle });
            });
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

    const updateTitleEffect$ = updateTextTitle$.pipe(
      tap(({ id, title }) => {
        const currentItems = props.items$.value;
        const updatedItems = currentItems.map((item) =>
          item.id === id && item.type === "text" ? { ...item, title } : item,
        );
        props.items$.next(updatedItems);
      }),
    );

    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      e.stopPropagation(); // Prevent canvas click when clicking on item

      const { isCtrl, isShift } = getModifierKeys(e);
      const currentState: SelectionState = {
        items: props.items$.value,
      };

      // Calculate selection update
      const selectionUpdate = calculateSelectionUpdate(item, currentState, isCtrl, isShift);
      props.items$.next(selectionUpdate.items);

      // Check if the clicked item is selected after update
      const updatedItem = selectionUpdate.items.find((i) => i.id === item.id);

      if (!updatedItem?.isSelected) return;

      // Bring the clicked item to the top
      const currentItems = props.items$.value;
      const updatedItems = currentItems.map((i) => (i.id === item.id ? { ...i, zIndex: ++zSeq } : i));
      props.items$.next(updatedItems);

      // Get all selected items to drag
      const allSelectedItems = selectionUpdate.items.filter((i) => i.isSelected);

      const canvas = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
      const draggedData = prepareDragData(canvas, allSelectedItems, e);

      // Update z-index for dragged elements
      const elements = draggedData.map(({ el }) => el);
      zSeq = updateZIndex(elements, zSeq);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateDragPositions(draggedData, moveEvent);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const newPositions = calculateFinalPositions(draggedData);
        moveItems$.next({ moves: newPositions });
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
          <div class="canvas" tabindex="0" @paste=${handlePaste} @click=${handleCanvasClick} @keydown=${handleKeyDown}>
            ${repeat(
              items,
              (item) => item.id,
              (item) => {
                if (item.type === "image") {
                  return html`
                    <div
                      class="canvas-item canvas-image ${item.isSelected ? "selected" : ""}"
                      data-id="${item.id}"
                      style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex ||
                      0};"
                      @mousedown=${(e: MouseEvent) => handleMouseDown(item, e)}
                    >
                      <img src="${item.src || ""}" alt="Pasted image" />
                    </div>
                  `;
                } else {
                  return html`
                    <div
                      class="canvas-item canvas-text text ${item.isSelected ? "selected" : ""}"
                      data-id="${item.id}"
                      style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex ||
                      0};"
                      @mousedown=${(e: MouseEvent) => handleMouseDown(item, e)}
                    >
                      <div class="text-title">${item.title}</div>
                    </div>
                  `;
                }
              },
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
        updateTitleEffect$.pipe(ignoreElements()),
      ),
    );
  },
);
