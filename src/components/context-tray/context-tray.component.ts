import { html } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { ConceptualScanTool } from "./tools/conceptual-scan";
import { ImageTools } from "./tools/image-tools";
import { TextContentTool } from "./tools/text-content.tool";

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

    // Create image tools
    const imageToolsUI = ImageTools({
      selectedImages$,
      items$,
      apiKeys$,
    });

    // Create text content tool
    const textContentUI = TextContentTool({
      selectedTexts$,
    });

    const template$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([selectedImages, selectedTexts]) => {
        const totalSelected = selectedImages.length + selectedTexts.length;

        if (totalSelected === 0) return html``;

        return html`<aside class="context-tray">
          <p>${totalSelected === 1 ? `1 item` : `${totalSelected} items`}</p>
          <details class="tool-container" open>
            <summary>Conceptual Scan</summary>
            <div class="tool-body">${conceptualScanUI}</div>
          </details>
          ${selectedImages.length > 0
            ? html`<details class="tool-container" open>
                <summary>Image Tools</summary>
                <div class="tool-body">${imageToolsUI}</div>
              </details>`
            : ""}
          ${selectedTexts.length > 0
            ? html`<details class="tool-container" open>
                <summary>Text Content</summary>
                <div class="tool-body">${textContentUI}</div>
              </details>`
            : ""}
        </aside>`;
      }),
    );

    return template$;
  },
);
