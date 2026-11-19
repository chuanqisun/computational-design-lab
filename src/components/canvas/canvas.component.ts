import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, Subject, combineLatest, fromEvent, ignoreElements, map, mergeWith, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { observe } from "../../sdk/observe-directive";
import type { ApiKeys } from "../connections/storage";
import { getActionRuntime, runUserAction } from "../../lib/actions/app-runtime";
import "./canvas.component.css";
import { CardComponent } from "./card.component";
import {
  copyItemsToClipboard,
  parseItemsFromClipboardText,
  processClipboardPaste,
  serializeItemsForClipboardText,
} from "./clipboard";
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
  videoSrc?: string;
  videoMimeType?: string;
  videoPosterSrc?: string;
  metadata?: Record<string, any> & {
    /** Epoch ms when an action added this card (absent on cards from older boards). */
    createdAt?: number;
    /** The action run that added this card; cards sharing a runId were created together. */
    createdBy?: CardOrigin;
  };
}

export interface CardOrigin {
  runId: string;
  action: string;
  actor: "user" | "ai";
}

export function hasImage(item: CanvasItem): boolean {
  return !!(item.imageSrc || item.imagePrompt);
}

export function hasVideo(item: CanvasItem): boolean {
  return !!item.videoSrc;
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

    // All board changes go through the shared action layer (same path as the AI agent).
    const runtime = getActionRuntime(props.items$, props.apiKeys$);
    const act = (name: string, args: Record<string, unknown> = {}) => runUserAction(runtime, name, args);
    const selectedIdsOf = (items: CanvasItem[]) => items.filter((item) => item.isSelected).map((item) => item.id);
    const selectExactly = (items: CanvasItem[]) =>
      act("select_cards", { cardIds: selectedIdsOf(items), mode: "replace" });

    // Card dialog state
    const openedCardId$ = new BehaviorSubject<string | null>(null);
    const marquee$ = new BehaviorSubject<MarqueeRect | null>(null);
    /** While marquee-dragging: the ids that would be selected on release (null when not dragging). */
    const selectionPreview$ = new BehaviorSubject<ReadonlySet<string> | null>(null);

    // Pan state
    let isSpaceHeld = false;

    const setPanMode = (active: boolean) => {
      isSpaceHeld = active;
      const canvasEl = document.querySelector("[data-canvas]") as HTMLElement;
      if (canvasEl) canvasEl.classList.toggle("panning", active);
    };

    const startPanning = (e: MouseEvent) => {
      const scrollContainer = document.querySelector(".canvas-area") as HTMLElement;
      if (!scrollContainer) return;

      const canvasEl = document.querySelector("[data-canvas]") as HTMLElement;
      canvasEl?.classList.add("panning-active");

      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = scrollContainer.scrollLeft;
      const startScrollTop = scrollContainer.scrollTop;

      props.interaction$?.next("start");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        scrollContainer.scrollLeft = startScrollLeft - (moveEvent.clientX - startX);
        scrollContainer.scrollTop = startScrollTop - (moveEvent.clientY - startY);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        canvasEl?.classList.remove("panning-active");
        props.interaction$?.next("end");
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unreadable file"));
        reader.onerror = () => reject(new Error("Unreadable file"));
        reader.readAsDataURL(file);
      });

    const pasteImageSrc = (src: string) => act("add_media", { _media: [{ kind: "image", src }] });
    const pasteImageFile = (file: File) => {
      void readFileAsDataUrl(file).then(pasteImageSrc, (error) => console.error("Paste image failed", error));
    };
    const pasteText = (text: string) => act("add_card", { text });
    const pasteItems = (pastedItems: CanvasItem[]) => {
      const existing = new Set(props.items$.value.map((item) => item.id));
      if (pastedItems.every((item) => existing.has(item.id))) {
        act("duplicate_cards", { cardIds: pastedItems.map((item) => item.id) });
      } else {
        act("add_media", { _items: pastedItems });
      }
    };
    const deleteSelected = () => {
      const cardIds = selectedIdsOf(props.items$.value);
      if (cardIds.length) act("delete_cards", { cardIds });
    };

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

    /** Presentation-only update: a legacy <generative-image> finished rendering a card's stored prompt. */
    const handleCardUpdate = (id: string, updates: Partial<CanvasItem>) => {
      props.items$.next(props.items$.value.map((item) => (item.id === id ? { ...item, ...updates } : item)));
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

    // Drag handling — ignore clicks originating from card controls
    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      if (e.button !== 0) return;

      if (isSpaceHeld) {
        e.stopPropagation();
        startPanning(e);
        return;
      }

      if ((e.target as HTMLElement).closest("[data-card-open], [data-card-video-control]")) return;
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

      selectExactly(selectedItems);
      if (!updatedItem?.isSelected) return;

      // Bring the clicked item to the top (presentation-only stacking order)
      const nextZ = props.items$.value.reduce((max, i) => Math.max(max, i.zIndex || 0), 0) + 1;
      const updatedItems = props.items$.value.map((i) => (i.id === item.id ? { ...i, zIndex: nextZ } : i));
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
          act("move_cards", { moves: calculateFinalPositions(draggedData) });
        } else if (analysis.shouldDeferSingleSelect) {
          // If we didn't move and should switch to single selection, do it now
          selectExactly(applySingleSelection(props.items$.value, item.id));
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Handle canvas mousedown: panning (space held) or marquee selection
    const handleCanvasMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (isSpaceHeld) {
        startPanning(e);
        return;
      }

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
        const rect = {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
        };
        marquee$.next(rect);
        const preview = selectItemsInMarquee(props.items$.value, rect, isCtrl || isShift);
        selectionPreview$.next(new Set(preview.filter((item) => item.isSelected).map((item) => item.id)));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        props.interaction$?.next("end");

        const marquee = marquee$.value;
        if (hasMoved && marquee) {
          selectExactly(selectItemsInMarquee(props.items$.value, marquee, isCtrl || isShift));
        } else if (props.items$.value.some((candidate) => candidate.isSelected)) {
          selectExactly(deselectAll({ items: props.items$.value }).items);
        }
        marquee$.next(null);
        selectionPreview$.next(null);
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
      deleteSelected();
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
        pasteItems(params.canvasItems);
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
              pasteImageFile(file);
            }
          }
        }
      }

      const plainText = params.plainText?.trim();
      if (plainText) {
        if (!handled) params.event?.preventDefault();
        pasteText(plainText);
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
        if (action.type === "image") pasteImageSrc(action.src);
        else pasteText(action.content);
      });
    };

    const globalPasteEffect$ = fromEvent<ClipboardEvent>(document, "paste").pipe(
      tap((event) => handlePaste(event)),
      ignoreElements(),
    );

    // Handle keydown event for delete/backspace and space (pan mode)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " && !isEditableTarget(event.target)) {
        event.preventDefault();
        if (!event.repeat) setPanMode(true);
        return;
      }

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
            if (didWrite) deleteSelected();
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
          act("select_cards", { mode: "all" });
          return;
        }
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !isEditableTarget(event.target)) {
        const hasSelected = props.items$.value.some((item) => item.isSelected);
        if (hasSelected) {
          event.preventDefault();
          deleteSelected();
        }
      }
    };

    const globalKeydownEffect$ = fromEvent<KeyboardEvent>(document, "keydown").pipe(
      tap((event) => handleKeyDown(event)),
      ignoreElements(),
    );

    const globalKeyupEffect$ = fromEvent<KeyboardEvent>(document, "keyup").pipe(
      tap((event) => {
        if (event.key === " ") setPanMode(false);
      }),
      ignoreElements(),
    );

    const globalBlurEffect$ = fromEvent(window, "blur").pipe(
      tap(() => setPanMode(false)),
      ignoreElements(),
    );

    // Card dialog template — editable fields, image on left, text on right
    const cardDialog$ = combineLatest([openedCardId$, items$]).pipe(
      map(([cardId, items]) => {
        const card = cardId ? items.find((i) => i.id === cardId) : null;
        if (!card) return html``;
        const isRegenerating = card.metadata?.pending === "image";

        // Commit on change (blur), so the log records one edit_card per field edit, not per keystroke.
        const handleFieldUpdate = (field: "title" | "body" | "imagePrompt", value: string) => {
          if ((card[field] ?? "") === value) return;
          act("edit_card", { cardId: card.id, [field]: value });
        };

        return html`
          <div class="card-dialog-body">
            <div class="card-dialog-layout">
              <div class="card-dialog-image-col">
                ${
                  card.videoSrc
                    ? html`<video
                        class="card-dialog-video"
                        src="${card.videoSrc}"
                        poster="${card.videoPosterSrc || ""}"
                        controls
                        playsinline
                        preload="metadata"
                      ></video>`
                    : html``
                }
                ${
                  card.imageSrc
                    ? html`<img class="card-dialog-image" src="${card.imageSrc}" alt="${card.title || "Image"}" />`
                    : card.imagePrompt
                      ? html`<generative-image
                          class="card-dialog-gen-image"
                          prompt="${card.imagePrompt}"
                          width="512"
                          height="512"
                          @image-loaded=${(e: CustomEvent) => handleCardUpdate(card.id, { imageSrc: e.detail.url })}
                        ></generative-image>`
                      : card.videoSrc
                        ? html``
                        : html`<div class="card-dialog-placeholder">No media</div>`
                }
              </div>
              <div class="card-dialog-info-col">
                <label>Title</label>
                <input
                  type="text"
                  .value=${card.title || ""}
                  @change=${(e: Event) => handleFieldUpdate("title", (e.target as HTMLInputElement).value)}
                  placeholder="Untitled"
                />
                <label>Body</label>
                <textarea
                  .value=${card.body || ""}
                  @change=${(e: Event) => handleFieldUpdate("body", (e.target as HTMLTextAreaElement).value)}
                  placeholder="No description"
                ></textarea>
                <label>Image prompt</label>
                <textarea
                  .value=${card.imagePrompt || ""}
                  @change=${(e: Event) => handleFieldUpdate("imagePrompt", (e.target as HTMLTextAreaElement).value)}
                  placeholder="Describe image to generate..."
                ></textarea>
                <menu class="card-dialog-actions">
                  <button
                    ?disabled=${isRegenerating || !(card.imagePrompt || "").trim()}
                    @click=${() => act("regenerate_image", { cardId: card.id })}
                  >
                    ${isRegenerating ? "Generating..." : "Regenerate"}
                  </button>
                  ${
                    card.imageSrc
                      ? html`<button @click=${() => downloadImage(card.imageSrc!, card.title)}>Download</button>`
                      : html``
                  }
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
                  selectionPreview$,
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
    return template$.pipe(mergeWith(globalPasteEffect$, globalKeydownEffect$, globalKeyupEffect$, globalBlurEffect$));
  },
);
