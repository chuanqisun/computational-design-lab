import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { hasImage, hasText, type CanvasItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { CanvasTool } from "./tools/canvas.tool";
import { CaptureTool } from "./tools/capture.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan.tool";
import { DesignTool } from "./tools/design.tool";
import { FileTool } from "./tools/file.tool";
import { RenderTool } from "./tools/render.tool";
import { TextContentTool } from "./tools/text-content.tool";
import { UserTestingTool } from "./tools/user-testing.tool";
import { VisualizeTool } from "./tools/visualize.tool";
import { WriterTool } from "./tools/writer.tool";

export const ContextTrayComponent = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const selected$ = items$.pipe(map((items) => items.filter((item) => item.isSelected)));
    const selectedWithImage$ = selected$.pipe(map((items) => items.filter(hasImage)));
    const selectedWithText$ = selected$.pipe(map((items) => items.filter(hasText)));

    const conceptualScanUI = ConceptualScanTool({ selected$, items$, apiKeys$ });
    const designToolUI = DesignTool({ selected$, items$, apiKeys$ });
    const textContentUI = TextContentTool({ selected$, items$ });
    const visualizeUI = VisualizeTool({ selectedWithText$, items$, apiKeys$ });
    const blendToolUI = BlendTool({ selected$, items$, apiKeys$ });
    const userTestingUI = UserTestingTool({ selected$, items$, apiKeys$ });
    const downloadToolTUI = FileTool({ selectedWithImage$ });
    const renderToolUI = RenderTool({ selected$, items$, apiKeys$ });
    const writerToolUI = WriterTool({ items$, apiKeys$ });
    const captureToolUI = CaptureTool({ items$ });
    const canvasToolUI = CanvasTool({ items$ });

    const template$ = combineLatest([selected$, selectedWithImage$, selectedWithText$]).pipe(
      map(([selected, selectedWithImage, selectedWithText]) => {
        const totalSelected = selected.length;

        return html`<aside class="context-tray">
          <p>${totalSelected} selected</p>
          <details class="tool-container" open>
            <summary>New</summary>
            <div class="tool-body">${captureToolUI}</div>
            <div class="tool-body">${renderToolUI}</div>
            <div class="tool-body">${writerToolUI}</div>
          </details>
          ${totalSelected > 0
            ? html` <details class="tool-container" open>
                  <summary>Design</summary>
                  <div class="tool-body">${designToolUI}</div>
                </details>
                <details class="tool-container" open>
                  <summary>Scan</summary>
                  <div class="tool-body">${conceptualScanUI}</div>
                </details>
                <details class="tool-container" open>
                  <summary>User testing</summary>
                  <div class="tool-body">${userTestingUI}</div>
                </details>`
            : nothing}
          ${totalSelected > 1
            ? html`<details class="tool-container" open>
                <summary>Blend Tool</summary>
                <div class="tool-body">${blendToolUI}</div>
              </details>`
            : nothing}
          ${selectedWithText.length > 0
            ? html`<details class="tool-container" open>
                <summary>Visualize</summary>
                <div class="tool-body">${visualizeUI}</div>
              </details>`
            : nothing}
          ${totalSelected > 0
            ? html`<details class="tool-container" open>
                <summary>Card Content</summary>
                <div class="tool-body">${textContentUI}</div>
              </details>`
            : nothing}
          ${selectedWithImage.length === 1
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
