import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import { getActionRuntime, isTrayVisible } from "../../lib/actions/app-runtime";
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
import { NewPromptTool } from "./tools/new-prompt.tool";
import { SketchTool } from "./tools/sketch.tool";
import { interviewState$, UserTestingTool } from "./tools/user-testing.tool";
import { VisualizeTool } from "./tools/visualize.tool";
import { TraceSectionComponent } from "../workflow/trace-section.component";
import { WorkflowSectionComponent } from "../workflow/workflow-section.component";

export const ContextTrayComponent = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const selected$ = items$.pipe(map((items) => items.filter((item) => item.isSelected)));
    const selectedWithText$ = selected$.pipe(map((items) => items.filter(hasText)));

    const conceptualScanUI = ConceptualScanTool({ selected$, items$, apiKeys$ });
    const designToolUI = DesignTool({ selected$, items$, apiKeys$ });
    const visualizeUI = VisualizeTool({ selectedWithText$, items$, apiKeys$ });
    const blendToolUI = BlendTool({ selected$, items$, apiKeys$ });
    const userTestingUI = UserTestingTool({ selected$, items$, apiKeys$ });
    const newPromptToolUI = NewPromptTool({ selected$, items$, apiKeys$ });
    const captureToolUI = CaptureTool({ items$, apiKeys$ });
    const canvasToolUI = CanvasTool({ items$, apiKeys$ });
    const exportToolUI = ExportTool({ items$, apiKeys$ });
    const sketchToolUI = SketchTool({ selected$, items$, apiKeys$ });
    const animateToolUI = AnimateTool({ selected$, items$, apiKeys$ });

    const runtime = getActionRuntime(items$, apiKeys$);
    const workflowUI = WorkflowSectionComponent({ runtime, apiKeys$ });
    const traceUI = TraceSectionComponent({ runtime });
    const section = (name: string, title: string, body: unknown, visible = isTrayVisible(runtime, name)) =>
      visible
        ? html`<section class="tool-section">
            <h2>${title}</h2>
            <div class="tool-body">${body}</div>
          </section>`
        : nothing;

    // Section visibility uses each action's isAvailable on the selection: the same predicate that
    // decides which tools the agent may call.
    const template$ = combineLatest([items$, apiKeys$, interviewState$]).pipe(
      map(([_items, _apiKeys, interviewState]) => {
        return html`<aside class="context-tray">
          <section class="tool-section">
            <h2>New</h2>
            <div class="tool-body">${captureToolUI}</div>
            <div class="tool-body">${newPromptToolUI}</div>
          </section>
          <section class="tool-section">
            <h2>Canvas</h2>
            <div class="tool-body">${canvasToolUI}</div>
          </section>
          ${section("visualize_concept", "Visualize", visualizeUI)}
          ${section("scan_concept", "Scan", conceptualScanUI)}
          ${section("blend_images", "Blend", blendToolUI)}
          ${section(
            "design_concepts",
            "Design",
            designToolUI,
            isTrayVisible(runtime, "design_concepts") || isTrayVisible(runtime, "iterate_designs"),
          )}
          ${section(
            "run_user_testing",
            "User testing",
            userTestingUI,
            isTrayVisible(runtime, "run_user_testing") || interviewState !== "idle",
          )}
          ${section(
            "animate",
            "Media",
            html`<div class="media-tools">${sketchToolUI}${animateToolUI}</div>`,
            isTrayVisible(runtime, "edit_image") || isTrayVisible(runtime, "animate"),
          )}
          <section class="tool-section">
            <h2>Workflow</h2>
            <div class="tool-body">${workflowUI}</div>
          </section>
          <section class="tool-section">
            <h2>Trace</h2>
            <div class="tool-body">${traceUI}</div>
          </section>
          ${section("export_cards", "Export", exportToolUI)}
        </aside>`;
      }),
    );

    return template$;
  },
);
