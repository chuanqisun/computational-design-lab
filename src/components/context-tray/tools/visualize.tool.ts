import { html } from "lit-html";
import { BehaviorSubject, filter, ignoreElements, map, mergeWith, Observable, tap, withLatestFrom } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import type { ApiKeys } from "../../connections/storage";
import "./visualize.tool.css";

export const VisualizeTool = createComponent(
  ({
    selectedWithText$,
    items$,
    apiKeys$,
  }: {
    selectedWithText$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const visualizationTypes = [
      { id: "abstract", label: "Abstract" },
      { id: "concrete", label: "Concrete" },
    ] as const;
    const runtime = getActionRuntime(items$, apiKeys$);

    const visualize$ = new BehaviorSubject<(typeof visualizationTypes)[number] | null>(null);

    const visualizeEffect$ = visualize$.pipe(
      filter((vizType): vizType is (typeof visualizationTypes)[number] => vizType !== null),
      withLatestFrom(selectedWithText$),
      tap(([vizType, selectedWithText]) => {
        if (selectedWithText.length === 0) return;
        runUserAction(runtime, "visualize_concept", {
          style: vizType.id,
          cardIds: selectedWithText.map((item) => item.id),
        });
      }),
      ignoreElements(),
    );

    const template$ = selectedWithText$.pipe(
      map((selectedWithText) => {
        if (selectedWithText.length === 0) return html``;

        return html`
          <div class="visualize-section">
            <div class="visualize-options">
              ${visualizationTypes.map(
                (vizType) => html`
                  <button class="visualize-option" @click=${() => visualize$.next(vizType)}>${vizType.label}</button>
                `,
              )}
            </div>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(visualizeEffect$));
  },
);
