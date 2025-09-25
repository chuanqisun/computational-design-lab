import { html } from "lit-html";
import { BehaviorSubject, Subject, combineLatest, ignoreElements, map, mergeWith, tap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import "./canvas.component.css";

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
      map((text) => {
        const newText: TextItem = {
          id: `text-${Date.now()}`,
          title: "Text",
          content: text,
          x: Math.random() * 400,
          y: Math.random() * 400,
          width: 200,
          height: 200,
          zIndex: ++zSeq,
        };
        props.texts$.next([...props.texts$.value, newText]);
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

    const handleMouseDown = (item: CanvasItem, e: MouseEvent) => {
      e.stopPropagation(); // Prevent canvas click when clicking on item

      const isCtrlPressed = e.ctrlKey || e.metaKey;
      const isShiftPressed = e.shiftKey;
      const currentImages = props.images$.value;
      const currentTexts = props.texts$.value;

      // Handle selection logic based on item type
      const isAlreadySelected = item.isSelected;
      let updatedImages: ImageItem[] = currentImages;
      let updatedTexts: TextItem[] = currentTexts;

      if (item.type === "image") {
        if (isCtrlPressed || isShiftPressed) {
          // Toggle selection for multi-select
          updatedImages = currentImages.map((img) =>
            img.id === item.id ? { ...img, isSelected: !img.isSelected } : img,
          );
        } else if (!isAlreadySelected) {
          // Single select - deselect all others, select this one
          updatedImages = currentImages.map((img) => ({
            ...img,
            isSelected: img.id === item.id,
          }));
        }
        // Deselect texts when selecting images
        updatedTexts = currentTexts.map((txt) => ({ ...txt, isSelected: false }));
      } else if (item.type === "text") {
        if (isCtrlPressed || isShiftPressed) {
          // Toggle selection for multi-select
          updatedTexts = currentTexts.map((txt) =>
            txt.id === item.id ? { ...txt, isSelected: !txt.isSelected } : txt,
          );
        } else if (!isAlreadySelected) {
          // Single select - deselect all others, select this one
          updatedTexts = currentTexts.map((txt) => ({
            ...txt,
            isSelected: txt.id === item.id,
          }));
        }
        // Deselect images when selecting texts
        updatedImages = currentImages.map((img) => ({ ...img, isSelected: false }));
      }

      props.images$.next(updatedImages);
      props.texts$.next(updatedTexts);

      // Check if the clicked item is selected after update
      const updatedItem =
        item.type === "image"
          ? updatedImages.find((img) => img.id === item.id)
          : updatedTexts.find((txt) => txt.id === item.id);

      if (!updatedItem?.isSelected) return;

      // Bring the clicked item to the top
      if (item.type === "image") {
        const index = updatedImages.findIndex((img) => img.id === item.id);
        if (index !== -1) {
          updatedImages[index] = { ...updatedImages[index], zIndex: ++zSeq };
          props.images$.next([...updatedImages]);
        }
      } else {
        const index = updatedTexts.findIndex((txt) => txt.id === item.id);
        if (index !== -1) {
          updatedTexts[index] = { ...updatedTexts[index], zIndex: ++zSeq };
          props.texts$.next([...updatedTexts]);
        }
      }

      // Get all selected items to drag
      const selectedImages = updatedImages.filter((img) => img.isSelected);
      const selectedTexts = updatedTexts.filter((txt) => txt.isSelected);
      const allSelectedItems = [...selectedImages, ...selectedTexts];

      const canvas = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
      const draggedData = allSelectedItems.map((dragItem) => {
        const cssClass = dragItem.id.startsWith("img-") ? "canvas-image" : "canvas-text";
        const el = canvas.querySelector(`.${cssClass}[data-id="${dragItem.id}"]`) as HTMLElement;
        const offsetX = e.clientX - dragItem.x;
        const offsetY = e.clientY - dragItem.y;
        el.style.zIndex = String(++zSeq);
        return { el, offsetX, offsetY, item: dragItem };
      });

      // Bring the clicked item to the top
      (e.currentTarget as HTMLElement).style.zIndex = String(++zSeq);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        draggedData.forEach(({ el, offsetX, offsetY }) => {
          const x = moveEvent.clientX - offsetX;
          const y = moveEvent.clientY - offsetY;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const newPositions = draggedData.map(({ el, item: dragItem }) => {
          const x = parseFloat(el.style.left || "0");
          const y = parseFloat(el.style.top || "0");
          return { id: dragItem.id, x, y };
        });
        moveItems$.next({ moves: newPositions });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Handle canvas click to deselect all
    const handleCanvasClick = (e: MouseEvent) => {
      // Only deselect if clicking directly on canvas (not on an image)
      if (e.target === e.currentTarget) {
        const currentImages = props.images$.value;
        const updatedImages = currentImages.map((img) => ({ ...img, isSelected: false }));
        props.images$.next(updatedImages);
        const currentTexts = props.texts$.value;
        const updatedTexts = currentTexts.map((txt) => ({ ...txt, isSelected: false }));
        props.texts$.next(updatedTexts);
      }
    };

    // Handle paste event
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              pasteImage$.next(src);
            };
            reader.readAsDataURL(file);
          }
        }
      }

      const textPlain = event.clipboardData?.getData("text/plain");
      if (textPlain && textPlain.trim()) {
        pasteText$.next(textPlain);
      } else {
        const textHtml = event.clipboardData?.getData("text/html");
        if (textHtml) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(textHtml, "text/html");
          const text = doc.body.textContent || "";
          if (text && text.trim()) {
            pasteText$.next(text);
          }
        }
      }
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
                    style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex || 0};"
                    @mousedown=${(e: MouseEvent) => handleMouseDown(item, e)}
                  >
                    <div class="text-title"></div>${item.title}</div>
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
      ),
    );
  },
);
