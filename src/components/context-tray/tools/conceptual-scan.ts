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
import type { ApiKeys } from "../../connections/storage";
import { scanConcepts$, type ConceptualScanInput } from "../llm/scan-concepts";
import { submitTask } from "../tasks";
import "./conceptual-scan.css";

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
        id: "emotional-resonance",
        label: "Emotional resonance",
        instruction:
          "Analyze the selected items and identify the emotional qualities they evoke. Focus on feelings, moods, and psychological responses that users might experience when interacting with these design elements.",
      },
      {
        id: "material-properties",
        label: "Material properties",
        instruction:
          "Examine the selected items and analyze their material characteristics. Focus on texture, weight, durability, sustainability, tactile qualities, and how the materials contribute to the overall design experience.",
      },
      {
        id: "feature-detection",
        label: "Feature detection",
        instruction:
          "Scan the selected items for technological features and interaction capabilities. Identify user interface elements, functional components, interaction methods, and innovative technologies that enable user engagement.",
      },
    ];

    const scan$ = new BehaviorSubject<(typeof scanTypes)[number] | null>(null);

    const scanEffect$ = scan$.pipe(
      filter((scanType): scanType is (typeof scanTypes)[number] => scanType !== null),
      withLatestFrom(selectedImages$, selectedTexts$, apiKeys$),
      tap(([scanType, selectedImages, selectedTexts, apiKeys]) => {
        const selectedItems = [...selectedImages, ...selectedTexts];

        if (selectedItems.length === 0 || !apiKeys.openai) {
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

        const task$ = scanConcepts$({
          items: scanInputs,
          instruction: scanType.instruction,
          apiKey: apiKeys.openai,
        }).pipe(
          tap((concept) => {
            const newText: CanvasItem = {
              id: `text-${Date.now()}`,
              type: "text",
              title: concept.title,
              content: concept.description,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              isSelected: false,
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
