import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { hasText, type CanvasItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { BlendTool } from "./tools/blend.tool";
import { CanvasTool } from "./tools/canvas.tool";
import { CaptureTool } from "./tools/capture.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan.tool";
import { DesignTool } from "./tools/design.tool";
import { RenderTool } from "./tools/render.tool";
import { UserTestingTool } from "./tools/user-testing.tool";
import { VisualizeTool } from "./tools/visualize.tool";
import { WriterTool } from "./tools/writer.tool";

export const ContextTrayComponent = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const selected$ = items$.pipe(map((items) => items.filter((item) => item.isSelected)));
    const selectedWithText$ = selected$.pipe(map((items) => items.filter(hasText)));

    const conceptualScanUI = ConceptualScanTool({ selected$, items$, apiKeys$ });
    const designToolUI = DesignTool({ selected$, items$, apiKeys$ });
    const visualizeUI = VisualizeTool({ selectedWithText$, items$, apiKeys$ });
    const blendToolUI = BlendTool({ selected$, items$, apiKeys$ });
    const userTestingUI = UserTestingTool({ selected$, items$, apiKeys$ });
    const renderToolUI = RenderTool({ selected$, items$, apiKeys$ });
    const writerToolUI = WriterTool({ items$, apiKeys$ });
    const captureToolUI = CaptureTool({ items$ });
    const canvasToolUI = CanvasTool({ items$ });

    const template$ = combineLatest([selected$, selectedWithText$]).pipe(
      map(([selected, selectedWithText]) => {
        const totalSelected = selected.length;

        return html`<aside class="context-tray">
          <section class="tool-section">
            <h2>New</h2>
            <div class="tool-body">${captureToolUI}</div>
            <div class="tool-body">${renderToolUI}</div>
            <div class="tool-body">${writerToolUI}</div>
          </section>
          ${totalSelected > 0
            ? html`
                <section class="tool-section">
                  <h2>Design</h2>
                  <div class="tool-body">${designToolUI}</div>
                </section>
                <section class="tool-section">
                  <h2>Scan</h2>
                  <div class="tool-body">${conceptualScanUI}</div>
                </section>
                <section class="tool-section">
                  <h2>User testing</h2>
                  <div class="tool-body">${userTestingUI}</div>
                </section>
              `
            : nothing}
          ${totalSelected > 1
            ? html`<section class="tool-section">
                <h2>Blend</h2>
                <div class="tool-body">${blendToolUI}</div>
              </section>`
            : nothing}
          ${selectedWithText.length > 0
            ? html`<section class="tool-section">
                <h2>Visualize</h2>
                <div class="tool-body">${visualizeUI}</div>
              </section>`
            : nothing}
          <section class="tool-section">
            <h2>Canvas</h2>
            <div class="tool-body">${canvasToolUI}</div>
          </section>
        </aside>`;
      }),
    );

    return template$;
  },
);
