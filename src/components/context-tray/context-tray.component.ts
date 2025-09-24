import { html } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ImageItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { DownloadTool } from "./tools/download.tool";

export const ContextTrayComponent = createComponent(
  ({ images$, apiKeys$ }: { images$: BehaviorSubject<ImageItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const template$ = images$.pipe(
      map((images) => {
        const selected = images.filter((img) => img.isSelected);
        if (selected.length === 0) return html``;

        const toolUI =
          selected.length === 1
            ? DownloadTool({ selectedImages: selected })
            : selected.length >= 2
              ? BlendTool({ selectedImages: selected, images$, apiKeys$ })
              : html``;

        return html`<aside class="context-tray">
          <p>${selected.length === 1 ? `Caption: ${selected[0].caption}` : `${selected.length} items`}</p>
          ${toolUI}
        </aside>`;
      }),
    );

    return template$;
  },
);
