import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeWith,
  switchMap,
  tap,
  withLatestFrom,
  type Observable,
} from "rxjs";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { segmentGridImage } from "../grid-fitting";
import { searchImages } from "../llm/search-images";
import { submitTask } from "../tasks";
import "./search.tool.css";

const GRID_PROMPT = `Search online to find the 9 most representative images for the request below. Display the images on a basic 3x3 grid. Each grid cell has #FFFFFF background. The grid gap is #000000. Page background is #000000. No text labels. Flat unstyled. \nRequest:`;

export const SearchTool = createComponent(
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
    const search$ = new BehaviorSubject(false);
    void persistSubject(prompt$, "context-tray:search:prompt");

    const effect$ = search$.pipe(
      filter(Boolean),
      tap(() => search$.next(false)),
      withLatestFrom(prompt$, selected$, apiKeys$),
      filter(([_, prompt, __, apiKeys]) => Boolean(prompt.trim() && apiKeys.gemini)),
      tap(([_, prompt, selected, apiKeys]) => {
        const apiKey = apiKeys.gemini!;
        const cardContext = selected
          .flatMap((card) => [card.title, card.body, card.imagePrompt])
          .filter(Boolean)
          .join("\n");
        const fullPrompt = `${GRID_PROMPT}\n${prompt.trim()}${cardContext ? `\nUse these selected cards as additional context:\n${cardContext}` : ""}`;
        const images = selected.flatMap((card) => (card.imageSrc ? [card.imageSrc] : []));

        const task$ = searchImages(apiKey, fullPrompt, images).pipe(
          switchMap(async (result) => ({ result, tiles: await segmentGridImage(result.url) })),
          tap(({ result, tiles }) => {
            const canvas = document.querySelector("[data-canvas]") as HTMLElement | null;
            const center = canvas ? getViewportCenter(canvas) : { x: 400, y: 300 };
            const cardWidth = 200;
            const cardHeight = 300;
            const gap = 16;
            const gridWidth = cardWidth * 3 + gap * 2;
            const gridHeight = cardHeight * 3 + gap * 2;
            const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
            const sourceId = `search-${crypto.randomUUID()}`;
            const additions: CanvasItem[] = tiles.map((tile, index) => ({
              id: `${sourceId}-${index + 1}`,
              imageSrc: tile.imageSrc,
              x: center.x - gridWidth / 2 + (index % 3) * (cardWidth + gap),
              y: center.y - gridHeight / 2 + Math.floor(index / 3) * (cardHeight + gap),
              width: cardWidth,
              height: cardHeight,
              isSelected: false,
              zIndex: maxZ + index + 1,
              metadata: {
                source: "gemini-image-search",
                sourceId,
                prompt: prompt.trim(),
                tile: { index, x: tile.x, y: tile.y, width: tile.width, height: tile.height, fill: tile.fill },
                searchSuggestions: result.searchSuggestions,
              },
            }));
            items$.next([...items$.value, ...additions]);
          }),
        );
        submitTask(task$);
      }),
      ignoreElements(),
    );

    return combineLatest([prompt$, apiKeys$]).pipe(
      map(
        ([prompt, apiKeys]) => html`
          <div class="search-tool">
            <textarea
              rows="2"
              placeholder="Find representative products, references, or projects..."
              .value=${prompt}
              @input=${(event: Event) => prompt$.next((event.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button
              ?disabled=${!prompt.trim() || !apiKeys.gemini}
              title=${!apiKeys.gemini ? "Gemini API key required" : ""}
              @click=${() => search$.next(true)}
            >
              Search
            </button>
          </div>
        `,
      ),
      mergeWith(effect$),
    );
  },
);
