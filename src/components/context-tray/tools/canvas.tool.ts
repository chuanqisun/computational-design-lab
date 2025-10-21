import { html } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";

export const CanvasTool = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  const clearAll = () => {
    items$.next([]);
  };

  return items$.pipe(
    map(() => {
      return html`<button @click=${clearAll}>Clear all</button>`;
    }),
  );
});
