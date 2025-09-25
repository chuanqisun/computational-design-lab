import { html } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan";
import { DownloadTool } from "./tools/download.tool";

export const ContextTrayComponent = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    // Derive images and texts from unified items
    const images$ = items$.pipe(
      map((items) => items.filter((item): item is ImageItem => item.type === "image") as ImageItem[]),
    );

    const texts$ = items$.pipe(
      map((items) => items.filter((item): item is TextItem => item.type === "text") as TextItem[]),
    );

    // Create streams for selected items
    const selectedImages$ = images$.pipe(map((images) => images.filter((img: ImageItem) => img.isSelected)));

    const selectedTexts$ = texts$.pipe(map((texts) => texts.filter((txt: TextItem) => txt.isSelected)));

    // Create the conceptual scan tool with stream props (rendered once)
    const conceptualScanUI = ConceptualScanTool({
      selectedImages$,
      selectedTexts$,
      items$,
      apiKeys$,
    });

    const template$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([selectedImages, selectedTexts]) => {
        const totalSelected = selectedImages.length + selectedTexts.length;

        if (totalSelected === 0) return html``;

        const imageToolUI =
          selectedImages.length === 1
            ? DownloadTool({ selectedImages })
            : selectedImages.length >= 2
              ? BlendTool({ selectedImages, items$, apiKeys$ })
              : html``;

        const conceptualScanUITemplate = conceptualScanUI;

        const textContentUI =
          selectedTexts.length > 0
            ? html`
                <div class="text-content-section">
                  <h3>Text Content</h3>
                  ${selectedTexts.map(
                    (txt: TextItem) => html`
                      <div class="text-item-content">
                        <h4>${txt.title}</h4>
                        <div class="text-content">${txt.content}</div>
                      </div>
                    `,
                  )}
                </div>
              `
            : html``;

        return html`<aside class="context-tray">
          <p>${totalSelected === 1 ? `1 item` : `${totalSelected} items`}</p>
          ${conceptualScanUITemplate} ${imageToolUI} ${textContentUI}
        </aside>`;
      }),
    );

    return template$;
  },
);
