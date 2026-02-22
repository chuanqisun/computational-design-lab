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
import type { CanvasItem, ImageItem, TextItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { generateImage } from "../../design/generate-image-gemini";
import { designConcepts$, type DesignInput } from "../llm/design-concepts";
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
    const inputText$ = new BehaviorSubject<string>("");
    const numDesigns$ = new BehaviorSubject<number>(1);
    const isGenerating$ = new BehaviorSubject(false);
    const performGenerate$ = new BehaviorSubject<boolean>(false);

    const effect$ = performGenerate$.pipe(
      filter((val) => val === true),
      tap(() => performGenerate$.next(false)), // reset
      withLatestFrom(selectedImages$, selectedTexts$, inputText$, numDesigns$, apiKeys$),
      filter(([_, images, texts]) => images.length > 0 || texts.length > 0),
      tap(([_, images, texts, requirements, numDesigns, apiKeys]) => {
        if (!apiKeys.gemini) return;
        isGenerating$.next(true);

        const designInputs: DesignInput[] = [
          ...images.map((img) => ({ src: img.src })),
          ...texts.map((txt) => ({ title: txt.title, content: txt.content })),
        ];

        const positionGenerator = getNextPositions([...images, ...texts]);

        const task$ = designConcepts$({
          items: designInputs,
          requirements,
          numDesigns,
          apiKey: apiKeys.gemini,
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

            if (concept.imagePrompt) {
              const imageTask$ = generateImage(
                { apiKey: apiKeys.gemini! },
                {
                  prompt: concept.imagePrompt,
                  width: 1024,
                  height: 1024,
                  aspectRatio: "1:1",
                },
              ).pipe(
                tap((result) => {
                  const { x: imgX, y: imgY, z: imgZ } = positionGenerator.next().value;
                  const newImage: CanvasItem = {
                    id: `image-${Date.now()}-${Math.random()}`,
                    type: "image",
                    title: concept.title,
                    src: result.url,
                    x: imgX,
                    y: imgY,
                    width: 200,
                    height: 200,
                    isSelected: false,
                    zIndex: imgZ,
                  };
                  items$.next([...items$.value, newImage]);
                }),
                ignoreElements(),
              );
              submitTask(imageTask$);
            }
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
