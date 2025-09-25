import { html } from "lit-html";
import { BehaviorSubject, Subject, catchError, combineLatest, ignoreElements, map, mergeWith, of, tap } from "rxjs";
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
  type: "image" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected?: boolean;
  zIndex?: number;
  // Image-specific properties
  src?: string;
  // Text-specific properties
  title?: string;
  content?: string;
}

// Legacy interfaces for backward compatibility
export interface ImageItem extends Omit<CanvasItem, "type"> {
  src: string;
}

export interface TextItem extends Omit<CanvasItem, "type"> {
  title: string;
  content: string;
}

export const CanvasComponent = createComponent(
  (props: {
    images$: BehaviorSubject<ImageItem[]>;
    texts$: BehaviorSubject<TextItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    // Convert legacy props to unified items
    const items$ = combineLatest([props.images$, props.texts$]).pipe(
      map(([images, texts]) => [
        ...images.map((img): CanvasItem => ({ ...img, type: "image" as const })),
        ...texts.map((txt): CanvasItem => ({ ...txt, type: "text" as const })),
      ]),
    );

    // Internal state
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
      map((src) => {
        const newImage: ImageItem = {
          id: `img-${Date.now()}`,
          src,
          x: Math.random() * 400, // Random position
          y: Math.random() * 400,
          width: 200,
          height: 200,
          zIndex: ++zSeq,
        };
        props.images$.next([...props.images$.value, newImage]);
      }),
    );

    const pasteTextEffect$ = pasteText$.pipe(
      tap((text) => {
        const textId = `text-${Date.now()}`;
        const newText: TextItem = {
          id: textId,
          title: "Text",
          content: text,
          x: Math.random() * 400,
          y: Math.random() * 400,
          width: 200,
          height: 200,
          zIndex: ++zSeq,
        };
        props.texts$.next([...props.texts$.value, newText]);

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
        // Update images
        const currentImages = props.images$.value;
        const imageUpdates = moves.filter((move) => move.id.startsWith("img-"));
        if (imageUpdates.length > 0) {
          const movedImages = imageUpdates
            .map((move) => {
              const item = currentImages.find((img) => img.id === move.id);
              return item ? { ...item, x: move.x, y: move.y } : null;
            })
            .filter(Boolean) as ImageItem[];
          const movedIds = imageUpdates.map((m) => m.id);
          const otherImages = currentImages.filter((img) => !movedIds.includes(img.id));
          props.images$.next([...otherImages, ...movedImages]);
        }

        // Update texts
        const currentTexts = props.texts$.value;
        const textUpdates = moves.filter((move) => move.id.startsWith("text-"));
        if (textUpdates.length > 0) {
          const movedTexts = textUpdates
            .map((move) => {
              const item = currentTexts.find((txt) => txt.id === move.id);
              return item ? { ...item, x: move.x, y: move.y } : null;
            })
            .filter(Boolean) as TextItem[];
          const movedIds = textUpdates.map((m) => m.id);
          const otherTexts = currentTexts.filter((txt) => !movedIds.includes(txt.id));
          props.texts$.next([...otherTexts, ...movedTexts]);
        }
      }),
    );

    const deleteEffect$ = deleteSelected$.pipe(
      tap(() => {
        const currentImages = props.images$.value;
        const updatedImages = currentImages.filter((img) => !img.isSelected);
        props.images$.next(updatedImages);
        const currentTexts = props.texts$.value;
        const updatedTexts = currentTexts.filter((txt) => !txt.isSelected);
        props.texts$.next(updatedTexts);
      }),
    );

    const updateTitleEffect$ = updateTextTitle$.pipe(
      tap(({ id, title }) => {
        const currentTexts = props.texts$.value;
        const updatedTexts = currentTexts.map((txt) => (txt.id === id ? { ...txt, title } : txt));
        props.texts$.next(updatedTexts);
      }),
    );

    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      e.stopPropagation(); // Prevent canvas click when clicking on item

      const { isCtrl, isShift } = getModifierKeys(e);
      const currentState: SelectionState = {
        images: props.images$.value,
        texts: props.texts$.value,
      };

      // Calculate selection update
      const selectionUpdate = calculateSelectionUpdate(item, currentState, isCtrl, isShift);
      props.images$.next(selectionUpdate.images);
      props.texts$.next(selectionUpdate.texts);

      // Check if the clicked item is selected after update
      const updatedItem =
        item.type === "image"
          ? selectionUpdate.images.find((img) => img.id === item.id)
          : selectionUpdate.texts.find((txt) => txt.id === item.id);

      if (!updatedItem?.isSelected) return;

      // Bring the clicked item to the top
      if (item.type === "image") {
        const index = selectionUpdate.images.findIndex((img) => img.id === item.id);
        if (index !== -1) {
          selectionUpdate.images[index] = { ...selectionUpdate.images[index], zIndex: ++zSeq };
          props.images$.next([...selectionUpdate.images]);
        }
      } else {
        const index = selectionUpdate.texts.findIndex((txt) => txt.id === item.id);
        if (index !== -1) {
          selectionUpdate.texts[index] = { ...selectionUpdate.texts[index], zIndex: ++zSeq };
          props.texts$.next([...selectionUpdate.texts]);
        }
      }

      // Get all selected items to drag
      const selectedImages = selectionUpdate.images.filter((img) => img.isSelected);
      const selectedTexts = selectionUpdate.texts.filter((txt) => txt.isSelected);
      const allSelectedItems: CanvasItem[] = [
        ...selectedImages.map((img): CanvasItem => ({ ...img, type: "image" as const })),
        ...selectedTexts.map((txt): CanvasItem => ({ ...txt, type: "text" as const })),
      ];

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
          images: props.images$.value,
          texts: props.texts$.value,
        };
        const selectionUpdate = deselectAll(currentState);
        props.images$.next(selectionUpdate.images);
        props.texts$.next(selectionUpdate.texts);
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
        const hasSelected =
          props.images$.value.some((img) => img.isSelected) || props.texts$.value.some((txt) => txt.isSelected);
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
            ${items.map((item) => {
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
            })}
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
