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
import { allSurfaceOptions, toggleItem } from "../../../lib/studio-utils";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { colors } from "../../material-library/colors";
import { materials } from "../../material-library/materials";
import { mechanisms } from "../../material-library/mechanisms";
import { shapes } from "../../material-library/shapes";
import { designConcepts$, type DesignInput, type DesignRequirement } from "../llm/design-concepts";
import { submitTask } from "../tasks";
import "./design.tool.css";

export const DesignTool = createComponent(
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
    const showRequirements$ = new BehaviorSubject(false);
    const pickedMaterials$ = new BehaviorSubject<string[]>([]);
    const pickedColors$ = new BehaviorSubject<string[]>([]);
    const pickedShapes$ = new BehaviorSubject<string[]>([]);
    const pickedMechanisms$ = new BehaviorSubject<string[]>([]);
    const pickedSurfaceOptions$ = new BehaviorSubject<string[]>([]);
    const numDesigns$ = new BehaviorSubject<number>(1);
    const isGenerating$ = new BehaviorSubject(false);
    const performGenerate$ = new BehaviorSubject<boolean>(false);

    const effect$ = performGenerate$.pipe(
      filter((val) => val === true),
      tap(() => performGenerate$.next(false)), // reset
      withLatestFrom(
        selectedImages$,
        selectedTexts$,
        pickedMaterials$,
        pickedColors$,
        pickedShapes$,
        pickedMechanisms$,
        pickedSurfaceOptions$,
        numDesigns$,
        apiKeys$,
      ),
      filter(([_, images, texts]) => images.length > 0 || texts.length > 0),
      tap(([_, images, texts, materials, colors, shapes, mechanisms, surfaceOptions, numDesigns, apiKeys]) => {
        if (!apiKeys.gemini) return;
        isGenerating$.next(true);
        const designInputs: DesignInput[] = [
          ...images.map((img) => ({ src: img.src })),
          ...texts.map((txt) => ({ title: txt.title, content: txt.content })),
        ];

        const requirements: DesignRequirement = {
          materials,
          colors,
          shapes,
          mechanisms,
          surfaceOptions,
        };

        const positionGenerator = getNextPositions([...images, ...texts]);

        const task$ = designConcepts$({
          items: designInputs,
          requirements,
          numDesigns,
          apiKey: apiKeys.gemini!,
        }).pipe(
          tap((concept) => {
            const { x, y, z } = positionGenerator.next().value;
            const newText: CanvasItem = {
              id: `text-${Date.now()}-${Math.random()}`,
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
          tap({
            complete: () => isGenerating$.next(false),
            error: () => isGenerating$.next(false),
          }),
        );
        submitTask(task$);
      }),
      ignoreElements(),
    );

    const openDialog = () => {
      const dialog = document.getElementById("design-requirements-dialog") as HTMLDialogElement | null;
      if (dialog && !dialog.open) {
        dialog.showModal();
        showRequirements$.next(true);
      }
    };

    const closeDialog = () => {
      const dialog = document.getElementById("design-requirements-dialog") as HTMLDialogElement | null;
      if (dialog && dialog.open) {
        dialog.close();
        showRequirements$.next(false);
      }
    };

    return combineLatest([
      pickedMaterials$,
      pickedColors$,
      pickedShapes$,
      pickedMechanisms$,
      pickedSurfaceOptions$,
      numDesigns$,
      isGenerating$,
      apiKeys$,
    ]).pipe(
      map(([pMaterials, pColors, pShapes, pMechanisms, pSurfaceOptions, numDesigns, isGenerating, apiKeys]) => {
        return html`
          <div class="design-tool">
            <button class="requirements-btn" @click=${openDialog}>
              Add requirements
              (${pMaterials.length + pColors.length + pShapes.length + pMechanisms.length + pSurfaceOptions.length})
            </button>

            <div class="generate-row">
              <label>Count:</label>
              <input
                type="number"
                min="1"
                max="9"
                class="num-designs-input"
                .value=${String(numDesigns)}
                @input=${(e: Event) => numDesigns$.next(parseInt((e.target as HTMLInputElement).value) || 1)}
              />
              <button
                class="generate-btn"
                ?disabled=${isGenerating || !apiKeys.gemini}
                @click=${() => performGenerate$.next(true)}
                title=${!apiKeys.gemini ? "Gemini API key required" : ""}
              >
                ${isGenerating ? "Generating..." : "Generate Designs"}
              </button>
            </div>

            <dialog
              id="design-requirements-dialog"
              class="requirements-dialog"
              @close=${() => showRequirements$.next(false)}
            >
              <div class="dialog-header">
                <h3>Design Requirements</h3>
                <button @click=${closeDialog}>Close</button>
              </div>
              <div class="dialog-content">
                <div class="requirements-section">
                  <h4>Materials</h4>
                  <div class="options-grid">
                    ${materials.map(
                      (m) => html`
                        <button
                          class="option-btn ${pMaterials.includes(m.id) ? "selected" : ""}"
                          @click=${() => pickedMaterials$.next(toggleItem(pMaterials, m.id))}
                        >
                          ${m.name}
                        </button>
                      `,
                    )}
                  </div>
                </div>

                <div class="requirements-section">
                  <h4>Colors</h4>
                  <div class="options-grid">
                    ${colors.map(
                      (c) => html`
                        <button
                          class="option-btn ${pColors.includes(c.name) ? "selected" : ""}"
                          @click=${() => pickedColors$.next(toggleItem(pColors, c.name))}
                        >
                          ${c.name}
                        </button>
                      `,
                    )}
                  </div>
                </div>

                <div class="requirements-section">
                  <h4>Shapes</h4>
                  <div class="options-grid">
                    ${shapes.map(
                      (s) => html`
                        <button
                          class="option-btn ${pShapes.includes(s.id) ? "selected" : ""}"
                          @click=${() => pickedShapes$.next(toggleItem(pShapes, s.id))}
                        >
                          ${s.name}
                        </button>
                      `,
                    )}
                  </div>
                </div>

                <div class="requirements-section">
                  <h4>Mechanisms</h4>
                  <div class="options-grid">
                    ${mechanisms.map(
                      (m) => html`
                        <button
                          class="option-btn ${pMechanisms.includes(m.id) ? "selected" : ""}"
                          @click=${() => pickedMechanisms$.next(toggleItem(pMechanisms, m.id))}
                        >
                          ${m.name}
                        </button>
                      `,
                    )}
                  </div>
                </div>

                <div class="requirements-section">
                  <h4>Surface Options</h4>
                  <div class="options-grid">
                    ${allSurfaceOptions.map(
                      (s) => html`
                        <button
                          class="option-btn ${pSurfaceOptions.includes(s) ? "selected" : ""}"
                          @click=${() => pickedSurfaceOptions$.next(toggleItem(pSurfaceOptions, s))}
                        >
                          ${s}
                        </button>
                      `,
                    )}
                  </div>
                </div>
              </div>
              <div class="dialog-footer">
                <button @click=${closeDialog}>Done</button>
              </div>
            </dialog>
          </div>
        `;
      }),
      mergeWith(effect$),
    );
  },
);
