import { html } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { focusSelectedItems, gatherItemsIntoViewport } from "../../canvas/layout";

export const CanvasTool = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  const gatherItems = () => {
    const canvasArea = document.querySelector(".canvas-area") as HTMLElement;
    if (!canvasArea) return;

    const viewport = {
      width: canvasArea.clientWidth,
      height: canvasArea.clientHeight,
      scrollX: canvasArea.scrollLeft,
      scrollY: canvasArea.scrollTop,
    };

    const moves = gatherItemsIntoViewport(items$.value, viewport);

    if (moves.length > 0) {
      const currentItems = items$.value;
      const updatedItems = currentItems.map((item) => {
        const move = moves.find((m) => m.id === item.id);
        return move ? { ...item, x: move.x, y: move.y } : item;
      });
      items$.next(updatedItems);
    }
  };

  const focusSelected = () => {
    const canvasArea = document.querySelector(".canvas-area") as HTMLElement;
    if (!canvasArea) return;

    const viewport = {
      width: canvasArea.clientWidth,
      height: canvasArea.clientHeight,
      scrollX: canvasArea.scrollLeft,
      scrollY: canvasArea.scrollTop,
    };

    const moves = focusSelectedItems(items$.value, viewport);

    if (moves.length > 0) {
      const currentItems = items$.value;
      const updatedItems = currentItems.map((item) => {
        const move = moves.find((m) => m.id === item.id);
        return move ? { ...item, x: move.x, y: move.y } : item;
      });
      items$.next(updatedItems);
    }
  };

  const clearAll = () => {
    items$.next([]);
  };

  return items$.pipe(
    map((items) => {
      const hasSelection = items.some((item) => item.isSelected);

      return html`
        <button @click=${gatherItems}>Gather</button>
        <button @click=${focusSelected} ?disabled=${!hasSelection}>Focus</button>
        <button @click=${clearAll}>Destroy</button>
      `;
    }),
  );
});
