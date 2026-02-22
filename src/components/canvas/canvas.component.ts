import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  fromEvent,
  ignoreElements,
  map,
  mergeWith,
  of,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { observe } from "../../sdk/observe-directive";
import type { ApiKeys } from "../connections/storage";
import { submitTask } from "../context-tray/tasks";
import { generateImage, type GeminiConnection } from "../design/generate-image-gemini";
import { enhancePrompt } from "./ai-helpers";
import "./canvas.component.css";
import { CardComponent } from "./card.component";
import {
  copyItemsToClipboard,
  parseItemsFromClipboardText,
  processClipboardPaste,
  serializeItemsForClipboardText,
} from "./clipboard";
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
  selectItemsInMarquee,
  updateDragPositions,
  type MarqueeRect,
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
  return !!item.body;
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
  (props: {
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    interaction$?: Subject<"start" | "end">;
  }) => {
    // Internal state
    const items$ = props.items$;

    const makeCardId = (prefix: string) => {
      const uuid = globalThis.crypto?.randomUUID?.();
      return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };

    // Helper: Get next z-index atomically
    const getNextZIndex = () => {
      const currentItems = props.items$.value;
      const maxZ = currentItems.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
      return maxZ + 1;
    };

    // Actions
    const pasteImage$ = new Subject<string>();
    const pasteImageFile$ = new Subject<File>();
    const pasteText$ = new Subject<string>();
    const pasteItems$ = new Subject<CanvasItem[]>();
    const moveItems$ = new Subject<{ moves: { id: string; x: number; y: number }[] }>();
    const deleteSelected$ = new Subject<void>();
    const updateCard$ = new Subject<{ id: string; updates: Partial<CanvasItem> }>();

    // Card dialog state
    const openedCardId$ = new BehaviorSubject<string | null>(null);
    const isRegenerating$ = new BehaviorSubject<boolean>(false);
    const regenerate$ = new Subject<{ cardId: string; prompt: string }>();
    const marquee$ = new BehaviorSubject<MarqueeRect | null>(null);

    // Effects
    const pasteEffect$ = pasteImage$.pipe(
      tap((src) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const cardId = makeCardId("img");

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
      }),
    );

    const pasteTextEffect$ = pasteText$.pipe(
      tap((text) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const cardId = makeCardId("text");

        const card: CanvasItem = {
          id: cardId,
          body: text,
          x: center.x - 100,
          y: center.y - 150,
          width: 200,
          height: 300,
          zIndex: getNextZIndex(),
        };
        props.items$.next([...props.items$.value, card]);
      }),
    );

    const pasteImageFileEffect$ = pasteImageFile$.pipe(
      tap((file) => {
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const cardId = makeCardId("img");

        const card: CanvasItem = {
          id: cardId,
          x: center.x - 100,
          y: center.y - 150,
          width: 200,
          height: 300,
          zIndex: getNextZIndex(),
        };
        props.items$.next([...props.items$.value, card]);

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const src = loadEvent.target?.result;
          if (typeof src === "string") {
            updateCard$.next({ id: cardId, updates: { imageSrc: src } });
          }
        };
        reader.readAsDataURL(file);
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
          id: makeCardId(`paste-${index}`),
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

    // Regenerate runs independently of dialog — user can close dialog and it still works
    const regenerateEffect$ = regenerate$.pipe(
      withLatestFrom(props.apiKeys$),
      tap(([{ cardId, prompt }, apiKeys]) => {
        if (!prompt.trim() || !apiKeys.gemini) return;

        isRegenerating$.next(true);
        const connection: GeminiConnection = { apiKey: apiKeys.gemini };

        const task$ = enhancePrompt(prompt, "User regeneration request", apiKeys.gemini).pipe(
          catchError(() => of(prompt)),
          switchMap((enhancedPrompt) =>
            generateImage(connection, { prompt: enhancedPrompt, width: 512, height: 512 }).pipe(
              tap((result) => {
                updateCard$.next({ id: cardId, updates: { imageSrc: result.url, imagePrompt: enhancedPrompt } });
                isRegenerating$.next(false);
              }),
              tap({ error: () => isRegenerating$.next(false) }),
            ),
          ),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    // Card dialog actions
    const openCard = (item: CanvasItem) => {
      openedCardId$.next(item.id);
      const dialog = document.getElementById("card-detail-dialog") as HTMLDialogElement | null;
      if (dialog && !dialog.open) dialog.showModal();
    };

    const closeCardDialog = () => {
      const dialog = document.getElementById("card-detail-dialog") as HTMLDialogElement | null;
      dialog?.close();
      openedCardId$.next(null);
    };

    const findItemById = (id: string) => props.items$.value.find((item) => item.id === id);

    const handleCardUpdate = (id: string, updates: Partial<CanvasItem>) => {
      updateCard$.next({ id, updates });
    };

    const handleCardOpen = (id: string) => {
      const item = findItemById(id);
      if (!item) return;
      openCard(item);
    };

    const handleCardMouseDown = (id: string, e: MouseEvent) => {
      const item = findItemById(id);
      if (!item) return;
      handleMouseDown(item, e);
    };

    const downloadImage = (src: string, title?: string) => {
      const name = (title || "canvas-image").replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
      const link = document.createElement("a");
      link.href = src;
      link.download = `${name}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // Drag handling — ignore clicks originating from the Open button
    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-card-open]")) return;
      e.stopPropagation();
      props.interaction$?.next("start");

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
      const selectedItems = selectionUpdate.items;

      // Check if the clicked item is selected after update
      const updatedItem = selectedItems.find((i) => i.id === item.id);

      if (!updatedItem?.isSelected) {
        props.items$.next(selectedItems);
        return;
      }

      // Bring the clicked item to the top (highest z-index)
      const nextZ = selectedItems.reduce((max, i) => Math.max(max, i.zIndex || 0), 0) + 1;
      const updatedItems = selectedItems.map((i) => (i.id === item.id ? { ...i, zIndex: nextZ } : i));
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
        props.interaction$?.next("end");

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

    // Handle canvas mousedown: start marquee selection or deselect all on direct click
    const handleCanvasMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!isCanvasDirectClick(e)) return;

      const { isCtrl, isShift } = getModifierKeys(e);
      const canvasEl = e.currentTarget as HTMLElement;
      const canvasRect = canvasEl.getBoundingClientRect();
      const startX = e.clientX - canvasRect.left;
      const startY = e.clientY - canvasRect.top;

      let hasMoved = false;

      props.interaction$?.next("start");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        hasMoved = true;
        const currentX = moveEvent.clientX - canvasRect.left;
        const currentY = moveEvent.clientY - canvasRect.top;
        marquee$.next({
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        props.interaction$?.next("end");

        const marquee = marquee$.value;
        if (hasMoved && marquee) {
          props.items$.next(selectItemsInMarquee(props.items$.value, marquee, isCtrl || isShift));
        } else {
          props.items$.next(deselectAll({ items: props.items$.value }).items);
        }
        marquee$.next(null);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Clipboard: copy
    const getSelectedItems = () => props.items$.value.filter((item) => item.isSelected);

    const writeSelectedItemsToClipboard = async () => {
      const selected = getSelectedItems();
      if (selected.length === 0) return false;

      if (!navigator.clipboard?.writeText) return false;

      await navigator.clipboard.writeText(serializeItemsForClipboardText(selected));
      return true;
    };

    const handleCopy = (event: ClipboardEvent) => {
      const selected = getSelectedItems();
      if (selected.length === 0) return;
      event.preventDefault();
      copyItemsToClipboard(event, selected);
    };

    // Clipboard: cut
    const handleCut = (event: ClipboardEvent) => {
      const selected = getSelectedItems();
      if (selected.length === 0) return;
      event.preventDefault();
      copyItemsToClipboard(event, selected);
      deleteSelected$.next();
    };

    // Handle paste event
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    };

    const handleParsedPasteData = (params: {
      event?: ClipboardEvent;
      clipboardItems?: DataTransferItemList;
      canvasItems?: CanvasItem[] | null;
      plainText?: string;
    }) => {
      let handled = false;

      if (params.canvasItems && params.canvasItems.length > 0) {
        params.event?.preventDefault();
        pasteItems$.next(params.canvasItems);
        return;
      }

      const clipboardItems = params.clipboardItems;
      if (clipboardItems) {
        for (let i = 0; i < clipboardItems.length; i++) {
          const clipboardItem = clipboardItems[i];
          if (clipboardItem.type.includes("image")) {
            const file = clipboardItem.getAsFile();
            if (file) {
              if (!handled) params.event?.preventDefault();
              handled = true;
              pasteImageFile$.next(file);
            }
          }
        }
      }

      const plainText = params.plainText?.trim();
      if (plainText) {
        if (!handled) params.event?.preventDefault();
        pasteText$.next(plainText);
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const canvasData = event.clipboardData?.getData("text/x-canvas-items");
      let canvasItemsFromCustomType: CanvasItem[] | null = null;

      if (canvasData) {
        try {
          const parsed = JSON.parse(canvasData) as CanvasItem[];
          if (Array.isArray(parsed)) canvasItemsFromCustomType = parsed;
        } catch {
          canvasItemsFromCustomType = null;
        }
      }

      const plainText = event.clipboardData?.getData("text/plain") || "";
      const canvasItemsFromText = parseItemsFromClipboardText(plainText);

      handleParsedPasteData({
        event,
        clipboardItems: event.clipboardData?.items,
        canvasItems: canvasItemsFromCustomType ?? canvasItemsFromText,
        plainText: canvasItemsFromText ? "" : plainText,
      });

      if (canvasItemsFromCustomType || canvasItemsFromText) return;

      processClipboardPaste(event, { includeImages: false }).subscribe((action) => {
        event.preventDefault();
        if (action.type === "image") pasteImage$.next(action.src);
        else pasteText$.next(action.content);
      });
    };

    const globalPasteEffect$ = fromEvent<ClipboardEvent>(document, "paste").pipe(
      tap((event) => handlePaste(event)),
      ignoreElements(),
    );

    // Handle keydown event for delete/backspace
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey;

      if (isMod && !isEditableTarget(event.target)) {
        const key = event.key.toLowerCase();

        if (key === "c") {
          event.preventDefault();
          void writeSelectedItemsToClipboard();
          return;
        }

        if (key === "x") {
          event.preventDefault();
          void writeSelectedItemsToClipboard().then((didWrite) => {
            if (didWrite) deleteSelected$.next();
          });
          return;
        }

        if (key === "v" && navigator.clipboard?.readText) {
          event.preventDefault();
          void navigator.clipboard.readText().then((text) => {
            const canvasItems = parseItemsFromClipboardText(text);
            handleParsedPasteData({
              canvasItems,
              plainText: canvasItems ? "" : text,
            });
          });
          return;
        }

        if (key === "a") {
          event.preventDefault();
          props.items$.next(props.items$.value.map((item) => ({ ...item, isSelected: true })));
          return;
        }
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !isEditableTarget(event.target)) {
        const hasSelected = props.items$.value.some((item) => item.isSelected);
        if (hasSelected) {
          event.preventDefault();
          deleteSelected$.next();
        }
      }
    };

    const globalKeydownEffect$ = fromEvent<KeyboardEvent>(document, "keydown").pipe(
      tap((event) => handleKeyDown(event)),
      ignoreElements(),
    );

    // Card dialog template — editable fields, image on left, text on right
    const cardDialog$ = combineLatest([openedCardId$, items$, isRegenerating$]).pipe(
      map(([cardId, items, isRegenerating]) => {
        const card = cardId ? items.find((i) => i.id === cardId) : null;
        if (!card) return html``;

        const handleFieldUpdate = (field: keyof CanvasItem, value: string) => {
          updateCard$.next({ id: card.id, updates: { [field]: value } });
        };

        return html`
          <div class="card-dialog-body">
            <div class="card-dialog-layout">
              <div class="card-dialog-image-col">
                ${card.imageSrc
                  ? html`<img class="card-dialog-image" src="${card.imageSrc}" alt="${card.title || "Image"}" />`
                  : card.imagePrompt
                    ? html`<generative-image
                        class="card-dialog-gen-image"
                        prompt="${card.imagePrompt}"
                        width="512"
                        height="512"
                        @image-loaded=${(e: CustomEvent) =>
                          updateCard$.next({ id: card.id, updates: { imageSrc: e.detail.url } })}
                      ></generative-image>`
                    : html`<div class="card-dialog-placeholder">No image</div>`}
              </div>
              <div class="card-dialog-info-col">
                <label>Title</label>
                <input
                  type="text"
                  .value=${card.title || ""}
                  @input=${(e: Event) => handleFieldUpdate("title", (e.target as HTMLInputElement).value)}
                  placeholder="Untitled"
                />
                <label>Body</label>
                <textarea
                  .value=${card.body || ""}
                  @input=${(e: Event) => handleFieldUpdate("body", (e.target as HTMLTextAreaElement).value)}
                  placeholder="No description"
                ></textarea>
                <label>Image prompt</label>
                <textarea
                  .value=${card.imagePrompt || ""}
                  @input=${(e: Event) => handleFieldUpdate("imagePrompt", (e.target as HTMLTextAreaElement).value)}
                  placeholder="Describe image to generate..."
                ></textarea>
                <menu class="card-dialog-actions">
                  <button
                    ?disabled=${isRegenerating || !(card.imagePrompt || "").trim()}
                    @click=${() => regenerate$.next({ cardId: card.id, prompt: card.imagePrompt || "" })}
                  >
                    ${isRegenerating ? "Generating..." : "Regenerate"}
                  </button>
                  ${card.imageSrc
                    ? html`<button @click=${() => downloadImage(card.imageSrc!, card.title)}>Download</button>`
                    : html``}
                  <button @click=${closeCardDialog}>Close</button>
                </menu>
              </div>
            </div>
          </div>
        `;
      }),
    );

    // Close dialog when clicking outside (non-modal behavior)
    const handleDialogClick = (e: MouseEvent) => {
      const dialog = e.currentTarget as HTMLDialogElement;
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        closeCardDialog();
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
            @copy=${handleCopy}
            @cut=${handleCut}
            @mousedown=${handleCanvasMouseDown}
          >
            ${repeat(
              items,
              (item) => item.id,
              (item) =>
                CardComponent({
                  id: item.id,
                  items$: props.items$,
                  apiKeys$: props.apiKeys$,
                  onUpdate: handleCardUpdate,
                  onOpen: handleCardOpen,
                  onMouseDown: handleCardMouseDown,
                }),
            )}
            ${observe(
              marquee$.pipe(
                map((r) =>
                  r
                    ? html`<div
                        class="canvas-marquee"
                        style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;"
                      ></div>`
                    : html``,
                ),
              ),
            )}
          </div>
          <dialog id="card-detail-dialog" @click=${handleDialogClick} @close=${() => openedCardId$.next(null)}>
            ${observe(cardDialog$)}
          </dialog>
        `,
      ),
    );

    // Combine template with effects
    return template$.pipe(
      mergeWith(
        pasteEffect$.pipe(ignoreElements()),
        pasteImageFileEffect$.pipe(ignoreElements()),
        pasteTextEffect$.pipe(ignoreElements()),
        pasteItemsEffect$.pipe(ignoreElements()),
        moveEffect$.pipe(ignoreElements()),
        deleteEffect$.pipe(ignoreElements()),
        updateCardEffect$.pipe(ignoreElements()),
        regenerateEffect$,
        globalPasteEffect$,
        globalKeydownEffect$,
      ),
    );
  },
);
