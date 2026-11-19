import { html } from "lit-html";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  EMPTY,
  filter,
  ignoreElements,
  map,
  merge,
  mergeMap,
  mergeWith,
  tap,
  withLatestFrom,
  type Observable,
} from "rxjs";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { generateImage, type GeminiConnection } from "../../design/generate-image-gemini";
import { searchImages, streamSearchResults$ } from "../llm/search-images";
import { submitTask } from "../tasks";
import "./new-prompt.tool.css";

export const NewPromptTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const prompt$ = new BehaviorSubject("");
    const render$ = new BehaviorSubject(false);
    const write$ = new BehaviorSubject(false);
    const search$ = new BehaviorSubject(false);

    void persistSubject(prompt$, "context-tray:new:prompt");

    const renderEffect$ = render$.pipe(
      filter(Boolean),
      tap(() => render$.next(false)),
      withLatestFrom(prompt$, selected$, apiKeys$),
      tap(([_, prompt, selected, apiKeys]) => {
        if (!prompt.trim() || !apiKeys.gemini) return;

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
            const canvasElement = document.querySelector("[data-canvas]") as HTMLElement | null;
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

    const writeEffect$ = write$.pipe(
      filter(Boolean),
      tap(() => write$.next(false)),
      withLatestFrom(prompt$, apiKeys$),
      tap(([_, inputText, apiKeys]) => {
        const trimmed = inputText.trim();
        if (!trimmed || !apiKeys.gemini) return;

        const isTitle = trimmed.split(/\s+/).length < 5 && !trimmed.includes("\n");
        const canvasElement = document.querySelector("[data-canvas]") as HTMLElement | null;
        const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
        const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);

        const card: CanvasItem = {
          id: `writer-${Date.now()}`,
          title: isTitle ? trimmed : undefined,
          body: isTitle ? undefined : trimmed,
          x: center.x - 100,
          y: center.y - 150,
          width: 200,
          height: 300,
          isSelected: false,
          zIndex: maxZ + 1,
        };

        items$.next([...items$.value, card]);
        prompt$.next("");
      }),
      ignoreElements(),
    );

    const searchEffect$ = search$.pipe(
      filter(Boolean),
      tap(() => search$.next(false)),
      withLatestFrom(prompt$, selected$, apiKeys$),
      filter(([_, prompt, __, apiKeys]) => Boolean(prompt.trim() && apiKeys.gemini)),
      tap(([_, prompt, selected, apiKeys]) => {
        const apiKey = apiKeys.gemini!;
        const trimmedPrompt = prompt.trim();
        const cardContext = selected
          .flatMap((card) => [card.title, card.body, card.imagePrompt])
          .filter(Boolean)
          .join("\n");
        const images = selected.flatMap((card) => (card.imageSrc ? [card.imageSrc] : []));

        const canvas = document.querySelector("[data-canvas]") as HTMLElement | null;
        const center = canvas ? getViewportCenter(canvas) : { x: 400, y: 300 };
        const cardWidth = 200;
        const cardHeight = 300;
        const gap = 16;
        const gridWidth = cardWidth * 3 + gap * 2;
        const gridHeight = cardHeight * 3 + gap * 2;
        const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
        const sourceId = `search-${crypto.randomUUID()}`;

        const task$ = streamSearchResults$({
          apiKey,
          prompt: trimmedPrompt,
          contextText: cardContext,
          images,
          maxResults: 9,
        }).pipe(
          mergeMap((result, index) => {
            const cardId = `${sourceId}-${index + 1}`;
            const card: CanvasItem = {
              id: cardId,
              title: result.title,
              body: result.details,
              x: center.x - gridWidth / 2 + (index % 3) * (cardWidth + gap),
              y: center.y - gridHeight / 2 + Math.floor(index / 3) * (cardHeight + gap),
              width: cardWidth,
              height: cardHeight,
              isSelected: false,
              zIndex: maxZ + index + 1,
              metadata: {
                source: "gemini-image-search",
                sourceId,
                prompt: trimmedPrompt,
                pendingImage: true,
              },
            };
            items$.next([...items$.value, card]);

            const imagePrompt = `Search for and generate a clear, representative visual reference image of "${result.title}". ${result.details}\nSearch topic: ${trimmedPrompt}. Clean single-subject presentation, no text labels or watermarks.`;
            return searchImages(apiKey, imagePrompt).pipe(
              tap((imageResult) => {
                items$.next(
                  items$.value.map((item) =>
                    item.id === cardId
                      ? {
                          ...item,
                          imageSrc: imageResult.url,
                          metadata: {
                            ...item.metadata,
                            pendingImage: false,
                            searchSuggestions: imageResult.searchSuggestions,
                          },
                        }
                      : item,
                  ),
                );
              }),
              catchError((error) => {
                console.error(`Search image generation failed for "${result.title}":`, error);
                items$.next(
                  items$.value.map((item) =>
                    item.id === cardId ? { ...item, metadata: { ...item.metadata, pendingImage: false } } : item,
                  ),
                );
                return EMPTY;
              }),
            );
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    return combineLatest([prompt$, apiKeys$]).pipe(
      map(([prompt, apiKeys]) => {
        const disabled = !prompt.trim() || !apiKeys.gemini;
        const disabledTitle = !apiKeys.gemini ? "Gemini API key required" : "";

        return html`
          <div class="new-prompt-tool">
            <textarea
              rows="2"
              placeholder="Describe an image to render, write a note, or search references..."
              .value=${prompt}
              @input=${(event: Event) => prompt$.next((event.target as HTMLTextAreaElement).value)}
            ></textarea>
            <div class="actions">
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => render$.next(true)}>Render</button>
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => write$.next(true)}>Write</button>
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => search$.next(true)}>Search</button>
            </div>
          </div>
        `;
      }),
      mergeWith(merge(renderEffect$, writeEffect$, searchEffect$)),
    );
  },
);
