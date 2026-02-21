import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeWith,
  Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { scanConcepts$, type ConceptualScanInput } from "../llm/scan-concepts";
import { submitTask } from "../tasks";
import "./conceptual-scan.tool.css";

export const ConceptualScanTool = createComponent(
  ({
    selectedImages$,
    selectedTexts$,
    items$,
    apiKeys$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    selectedTexts$: Observable<TextItem[]>;
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
    ];

    const scan$ = new BehaviorSubject<(typeof scanTypes)[number] | null>(null);

    const scanEffect$ = scan$.pipe(
      filter((scanType): scanType is (typeof scanTypes)[number] => scanType !== null),
      withLatestFrom(selectedImages$, selectedTexts$, apiKeys$),
      tap(([scanType, selectedImages, selectedTexts, apiKeys]) => {
        const selectedItems = [...selectedImages, ...selectedTexts];

        if (selectedItems.length === 0 || !apiKeys.gemini) {
          return;
        }

        const scanInputs: ConceptualScanInput[] = selectedItems.map((item) => {
          if ("src" in item && item.src) {
            return { src: item.src } as ConceptualScanInput;
          } else if ("title" in item && "content" in item) {
            return { title: item.title, content: item.content } as ConceptualScanInput;
          }
          throw new Error("Invalid item type");
        });

        const positionGenerator = getNextPositions(selectedItems);
        const task$ = scanConcepts$({
          items: scanInputs,
          instruction: scanType.instruction,
          apiKey: apiKeys.gemini,
        }).pipe(
          tap((concept) => {
            const { x, y, z } = positionGenerator.next().value;
            const newText: CanvasItem = {
              id: `text-${Date.now()}`,
              type: "text",
              title: concept.title,
              content: concept.description,
              x,
              y,
              width: 200,
              height: 200,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, newText]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([selectedImages, selectedTexts]) => {
        const selectedItemsCount = selectedImages.length + selectedTexts.length;
        if (selectedItemsCount === 0) return html``;

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
