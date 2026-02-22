import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeWith,
  tap,
  withLatestFrom,
  type Observable,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { generateImage, type GeminiConnection } from "../../design/generate-image-gemini";
import { submitTask } from "../tasks";

export const RenderTool = createComponent(
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
    const render$ = new BehaviorSubject<boolean>(false);

    const renderEffect$ = render$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(prompt$, selected$, apiKeys$),
      tap(([_, prompt, selected, apiKeys]) => {
        render$.next(false);

        if (!prompt.trim() || !apiKeys.gemini) {
          return;
        }

        const fullPrompt = [prompt, ...selected.filter((c) => c.body).map((c) => c.body)].join(" ");
        const images = selected.filter((c) => c.imageSrc).map((c) => c.imageSrc!);
        const connection: GeminiConnection = { apiKey: apiKeys.gemini };

        const task$ = generateImage(connection, {
          prompt: fullPrompt,
          width: 512,
          height: 512,
          images: images.length > 0 ? images : undefined,
        }).pipe(
          map((result) => {
            const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
            const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };

            const card: CanvasItem = {
              id: `rendered-${Date.now()}`,
              imageSrc: result.url,
              x: center.x - 100,
              y: center.y - 150,
              width: 200,
              height: 300,
              isSelected: false,
            };
            items$.next([...items$.value, card]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([prompt$]).pipe(
      map(([prompt]) => {
        return html`
          <div class="render-section">
            <textarea
              placeholder="Enter render prompt..."
              .value=${prompt}
              @input=${(e: Event) => prompt$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${() => render$.next(true)}>Render</button>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(renderEffect$));
  },
);
