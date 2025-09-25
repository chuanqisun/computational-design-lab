import { html } from "lit-html";
import {
  BehaviorSubject,
  EMPTY,
  ignoreElements,
  map,
  mergeMap,
  mergeWith,
  Observable,
  Subject,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { visualizeConcept$ } from "../llm/visualize-concept";
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
        label: "Abstract Visualization",
        instruction:
          "Create abstract, artistic visualizations that capture the essence of the concept in non-literal, symbolic ways. Use diverse artistic styles, colors, and compositions to represent ideas metaphorically.",
      },
      {
        id: "concrete",
        label: "Concrete Visualization",
        instruction:
          "Create concrete, realistic visualizations that depict the concept in literal, tangible forms. Focus on detailed, lifelike representations that show the concept as it might appear in reality.",
      },
    ];

    const visualize$ = new Subject<string>();

    const visualizeEffect$ = visualize$.pipe(
      withLatestFrom(selectedTexts$, apiKeys$),
      mergeMap(([vizTypeId, selectedTexts, apiKeys]) => {
        const vizType = visualizationTypes.find((type) => type.id === vizTypeId);

        if (selectedTexts.length === 0 || !vizType) {
          return EMPTY;
        }

        if (!apiKeys.gemini || !apiKeys.openai) {
          console.warn("No Gemini API key provided.");
          return EMPTY;
        }

        // Create concept from selected texts
        const title = "Selected Concept";
        const description = selectedTexts.map((txt) => txt.content).join(" ");
        const concept = { title, description };

        return visualizeConcept$({
          concept,
          instruction: vizType.instruction,
          openaiApiKey: apiKeys.openai,
          geminiApiKey: apiKeys.gemini,
        }).pipe(
          tap((url) => {
            const newImage: ImageItem = {
              id: `img-${crypto.randomUUID()}`,
              type: "image",
              src: url,
              x: Math.random() * 400 + 50,
              y: Math.random() * 400 + 50,
              width: 200,
              height: 200,
              isSelected: false,
            };
            items$.next([...items$.value, newImage]);
          }),
        );
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
                  <button class="visualize-option" @click=${() => visualize$.next(vizType.id)}>${vizType.label}</button>
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
