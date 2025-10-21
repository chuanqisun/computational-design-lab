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
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { generateImage, type GeminiConnection } from "../../design/generate-image-gemini";
import { submitTask } from "../tasks";

export const RenderTool = createComponent(
  ({
    selectedTexts$,
    selectedImages$,
    items$,
    apiKeys$,
  }: {
    selectedTexts$: Observable<TextItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    selectedImages$: Observable<ImageItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const prompt$ = new BehaviorSubject<string>("");
    const render$ = new BehaviorSubject<boolean>(false);

    const renderEffect$ = render$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(prompt$, selectedTexts$, selectedImages$, apiKeys$),
      tap(([_, prompt, selectedTexts, selectedImages, apiKeys]) => {
        render$.next(false);

        if (!prompt.trim() || !apiKeys.gemini) {
          return;
        }

        const fullPrompt = [prompt, ...selectedTexts.map((txt) => txt.content)].join(" ");
        const images = selectedImages.map((img) => img.src);
        const connection: GeminiConnection = { apiKey: apiKeys.gemini };

        const task$ = generateImage(connection, {
          prompt: fullPrompt,
          width: 512,
          height: 512,
          images: images.length > 0 ? images : undefined,
        }).pipe(
          map((result) => {
            const newImage: CanvasItem = {
              id: `rendered-${Date.now()}`,
              type: "image",
              src: result.url,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              isSelected: false,
            };
            items$.next([...items$.value, newImage]);
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
