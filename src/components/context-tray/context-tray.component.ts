import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { hasText, type CanvasItem } from "../canvas/canvas.component";
import type { ApiKeys } from "../connections/storage";
import "./context-tray.component.css";
import { AnimateTool } from "./tools/animate.tool";
import { BlendTool } from "./tools/blend.tool";
import { CanvasTool } from "./tools/canvas.tool";
import { CaptureTool } from "./tools/capture.tool";
import { ConceptualScanTool } from "./tools/conceptual-scan.tool";
import { DesignTool } from "./tools/design.tool";
import { ExportTool } from "./tools/export.tool";
import { IterateTool } from "./tools/iterate.tool";
import { NewPromptTool } from "./tools/new-prompt.tool";
import { SketchTool } from "./tools/sketch.tool";
import { interviewState$, UserTestingTool } from "./tools/user-testing.tool";
import { VisualizeTool } from "./tools/visualize.tool";

export const ContextTrayComponent = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const selected$ = items$.pipe(map((items) => items.filter((item) => item.isSelected)));
    const selectedWithText$ = selected$.pipe(map((items) => items.filter(hasText)));

    const conceptualScanUI = ConceptualScanTool({ selected$, items$, apiKeys$ });
    const designToolUI = DesignTool({ selected$, items$, apiKeys$ });
    const visualizeUI = VisualizeTool({ selectedWithText$, items$, apiKeys$ });
    const blendToolUI = BlendTool({ selected$, items$, apiKeys$ });
    const userTestingUI = UserTestingTool({ selected$, items$, apiKeys$ });
    const iterateUI = IterateTool({ selected$, items$, apiKeys$ });
    const newPromptToolUI = NewPromptTool({ selected$, items$, apiKeys$ });
    const captureToolUI = CaptureTool({ items$ });
    const canvasToolUI = CanvasTool({ items$ });
    const exportToolUI = ExportTool({ items$ });
    const sketchToolUI = SketchTool({ selected$, items$, apiKeys$ });
    const animateToolUI = AnimateTool({ selected$, items$, apiKeys$ });

    const template$ = combineLatest([selected$, selectedWithText$, interviewState$]).pipe(
      map(([selected, _selectedWithText, interviewState]) => {
        const totalSelected = selected.length;
        const showUserTesting = totalSelected > 0 || interviewState !== "idle";

        return html`<aside class="context-tray">
          <section class="tool-section">
            <h2>New</h2>
            <div class="tool-body">${captureToolUI}</div>
            <div class="tool-body">${newPromptToolUI}</div>
          </section>
          ${
            totalSelected > 0
              ? html`
                  <section class="tool-section">
                    <h2>Visualize</h2>
                    <div class="tool-body">${visualizeUI}</div>
                  </section>
                  <section class="tool-section">
                    <h2>Scan</h2>
                    <div class="tool-body">${conceptualScanUI}</div>
                  </section>
                  ${
                    totalSelected > 1
                      ? html`<section class="tool-section">
                          <h2>Blend</h2>
                          <div class="tool-body">${blendToolUI}</div>
                        </section>`
                      : nothing
                  }
                  <section class="tool-section">
                    <h2>Design</h2>
                    <div class="tool-body">${designToolUI}</div>
                  </section>
                `
              : nothing
          }
          ${
            showUserTesting
              ? html`
                  <section class="tool-section">
                    <h2>User testing</h2>
                    <div class="tool-body">${userTestingUI}</div>
                  </section>
                `
              : nothing
          }
          ${
            totalSelected > 0
              ? html`
                  <section class="tool-section">
                    <h2>Iterate</h2>
                    <div class="tool-body">${iterateUI}</div>
                  </section>
                  <section class="tool-section">
                    <h2>Sketch</h2>
                    <div class="tool-body">${sketchToolUI}</div>
                  </section>
                  <section class="tool-section">
                    <h2>Animate</h2>
                    <div class="tool-body">${animateToolUI}</div>
                  </section>
                `
              : nothing
          }
          <section class="tool-section">
            <h2>Canvas</h2>
            <div class="tool-body">${canvasToolUI}</div>
          </section>
          ${
            totalSelected > 0
              ? html` <section class="tool-section">
                  <h2>Export</h2>
                  <div class="tool-body">${exportToolUI}</div>
                </section>`
              : nothing
          }
        </aside>`;
      }),
    );

    return template$;
  },
);
