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
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { designConcepts$ } from "../llm/design-concepts";
import { submitTask } from "../tasks";
import "./iterate.tool.css";

export const IterateTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const prompt$ = new BehaviorSubject<string>("");
    const numDesigns$ = new BehaviorSubject<number>(3);
    const isGenerating$ = new BehaviorSubject(false);
    const generate$ = new BehaviorSubject<boolean>(false);

    void persistSubject(prompt$, "context-tray:iterate:prompt");
    void persistSubject(numDesigns$, "context-tray:iterate:num-designs");

    const effect$ = generate$.pipe(
      filter((v) => v === true),
      tap(() => generate$.next(false)),
      withLatestFrom(selected$, prompt$, numDesigns$, apiKeys$),
      filter(([_, selected]) => selected.length > 0),
      tap(([_, selected, prompt, numDesigns, apiKeys]) => {
        if (!apiKeys.gemini) return;
        isGenerating$.next(true);

        const positionGenerator = getNextPositions(selected);

        const task$ = designConcepts$({
          items: selected,
          requirements:
            prompt.trim() || "Iterate and improve on the existing designs, incorporating any feedback provided.",
          numDesigns,
          apiKey: apiKeys.gemini,
        }).pipe(
          tap((concept) => {
            const { x, y, z } = positionGenerator.next().value;
            const card: CanvasItem = {
              id: `iterate-${Date.now()}-${Math.random()}`,
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

    return combineLatest([prompt$, numDesigns$, isGenerating$, apiKeys$]).pipe(
      map(([prompt, numDesigns, isGenerating, apiKeys]) => {
        return html`
          <div class="iterate-tool">
            <textarea
              placeholder="Optional: describe direction or paste feedback..."
              .value=${prompt}
              @input=${(e: Event) => prompt$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <div class="iterate-row">
              <label for="iterate-count">Count</label>
              <input
                type="number"
                id="iterate-count"
                min="1"
                max="5"
                .value=${String(numDesigns)}
                @input=${(e: Event) => numDesigns$.next(parseInt((e.target as HTMLInputElement).value) || 3)}
              />
              <button
                ?disabled=${isGenerating || !apiKeys.gemini}
                @click=${() => generate$.next(true)}
                title=${!apiKeys.gemini ? "Gemini API key required" : ""}
              >
                ${isGenerating ? "Generating..." : "Iterate"}
              </button>
            </div>
          </div>
        `;
      }),
      mergeWith(effect$),
    );
  },
);
