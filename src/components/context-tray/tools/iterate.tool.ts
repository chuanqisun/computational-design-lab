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
import type { ApiKeys } from "../../connections/storage";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
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
    const brandGuide$ = new BehaviorSubject<string>("");
    const numDesigns$ = new BehaviorSubject<number>(3);
    const isGenerating$ = new BehaviorSubject(false);
    const runtime = getActionRuntime(items$, apiKeys$);
    const generate$ = new BehaviorSubject<boolean>(false);

    void persistSubject(prompt$, "context-tray:iterate:prompt");
    void persistSubject(brandGuide$, "context-tray:iterate:brand-guide");
    void persistSubject(numDesigns$, "context-tray:iterate:num-designs");

    const effect$ = generate$.pipe(
      filter((v) => v === true),
      tap(() => generate$.next(false)),
      withLatestFrom(selected$, prompt$, brandGuide$, numDesigns$),
      filter(([_, selected]) => selected.length > 0),
      tap(([_, selected, prompt, brandGuide, numDesigns]) => {
        isGenerating$.next(true);
        runUserAction(
          runtime,
          "iterate_designs",
          { direction: prompt, brandGuide, count: numDesigns, cardIds: selected.map((item) => item.id) },
          () => isGenerating$.next(false),
        );
      }),
      ignoreElements(),
    );

    return combineLatest([prompt$, brandGuide$, numDesigns$, isGenerating$, apiKeys$]).pipe(
      map(([prompt, brandGuide, numDesigns, isGenerating, apiKeys]) => {
        return html`
          <div class="iterate-tool">
            <textarea
              rows="3"
              placeholder="Optional: describe direction or paste feedback..."
              .value=${prompt}
              @input=${(e: Event) => prompt$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <textarea
              class="brand-guide-input"
              rows="4"
              placeholder="Optional brand guide..."
              .value=${brandGuide}
              @input=${(e: Event) => brandGuide$.next((e.target as HTMLTextAreaElement).value)}
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
