import { html, render } from "lit-html";
import { ifDefined } from "lit-html/directives/if-defined.js";
import { from, merge, of, Subject, timer } from "rxjs";
import { catchError, distinctUntilChanged, map, share, switchMap, takeUntil } from "rxjs/operators";
import { getCachedImage, setCachedImage } from "../../lib/persistence";
import { generateVideo, type GeminiConnection } from "./generate-video-gemini";
import "./generative-video.css";

type Status = "empty" | "loading" | "error" | "success";

interface VideoState {
  status: Status;
  videoUrl?: string;
  placeholderUrl?: string;
  error?: string;
  autoPlay?: boolean;
  elapsedSeconds?: number;
}

interface VideoConnections {
  gemini: GeminiConnection;
}

export class GenerativeVideoElement extends HTMLElement {
  static getConnections: () => VideoConnections;
  static observedAttributes = ["prompt", "model", "aspect-ratio", "start-frame"];

  static define(getConnections: () => VideoConnections, tagName = "generative-video") {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, this);
      GenerativeVideoElement.getConnections = getConnections;
    }
  }

  private render$ = new Subject<void>();
  private retryCounter = 0;

  connectedCallback() {
    this.setupReactivity();
    this.render$.next();
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render$.next();
    }
  }

  retry() {
    this.retryCounter++;
    this.render$.next();
  }

  private setupReactivity() {
    const attributes$ = this.render$.pipe(
      map(() => ({
        prompt: this.getAttribute("prompt") ?? "",
        model: this.getAttribute("model") ?? "veo-3.1-generate-preview",
        aspectRatio: (this.getAttribute("aspect-ratio") as "16:9" | "9:16" | null) ?? "16:9",
        startFrame: this.getAttribute("start-frame") ?? undefined,
        retryCounter: this.retryCounter,
      })),
      distinctUntilChanged(
        (a, b) =>
          a.prompt === b.prompt &&
          a.model === b.model &&
          a.aspectRatio === b.aspectRatio &&
          a.startFrame === b.startFrame &&
          a.retryCounter === b.retryCounter,
      ),
    );

    const videoState$ = attributes$.pipe(
      switchMap((attrs) => {
        if (!attrs.prompt.trim()) {
          return of({
            status: "empty" as Status,
            placeholderUrl: attrs.startFrame || `https://placehold.co/1920x1080?text=No+Prompt`,
          });
        }

        const cacheKey = `video:${attrs.model}:${attrs.aspectRatio}:${attrs.prompt}:${attrs.startFrame ?? "none"}`;

        return from(getCachedImage(cacheKey)).pipe(
          switchMap((cachedUrl) => {
            if (cachedUrl && attrs.retryCounter === 0) {
              return of({
                status: "success" as Status,
                videoUrl: cachedUrl,
                autoPlay: false,
              });
            }

            const connections = GenerativeVideoElement.getConnections();

            const result$ = generateVideo(connections.gemini, {
              prompt: attrs.prompt,
              model: attrs.model,
              aspectRatio: attrs.aspectRatio as "16:9" | "9:16",
              startFrameUrl: attrs.startFrame,
            }).pipe(
              map((result) => {
                setCachedImage(cacheKey, result.url);
                return {
                  status: "success" as Status,
                  videoUrl: result.url,
                  autoPlay: true,
                };
              }),
              share(),
            );

            const loading$ = timer(0, 100).pipe(
              map((t) => ({
                status: "loading" as Status,
                placeholderUrl: attrs.startFrame || `https://placehold.co/1920x1080?text=Generating...`,
                elapsedSeconds: t / 10,
              })),
              takeUntil(result$),
            );

            return merge(loading$, result$).pipe(
              catchError((err) => {
                console.error("Video generation failed:", err);
                return of({
                  status: "error" as Status,
                  placeholderUrl: `https://placehold.co/1920x1080?text=Error`,
                  error: err.message,
                });
              }),
            );
          }),
        );
      }),
    );

    videoState$.subscribe((state) => {
      this.setAttribute("status", state.status);
      this.render(state);
    });
  }

  private render(state: VideoState) {
    const aspectRatio = this.getAttribute("aspect-ratio") ?? "16:9";
    const prompt = this.getAttribute("prompt");
    const template = html`
      <div
        class="generative-video"
        status="${state.status}"
        aspect-ratio="${aspectRatio}"
        title="${ifDefined(prompt ?? undefined)}"
      >
        ${state.status === "success" && state.videoUrl
          ? html`<video src="${state.videoUrl}" controls ?autoplay="${state.autoPlay}" loop playsinline></video>`
          : html`<img src="${ifDefined(state.placeholderUrl)}" alt="Video placeholder" />`}
        ${state.status === "loading" ? html`<div class="loader"></div>` : ""}
        ${state.status === "loading" && state.elapsedSeconds !== undefined
          ? html`<div class="elapsed">${state.elapsedSeconds.toFixed(1)}s</div>`
          : ""}
      </div>
    `;
    render(template, this);
  }
}
