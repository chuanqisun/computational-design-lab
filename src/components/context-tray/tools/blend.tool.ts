import { html } from "lit-html";
import { BehaviorSubject, EMPTY, ignoreElements, map, mergeMap, mergeWith, tap, withLatestFrom } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { ImageItem } from "../../canvas/canvas.component";
import { getCaption } from "../../canvas/get-caption";
import type { ApiKeys } from "../../connections/storage";
import { blendImages } from "../blend-images";

export const BlendTool = createComponent(
  ({
    selectedImages,
    images$,
    apiKeys$,
  }: {
    selectedImages: ImageItem[];
    images$: BehaviorSubject<ImageItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const blendInstruction$ = new BehaviorSubject<string>("");
    const blend$ = new BehaviorSubject<void>(undefined);

    const blendEffect$ = blend$.pipe(
      withLatestFrom(blendInstruction$, apiKeys$),
      mergeMap(([_, instruction, apiKeys]) => {
        if (selectedImages.length < 2 || !instruction.trim() || !apiKeys.gemini) {
          return EMPTY;
        }
        return blendImages({ instruction: instruction.trim(), images: selectedImages, apiKey: apiKeys.gemini }).pipe(
          mergeMap((blendedSrc) => {
            const newImage: ImageItem = {
              id: `blended-${Date.now()}`,
              src: blendedSrc,
              x: Math.random() * 400,
              y: Math.random() * 400,
              width: 200,
              height: 200,
              caption: `(blended)`,
              isSelected: false,
            };
            images$.next([...images$.value, newImage]);

            if (apiKeys.openai) {
              return getCaption(blendedSrc, apiKeys.openai).pipe(
                tap((caption) => {
                  const current = images$.value;
                  const updated = current.map((img) => (img.id === newImage.id ? { ...img, caption } : img));
                  images$.next(updated);
                }),
              );
            } else {
              return EMPTY;
            }
          }),
        );
      }),
      ignoreElements(),
    );

    const template$ = blendInstruction$.pipe(
      map((instruction) => {
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
