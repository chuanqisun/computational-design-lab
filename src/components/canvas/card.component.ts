import { html } from "lit-html";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  ignoreElements,
  map,
  mergeWith,
  of,
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
    prev.imagePrompt === curr.imagePrompt &&
    prev.videoSrc === curr.videoSrc &&
    prev.videoMimeType === curr.videoMimeType &&
    prev.videoPosterSrc === curr.videoPosterSrc
  );
}

export const CardComponent = createComponent(
  (props: {
    id: string;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    onUpdate: (id: string, updates: Partial<CanvasItem>) => void;
    onOpen: (id: string) => void;
    onMouseDown: (id: string, e: MouseEvent) => void;
  }) => {
    const item$ = props.items$.pipe(
      map((items) => items.find((i) => i.id === props.id)),
      filter((item): item is CanvasItem => item !== undefined),
      distinctUntilChanged(isSameRenderableItem),
    );

    const isGenerating$ = new BehaviorSubject(false);
    const isPlaying$ = new BehaviorSubject(false);
    const generatedSignatures$ = new BehaviorSubject<Set<string>>(new Set());

    const stopVideoControlEvent = (event: Event) => event.stopPropagation();

    const toggleVideoPlayback = async (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const button = event.currentTarget as HTMLButtonElement;
      const video = button.parentElement?.querySelector("video");
      if (!video) return;

      if (!video.paused) {
        video.pause();
        return;
      }

      try {
        await video.play();
      } catch (error) {
        isPlaying$.next(false);
        console.error("Video playback failed", error);
      }
    };

    const getGenerationSignature = (item: CanvasItem): string => {
      const title = item.title?.trim() || "";
      const body = item.body?.trim() || "";
      const imagePrompt = item.imagePrompt?.trim() || "";
      const imageSrc = item.imageSrc?.trim() || "";
      const videoSrc = item.videoSrc?.trim() || "";
      const videoMimeType = item.videoMimeType?.trim() || "";
      return `${title}||${body}||${imagePrompt}||${imageSrc}||${videoSrc}||${videoMimeType}`;
    };

    // Effects
    const autoGenerateEffect$ = item$.pipe(
      withLatestFrom(props.apiKeys$),
      map(([item, apiKeys]) => ({
        item,
        apiKey: apiKeys.gemini,
        signature: getGenerationSignature(item),
      })),
      filter(({ item, apiKey }) => {
        if (!apiKey) return false;

        const hasContent = !!(item.title || item.body || item.imageSrc || item.imagePrompt || item.videoSrc);
        const missingText = !item.title || !item.body;
        const missingImage = !item.videoSrc && !item.imagePrompt && !item.imageSrc;

        return hasContent && (missingText || missingImage);
      }),
      distinctUntilChanged((prev, curr) => prev.signature === curr.signature && prev.apiKey === curr.apiKey),
      filter(({ signature }) => !generatedSignatures$.value.has(signature)),
      debounceTime(100),
      exhaustMap(({ item, apiKey, signature }) => {
        const content = {
          title: item.title,
          body: item.body,
          imagePrompt: item.imagePrompt,
          imageSrc: item.imageSrc,
          videoSrc: item.videoSrc,
          videoMimeType: item.videoMimeType,
        };

        isGenerating$.next(true);
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });

        return fillCard(content, apiKey!).pipe(
          tap((updates) => {
            const currentItem = props.items$.value.find((candidate) => candidate.id === item.id);
            if (!currentItem || getGenerationSignature(currentItem) !== signature) return;

            generatedSignatures$.next(new Set(generatedSignatures$.value).add(signature));
            if (Object.keys(updates).length > 0) {
              props.onUpdate(item.id, updates);
            }
          }),
          catchError((err) => {
            console.error("Auto-generate failed", err);
            return of(null);
          }),
          finalize(() => {
            isGenerating$.next(false);
            progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([item$, isPlaying$]).pipe(
      map(
        ([item, isPlaying]) => html`
          <div
            class="canvas-card ${item.isSelected ? "selected" : ""}"
            data-id="${item.id}"
            style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${item.zIndex ||
            0};"
            @mousedown=${(e: MouseEvent) => props.onMouseDown(item.id, e)}
          >
            <div class="card-media-area">
              ${item.videoSrc
                ? html`<video
                      class="card-video"
                      src="${item.videoSrc}"
                      poster="${item.videoPosterSrc || ""}"
                      preload="metadata"
                      playsinline
                      @play=${() => isPlaying$.next(true)}
                      @pause=${() => isPlaying$.next(false)}
                      @ended=${() => isPlaying$.next(false)}
                    ></video>
                    <button
                      class="card-video-control"
                      data-card-video-control
                      type="button"
                      aria-label=${isPlaying ? "Pause video" : "Play video"}
                      title=${isPlaying ? "Pause video" : "Play video"}
                      @mousedown=${stopVideoControlEvent}
                      @keydown=${stopVideoControlEvent}
                      @click=${toggleVideoPlayback}
                    >
                      ${isPlaying ? "Ⅱ" : "▶"}
                    </button>`
                : item.imageSrc
                  ? html`<img src="${item.imageSrc}" alt="${item.title || "Image"}" />`
                  : item.imagePrompt
                    ? html`<generative-image
                        prompt="${item.imagePrompt}"
                        width="${item.width}"
                        height="${item.width}"
                        @image-loaded=${(e: CustomEvent) => props.onUpdate(item.id, { imageSrc: e.detail.url })}
                      ></generative-image>`
                    : html`<div class="card-placeholder-image">No media</div>`}
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
                props.onOpen(item.id);
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
