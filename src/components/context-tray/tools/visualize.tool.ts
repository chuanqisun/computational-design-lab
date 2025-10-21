import { html } from "lit-html";
import { BehaviorSubject, filter, ignoreElements, map, mergeWith, Observable, tap, withLatestFrom } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { visualizeConcept$ } from "../llm/visualize-concept";
import { submitTask } from "../tasks";
import "./visualize.tool.css";

export const VisualizeTool = createComponent(
  ({
    selectedTexts$,
    items$,
    apiKeys$,
  }: {
    selectedTexts$: Observable<TextItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const visualizationTypes = [
      {
        id: "abstract",
        label: "Abstract",
        instruction:
          "Create abstract, artistic visualizations that capture the essence of the concept in non-literal, symbolic ways. Use diverse artistic styles, colors, and compositions to represent ideas metaphorically.",
      },
      {
        id: "concrete",
        label: "Concrete",
        instruction:
          "Create concrete, realistic visualizations that depict the concept in literal, tangible forms. Focus on detailed, lifelike representations that show the concept as it might appear in reality.",
      },
    ];

    const visualize$ = new BehaviorSubject<(typeof visualizationTypes)[number] | null>(null);

    const visualizeEffect$ = visualize$.pipe(
      filter((vizType): vizType is (typeof visualizationTypes)[number] => vizType !== null),
      withLatestFrom(selectedTexts$, apiKeys$),
      tap(([vizType, selectedTexts, apiKeys]) => {
        if (selectedTexts.length === 0) {
          return;
        }

        if (!apiKeys.gemini || !apiKeys.openai) {
          console.warn("No Gemini or OpenAI API key provided.");
          return;
        }

        const title = "Selected Concept";
        const description = selectedTexts.map((txt) => txt.content).join(" ");
        const concept = { title, description };

        const positionGenerator = getNextPositions(items$.value);
        const task$ = visualizeConcept$({
          concept,
          instruction: vizType.instruction,
          openaiApiKey: apiKeys.openai,
          geminiApiKey: apiKeys.gemini,
        }).pipe(
          tap((url) => {
            const { x, y, z } = positionGenerator.next().value;
            const newImage: ImageItem = {
              id: `img-${crypto.randomUUID()}`,
              type: "image",
              src: url,
              x,
              y,
              width: 200,
              height: 200,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, newImage]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = selectedTexts$.pipe(
      map((selectedTexts) => {
        if (selectedTexts.length === 0) return html``;

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
