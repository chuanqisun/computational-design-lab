import { html } from "lit-html";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { BlendTool } from "./blend.tool";
import { DownloadTool } from "./download.tool";

export const ImageTools = createComponent(
  ({
    selectedImages$,
    items$,
    apiKeys$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    return selectedImages$.pipe(
      map((selectedImages) => {
        if (selectedImages.length === 1) {
          return DownloadTool({ selectedImages$ });
        } else if (selectedImages.length >= 2) {
          return BlendTool({ selectedImages$, items$, apiKeys$ });
        } else {
          return html``;
        }
      }),
    );
  },
);
