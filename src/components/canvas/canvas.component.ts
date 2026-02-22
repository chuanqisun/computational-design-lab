import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, Subject, catchError, combineLatest, filter, ignoreElements, map, mergeWith, of, tap, withLatestFrom } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { observe } from "../../sdk/observe-directive";
import type { ApiKeys } from "../connections/storage";
import { generateTitle$ } from "../context-tray/llm/generate-title-gemini";
import { submitTask } from "../context-tray/tasks";
import { generateImage, type GeminiConnection } from "../design/generate-image-gemini";
import "./canvas.component.css";
import { copyItemsToClipboard, processClipboardPaste } from "./clipboard";
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
export function migrateItem(raw: any): CanvasItem {
  const { type: _type, src: _src, content: _content, ...rest } = raw;
  if (raw.type === "image") {
    return { ...rest, imageSrc: rest.imageSrc ?? raw.src };
  }
  if (raw.type === "text") {
    return { ...rest, body: rest.body ?? raw.content };
  }
  return rest;
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
    const pasteItems$ = new Subject<CanvasItem[]>();
    const moveItems$ = new Subject<{ moves: { id: string; x: number; y: number }[] }>();
    const deleteSelected$ = new Subject<void>();
    const updateCard$ = new Subject<{ id: string; updates: Partial<CanvasItem> }>();

    // Card dialog state
    const openedCardId$ = new BehaviorSubject<string | null>(null);
    const dialogPrompt$ = new BehaviorSubject<string>("");
    const isRegenerating$ = new BehaviorSubject<boolean>(false);
    const regenerate$ = new BehaviorSubject<boolean>(false);

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

    const pasteItemsEffect$ = pasteItems$.pipe(
      tap((pastedItems) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };

        // Calculate center of pasted items to offset them
        const avgX = pastedItems.reduce((sum, i) => sum + i.x, 0) / pastedItems.length;
        const avgY = pastedItems.reduce((sum, i) => sum + i.y, 0) / pastedItems.length;
        const offsetX = center.x - avgX;
        const offsetY = center.y - avgY;

        // Deselect all existing items
        const deselected = props.items$.value.map((item) => ({ ...item, isSelected: false }));

        const newItems: CanvasItem[] = pastedItems.map((item, index) => ({
          ...item,
          id: `paste-${Date.now()}-${index}`,
          x: item.x + offsetX,
          y: item.y + offsetY,
          isSelected: true,
          zIndex: getNextZIndex() + index,
        }));

        props.items$.next([...deselected, ...newItems]);
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

    const regenerateEffect$ = regenerate$.pipe(
      filter((v) => v === true),
      withLatestFrom(openedCardId$, dialogPrompt$, props.apiKeys$),
      tap(([_, cardId, prompt, apiKeys]) => {
        regenerate$.next(false);
        if (!cardId || !prompt.trim() || !apiKeys.gemini) return;

        isRegenerating$.next(true);
        const connection: GeminiConnection = { apiKey: apiKeys.gemini };

        const task$ = generateImage(connection, { prompt, width: 512, height: 512 }).pipe(
          tap((result) => {
            updateCard$.next({ id: cardId, updates: { imageSrc: result.url, imagePrompt: prompt } });
            isRegenerating$.next(false);
          }),
          tap({ error: () => isRegenerating$.next(false) }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    // Card dialog actions
    const openCard = (item: CanvasItem) => {
      openedCardId$.next(item.id);
      dialogPrompt$.next(item.imagePrompt || "");
      const dialog = document.getElementById("card-detail-dialog") as HTMLDialogElement | null;
      dialog?.showModal();
    };

    const closeCardDialog = () => {
      const dialog = document.getElementById("card-detail-dialog") as HTMLDialogElement | null;
      dialog?.close();
      openedCardId$.next(null);
    };

    const downloadImage = (src: string) => {
      const link = document.createElement("a");
      link.href = src;
      link.download = `${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

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

    // Clipboard: copy
    const handleCopy = (event: ClipboardEvent) => {
      const selected = props.items$.value.filter((item) => item.isSelected);
      if (selected.length === 0) return;
      event.preventDefault();
      copyItemsToClipboard(event, selected);
    };

    // Clipboard: cut
    const handleCut = (event: ClipboardEvent) => {
      const selected = props.items$.value.filter((item) => item.isSelected);
      if (selected.length === 0) return;
      event.preventDefault();
      copyItemsToClipboard(event, selected);
      deleteSelected$.next();
    };

    // Handle paste event
    const handlePaste = (event: ClipboardEvent) => {
      // Check for internal canvas items format first
      const canvasData = event.clipboardData?.getData("text/x-canvas-items");
      if (canvasData) {
        try {
          const items = JSON.parse(canvasData) as CanvasItem[];
          if (Array.isArray(items) && items.length > 0) {
            pasteItems$.next(items);
            return;
          }
        } catch { /* fall through to external paste */ }
      }

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

    // Card dialog template
    const cardDialog$ = combineLatest([openedCardId$, items$, dialogPrompt$, isRegenerating$]).pipe(
      map(([cardId, items, prompt, isRegenerating]) => {
        const card = cardId ? items.find((i) => i.id === cardId) : null;
        if (!card) return html``;

        return html`
          <div class="card-dialog-body">
            ${card.imageSrc
              ? html`<img class="card-dialog-image" src="${card.imageSrc}" alt="${card.title || "Image"}" />`
              : card.imagePrompt
                ? html`<generative-image class="card-dialog-gen-image" prompt="${card.imagePrompt}" width="512" height="512"></generative-image>`
                : html``}
            ${card.title ? html`<h3 class="card-dialog-title">${card.title}</h3>` : html``}
            ${card.body ? html`<p class="card-dialog-text">${card.body}</p>` : html``}
            <label>Image prompt</label>
            <textarea
              .value=${prompt}
              @input=${(e: Event) => dialogPrompt$.next((e.target as HTMLTextAreaElement).value)}
              placeholder="Describe image to generate..."
            ></textarea>
            <menu class="card-dialog-actions">
              <button ?disabled=${isRegenerating || !prompt.trim()} @click=${() => regenerate$.next(true)}>
                ${isRegenerating ? "Generating..." : "Regenerate"}
              </button>
              ${card.imageSrc ? html`<button @click=${() => downloadImage(card.imageSrc!)}>Download</button>` : html``}
              <button @click=${closeCardDialog}>Close</button>
            </menu>
          </div>
        `;
      }),
    );

    // Template
    const template$ = items$.pipe(
      map(
        (items) => html`
          <div
            class="canvas"
            data-canvas
            tabindex="0"
            @paste=${handlePaste}
            @copy=${handleCopy}
            @cut=${handleCut}
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
                        ? html`<generative-image prompt="${item.imagePrompt}" width="${item.width}" height="${item.width}"></generative-image>`
                        : html``}
                  </div>
                  <div class="card-text-area">
                    ${item.title ? html`<div class="card-title">${item.title}</div>` : html``}
                    ${item.body ? html`<div class="card-body">${item.body}</div>` : html``}
                  </div>
                  <button
                    class="card-open-button"
                    @mousedown=${(e: MouseEvent) => e.stopPropagation()}
                    @click=${(e: MouseEvent) => { e.stopPropagation(); openCard(item); }}
                  >Open</button>
                </div>
              `,
            )}
          </div>
          <dialog id="card-detail-dialog" @close=${() => openedCardId$.next(null)}>
            ${observe(cardDialog$)}
          </dialog>
        `,
      ),
    );

    // Combine template with effects
    return template$.pipe(
      mergeWith(
        pasteEffect$.pipe(ignoreElements()),
        pasteTextEffect$.pipe(ignoreElements()),
        pasteItemsEffect$.pipe(ignoreElements()),
        moveEffect$.pipe(ignoreElements()),
        deleteEffect$.pipe(ignoreElements()),
        updateCardEffect$.pipe(ignoreElements()),
        regenerateEffect$,
      ),
    );
  },
);
