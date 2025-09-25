import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  ignoreElements,
  map,
  mergeMap,
  mergeWith,
  withLatestFrom,
  type Observable,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, ImageItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { blendImages } from "../blend-images";

export const BlendTool = createComponent(
  ({
    selectedImages$,
    items$,
    apiKeys$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const blendInstruction$ = new BehaviorSubject<string>("");
    const blend$ = new BehaviorSubject<void>(undefined);

    const blendEffect$ = blend$.pipe(
      withLatestFrom(blendInstruction$, selectedImages$, apiKeys$),
      mergeMap(([_, instruction, selectedImages, apiKeys]) => {
        if (selectedImages.length < 2 || !instruction.trim() || !apiKeys.gemini) {
          return EMPTY;
        }
        return blendImages({ instruction: instruction.trim(), images: selectedImages, apiKey: apiKeys.gemini }).pipe(
          map((blendedSrc) => {
            const newImage: CanvasItem = {
              id: `blended-${Date.now()}`,
              type: "image",
              src: blendedSrc,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              isSelected: false,
            };
            items$.next([...items$.value, newImage]);
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([blendInstruction$, selectedImages$]).pipe(
      map(([instruction, selectedImages]) => {
        if (selectedImages.length < 2) return html``;
        return html`
          <div class="blend-section">
            <textarea
              placeholder="Enter blending instruction..."
              .value=${instruction}
              @input=${(e: Event) => blendInstruction$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${() => blend$.next()}>Blend</button>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(blendEffect$));
  },
);
