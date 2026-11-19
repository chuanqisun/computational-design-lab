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
    const brandGuide$ = new BehaviorSubject<string>("");
    const numDesigns$ = new BehaviorSubject<number>(1);
    const isGenerating$ = new BehaviorSubject(false);
    const runtime = getActionRuntime(items$, apiKeys$);
    const performGenerate$ = new BehaviorSubject<boolean>(false);

    void persistSubject(inputText$, "context-tray:design:input-text");
    void persistSubject(brandGuide$, "context-tray:design:brand-guide");
    void persistSubject(numDesigns$, "context-tray:design:num-designs");

    const effect$ = performGenerate$.pipe(
      filter((val) => val === true),
      tap(() => performGenerate$.next(false)),
      withLatestFrom(selected$, inputText$, brandGuide$, numDesigns$),
      filter(([_, selected]) => selected.length > 0),
      tap(([_, selected, requirements, brandGuide, numDesigns]) => {
        isGenerating$.next(true);
        runUserAction(
          runtime,
          "design_concepts",
          { requirements, brandGuide, count: numDesigns, cardIds: selected.map((item) => item.id) },
          () => isGenerating$.next(false),
        );
      }),
      ignoreElements(),
    );

    return combineLatest([inputText$, brandGuide$, numDesigns$, isGenerating$, apiKeys$]).pipe(
      map(([inputText, brandGuide, numDesigns, isGenerating, apiKeys]) => {
        return html`
          <div class="design-tool">
            <textarea
              class="design-input"
              rows="3"
              placeholder="Describe your design requirements here..."
              .value=${inputText}
              @input=${(e: Event) => inputText$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>

            <textarea
              class="brand-guide-input"
              rows="4"
              placeholder="Optional brand guide..."
              .value=${brandGuide}
              @input=${(e: Event) => brandGuide$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>

            <div class="generate-row">
              <label for="design-count">Count</label>
              <input
                type="number"
                id="design-count"
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
