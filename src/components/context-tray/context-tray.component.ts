import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { CanvasTool } from "./tools/canvas.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan";
import { FileTool } from "./tools/file.tool";
import { MoodScanTool } from "./tools/mood-scan.tool";
import { RenderTool } from "./tools/render.tool";
import { TextContentTool } from "./tools/text-content.tool";
import { VisualizeTool } from "./tools/visualize.tool";
import { WriterTool } from "./tools/writer.tool";

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
    const moodScanUI = MoodScanTool({ selectedImages$, items$, apiKeys$ });
    const downloadToolTUI = FileTool({ selectedImages$ });
    const renderToolUI = RenderTool({ selectedTexts$, selectedImages$, items$, apiKeys$ });
    const writerToolUI = WriterTool({ items$, apiKeys$ });
    const canvasToolUI = CanvasTool({ items$ });

    const template$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([selectedImages, selectedTexts]) => {
        const totalSelected = selectedImages.length + selectedTexts.length;

        return html`<aside class="context-tray">
          <p>${totalSelected} selected</p>
          <details class="tool-container" open>
            <summary>New</summary>
            <div class="tool-body">${renderToolUI}</div>
            <div class="tool-body">${writerToolUI}</div>
          </details>
          ${selectedImages.length > 0
            ? html` <details class="tool-container" open>
                  <summary>Conceptual Scan</summary>
                  <div class="tool-body">${conceptualScanUI}</div>
                </details>
                <details class="tool-container" open>
                  <summary>Mood Scan</summary>
                  <div class="tool-body">${moodScanUI}</div>
                </details>`
            : nothing}
          ${selectedImages.length > 1
            ? html`<details class="tool-container" open>
                <summary>Blend Tool</summary>
                <div class="tool-body">${blendToolUI}</div>
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
          ${selectedImages.length === 1
            ? html`<details class="tool-container" open>
                <summary>File</summary>
                <div class="tool-body">${downloadToolTUI}</div>
              </details>`
            : nothing}
          <details class="tool-container" open>
            <summary>Canvas</summary>
            <div class="tool-body">${canvasToolUI}</div>
          </details>
        </aside>`;
      }),
    );

    return template$;
  },
);
