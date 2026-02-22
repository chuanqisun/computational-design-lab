import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeWith,
  type Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { designConcepts$, type DesignInput } from "../llm/design-concepts";
import { submitTask } from "../tasks";
import "./design.tool.css";

export const DesignTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const inputText$ = new BehaviorSubject<string>("");
    const numDesigns$ = new BehaviorSubject<number>(1);
    const isGenerating$ = new BehaviorSubject(false);
    const performGenerate$ = new BehaviorSubject<boolean>(false);

    const effect$ = performGenerate$.pipe(
      filter((val) => val === true),
      tap(() => performGenerate$.next(false)),
      withLatestFrom(selected$, inputText$, numDesigns$, apiKeys$),
      filter(([_, selected]) => selected.length > 0),
      tap(([_, selected, requirements, numDesigns, apiKeys]) => {
        if (!apiKeys.gemini) return;
        isGenerating$.next(true);

        const designInputs: DesignInput[] = selected;
        const positionGenerator = getNextPositions(selected);

        const task$ = designConcepts$({
          items: designInputs,
          requirements,
          numDesigns,
          apiKey: apiKeys.gemini,
        }).pipe(
          tap((concept) => {
            const { x, y, z } = positionGenerator.next().value;
            const card: CanvasItem = {
              id: `design-${Date.now()}-${Math.random()}`,
              title: concept.title,
              body: concept.description,
              imagePrompt: concept.imagePrompt,
              x,
              y,
              width: 200,
              height: 300,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, card]);
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

    return combineLatest([inputText$, numDesigns$, isGenerating$, apiKeys$]).pipe(
      map(([inputText, numDesigns, isGenerating, apiKeys]) => {
        return html`
          <div class="design-tool">
            <textarea
              class="design-input"
              placeholder="Describe your design requirements here..."
              .value=${inputText}
              @input=${(e: Event) => inputText$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>

            <div class="generate-row">
              <label>Count:</label>
              <input
                type="number"
                min="1"
                max="4"
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
                ${isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        `;
      }),
      mergeWith(effect$),
    );
  },
);
