import { html } from "lit-html";
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, map, of, type Observable } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
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
    prev.videoPosterSrc === curr.videoPosterSrc &&
    prev.metadata?.pending === curr.metadata?.pending
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
    /** Ids that would be selected if the in-progress marquee were released; null when not dragging. */
    selectionPreview$?: Observable<ReadonlySet<string> | null>;
  }) => {
    const item$ = props.items$.pipe(
      map((items) => items.find((i) => i.id === props.id)),
      filter((item): item is CanvasItem => item !== undefined),
      distinctUntilChanged(isSameRenderableItem),
    );

    // undefined = no preview in progress; otherwise whether this card would end up selected.
    const previewSelected$ = (props.selectionPreview$ ?? of(null)).pipe(
      map((preview) => (preview ? preview.has(props.id) : undefined)),
      distinctUntilChanged(),
    );

    const isPlaying$ = new BehaviorSubject(false);

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

    // Card fill/render now lives in the action layer (src/lib/actions/card-fill.ts); the card only renders state.
    const pendingLabel: Record<string, string> = {
      fill: "Writing…",
      image: "Rendering…",
      video: "Directing…",
      search: "Searching…",
    };

    const template$ = combineLatest([item$, isPlaying$, previewSelected$]).pipe(
      map(([item, isPlaying, previewSelected]) => {
        const pending = item.metadata?.pending as string | undefined;
        const selected = previewSelected ?? item.isSelected;
        return html`
          <div
            class="canvas-card ${selected ? "selected" : ""} ${pending ? "pending" : ""}"
            data-id="${item.id}"
            style="left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; z-index: ${
              item.zIndex || 0
            };"
            @mousedown=${(e: MouseEvent) => props.onMouseDown(item.id, e)}
          >
            <div class="card-media-area">
              ${
                item.videoSrc
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
                    : pending
                      ? html`<div class="card-placeholder-image card-pending">
                          ${pendingLabel[pending] ?? "Working…"}
                        </div>`
                      : item.imagePrompt
                        ? html`<generative-image
                            prompt="${item.imagePrompt}"
                            width="${item.width}"
                            height="${item.width}"
                            @image-loaded=${(e: CustomEvent) => props.onUpdate(item.id, { imageSrc: e.detail.url })}
                          ></generative-image>`
                        : html`<div class="card-placeholder-image">No media</div>`
              }
            </div>
            <div class="card-text-area">
              ${
                item.title
                  ? html`<div class="card-title">${item.title}</div>`
                  : html`<div class="card-title placeholder">Untitled</div>`
              }
              ${
                item.body
                  ? html`<div class="card-body">${item.body}</div>`
                  : html`<div class="card-body placeholder">No description</div>`
              }
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
        `;
      }),
    );

    return template$;
  },
);
