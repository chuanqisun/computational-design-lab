import { html } from "lit-html";
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  mergeWith,
  of,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { progress$ } from "../progress/progress";
import { fillCard } from "./ai-helpers";
import type { CanvasItem } from "./canvas.component";

function isSameRenderableItem(prev: CanvasItem, curr: CanvasItem): boolean {
  return (
    prev.id === curr.id &&
    prev.x === curr.x &&
    prev.y === curr.y &&
    prev.width === curr.width &&
    prev.height === curr.height &&
    prev.zIndex === curr.zIndex &&
    prev.isSelected === curr.isSelected &&
    prev.title === curr.title &&
    prev.body === curr.body &&
    prev.imageSrc === curr.imageSrc &&
    prev.imagePrompt === curr.imagePrompt
  );
}

export const CardComponent = createComponent(
  (props: {
    id: string;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    onUpdate: (updates: Partial<CanvasItem>) => void;
    onOpen: () => void;
    onMouseDown: (e: MouseEvent) => void;
  }) => {
    const item$ = props.items$.pipe(
      map((items) => items.find((i) => i.id === props.id)),
      filter((item): item is CanvasItem => item !== undefined),
      distinctUntilChanged(isSameRenderableItem),
    );

    const isGenerating$ = new BehaviorSubject(false);

    // Effects
    const autoGenerateEffect$ = item$.pipe(
      withLatestFrom(props.apiKeys$),
      filter(([item, apiKeys]) => {
        const apiKey = apiKeys.gemini;
        if (!apiKey) return false;

        const hasContent = !!(item.title || item.body || item.imageSrc || item.imagePrompt);
        const missingFields = !item.title || !item.body || (!item.imagePrompt && !item.imageSrc);

        return hasContent && missingFields;
      }),
      debounceTime(2000),
      tap(() => {
        isGenerating$.next(true);
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      }),
      switchMap(([item, apiKeys]) => {
        const content = {
          title: item.title,
          body: item.body,
          imagePrompt: item.imagePrompt,
          imageSrc: item.imageSrc,
        };

        return fillCard(content, apiKeys.gemini!).pipe(
          tap((updates) => {
            isGenerating$.next(false);
            progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
            if (Object.keys(updates).length > 0) {
              props.onUpdate(updates);
            }
          }),
          catchError((err) => {
            console.error("Auto-generate failed", err);
            isGenerating$.next(false);
            progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
            return of(null);
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = item$.pipe(
      map(
        (item) => html`
          <div
            class="canvas-card ${item.isSelected ? "selected" : ""}"
            data-id="${item.id}"
            style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex ||
            0};"
            @mousedown=${props.onMouseDown}
          >
            <div class="card-image-area">
              ${item.imageSrc
                ? html`<img src="${item.imageSrc}" alt="${item.title || "Image"}" />`
                : item.imagePrompt
                  ? html`<generative-image
                      prompt="${item.imagePrompt}"
                      width="${item.width}"
                      height="${item.width}"
                      @image-loaded=${(e: CustomEvent) => props.onUpdate({ imageSrc: e.detail.url })}
                    ></generative-image>`
                  : html`<div class="card-placeholder-image">No image</div>`}
            </div>
            <div class="card-text-area">
              ${item.title
                ? html`<div class="card-title">${item.title}</div>`
                : html`<div class="card-title placeholder">Untitled</div>`}
              ${item.body
                ? html`<div class="card-body">${item.body}</div>`
                : html`<div class="card-body placeholder">No description</div>`}
            </div>
            <button
              class="card-open-button"
              data-card-open
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                props.onOpen();
              }}
            >
              Open
            </button>
          </div>
        `,
      ),
    );

    return template$.pipe(mergeWith(autoGenerateEffect$));
  },
);
