import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan";
import { DownloadTool } from "./tools/download.tool";
import { TextContentTool } from "./tools/text-content.tool";
import { VisualizeTool } from "./tools/visualize.tool";

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

    const conceptualScanUI = ConceptualScanTool({ selectedImages$, selectedTexts$, items$, apiKeys$ });
    const textContentUI = TextContentTool({ selectedTexts$ });
    const visualizeUI = VisualizeTool({ selectedTexts$, items$, apiKeys$ });
    const blendToolUI = BlendTool({ selectedImages$, items$, apiKeys$ });
    const downloadToolTUI = DownloadTool({ selectedImages$ });

    const template$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([selectedImages, selectedTexts]) => {
        const totalSelected = selectedImages.length + selectedTexts.length;

        return html`<aside class="context-tray">
          <p>${totalSelected === 1 ? `1 item` : `${totalSelected} items`}</p>
          ${selectedImages.length > 0
            ? html` <details class="tool-container" open>
                <summary>Conceptual Scan</summary>
                <div class="tool-body">${conceptualScanUI}</div>
              </details>`
            : nothing}
          ${selectedImages.length > 1
            ? html`<details class="tool-container" open>
                <summary>Blend Tool</summary>
                <div class="tool-body">${blendToolUI}</div>
              </details>`
            : nothing}
          ${selectedImages.length === 1
            ? html`<details class="tool-container" open>
                <summary>Download</summary>
                <div class="tool-body">${downloadToolTUI}</div>
              </details>`
            : nothing}
          ${selectedTexts.length > 0
            ? html`<details class="tool-container" open>
                  <summary>Text Content</summary>
                  <div class="tool-body">${textContentUI}</div>
                </details>
                <details class="tool-container" open>
                  <summary>Visualize</summary>
                  <div class="tool-body">${visualizeUI}</div>
                </details>`
            : nothing}
        </aside>`;
      }),
    );

    return template$;
  },
);
