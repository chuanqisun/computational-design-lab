import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
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
import type { ImageItem, TextItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { scanConcepts$, type ConceptualScanInput } from "../llm/scan-concepts";
import "./conceptual-scan.css";

export const ConceptualScanTool = createComponent(
  ({
    selectedImages$,
    selectedTexts$,
    texts$,
    apiKeys$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    selectedTexts$: Observable<TextItem[]>;
    texts$: BehaviorSubject<TextItem[]>;
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

    const selectedScanType$ = new BehaviorSubject<string>("emotional-resonance");
    const scan$ = new Subject<void>();

    const scanEffect$ = scan$.pipe(
      withLatestFrom(selectedScanType$, selectedImages$, selectedTexts$, apiKeys$),
      mergeMap(([_, scanTypeId, selectedImages, selectedTexts, apiKeys]) => {
        const selectedItems = [...selectedImages, ...selectedTexts];
        const scanType = scanTypes.find((type) => type.id === scanTypeId);

        if (selectedItems.length === 0 || !scanType || !apiKeys.openai) {
          return EMPTY;
        }

        // Convert selected items to scan inputs
        const scanInputs: ConceptualScanInput[] = selectedItems.map((item) => {
          if ("src" in item && item.src) {
            return { src: item.src } as ConceptualScanInput;
          } else if ("title" in item && "content" in item) {
            return { title: item.title, content: item.content } as ConceptualScanInput;
          }
          // This should never happen given our type filtering above
          throw new Error("Invalid item type");
        });

        return scanConcepts$({
          items: scanInputs,
          instruction: scanType.instruction,
          apiKey: apiKeys.openai,
        }).pipe(
          tap((concept) => {
            const newText: TextItem = {
              id: `text-${Date.now()}`,
              title: concept.title,
              content: concept.description,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              isSelected: false,
            };
            texts$.next([...texts$.value, newText]);
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([selectedScanType$, selectedImages$, selectedTexts$]).pipe(
      map(([selectedTypeId, selectedImages, selectedTexts]) => {
        const selectedItemsCount = selectedImages.length + selectedTexts.length;
        if (selectedItemsCount === 0) return html``;

        return html`
          <div class="conceptual-scan-section">
            <div class="scan-options">
              ${scanTypes.map(
                (scanType) => html`
                  <label class="scan-option">
                    <input
                      type="radio"
                      name="scan-type"
                      value=${scanType.id}
                      ?checked=${selectedTypeId === scanType.id}
                      @change=${(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        if (target.checked) {
                          selectedScanType$.next(scanType.id);
                        }
                      }}
                    />
                    <span class="scan-label">${scanType.label}</span>
                  </label>
                `,
              )}
            </div>
            <button @click=${() => scan$.next()}>Scan</button>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$));
  },
);
