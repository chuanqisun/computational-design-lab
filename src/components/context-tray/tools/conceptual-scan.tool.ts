import { html } from "lit-html";
import {
  BehaviorSubject,
  filter,
  ignoreElements,
  map,
  mergeWith,
  Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { scanConcepts$ } from "../llm/scan-concepts";
import { submitTask } from "../tasks";
import "./conceptual-scan.tool.css";

export const ConceptualScanTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const scanTypes = [
      {
        id: "emotions",
        label: "Emotions",
        instruction:
          "Analyze the selected items and describe how people feel when interacting with them. Focus on emotional responses, moods, and psychological impact.",
      },
      {
        id: "associations",
        label: "Associations",
        instruction:
          "Identify what concepts, objects, memories, or cultural references people associate with the selected items.",
      },
      {
        id: "symbolism",
        label: "Symbolism",
        instruction:
          "Extract symbols, icons, and abstract meanings from the selected items. What do these elements represent metaphorically?",
      },
      {
        id: "shape",
        label: "Shape",
        instruction: "Analyze the geometric shapes, contours, silhouettes, and profiles present in the selected items.",
      },
      {
        id: "material",
        label: "Material",
        instruction:
          "Identify the materials involved in or inspired by the selected items. Focus on physical properties and material expression.",
      },
      {
        id: "color",
        label: "Color",
        instruction:
          "Analyze the color palette present in the selected items and any colors associated with the underlying concepts.",
      },
      {
        id: "tactility",
        label: "Tactility",
        instruction:
          "Describe how the selected items would feel to the touch. Focus on texture, temperature, hardness, and surface finish.",
      },
      {
        id: "acoustics",
        label: "Acoustics",
        instruction:
          "Imagine the sounds associated with the selected items. What do people hear when using or interacting with them?",
      },
      {
        id: "interactions",
        label: "Interactions",
        instruction:
          "Describe how people interact with the selected items. Focus on gestures, ergonomics, and functional usage patterns.",
      },
      {
        id: "narrative",
        label: "Narrative",
        instruction:
          "Create a narrative based on the selected items. Weave together the visual and textual elements into a cohesive story or scenario.",
      },
    ];

    const scan$ = new BehaviorSubject<(typeof scanTypes)[number] | null>(null);

    const scanEffect$ = scan$.pipe(
      filter((scanType): scanType is (typeof scanTypes)[number] => scanType !== null),
      withLatestFrom(selected$, apiKeys$),
      tap(([scanType, selected, apiKeys]) => {
        if (selected.length === 0 || !apiKeys.gemini) {
          return;
        }

        const positionGenerator = getNextPositions(selected);
        const task$ = scanConcepts$({
          items: selected,
          instruction: scanType.instruction,
          apiKey: apiKeys.gemini,
        }).pipe(
          tap((concept) => {
            const { x, y, z } = positionGenerator.next().value;
            const card: CanvasItem = {
              id: `scan-${Date.now()}`,
              title: concept.title,
              body: concept.description,
              imagePrompt: concept.description,
              x,
              y,
              width: 200,
              height: 300,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, card]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = selected$.pipe(
      map((selected) => {
        if (selected.length === 0) return html``;

        return html`
          <div class="conceptual-scan-section">
            <div class="scan-options">
              ${scanTypes.map(
                (scanType) => html`
                  <button class="scan-option" @click=${() => scan$.next(scanType)}>${scanType.label}</button>
                `,
              )}
            </div>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$));
  },
);
