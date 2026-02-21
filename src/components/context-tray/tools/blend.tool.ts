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
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { blendImages } from "../llm/blend-images";
import { submitTask } from "../tasks";

export const BlendTool = createComponent(
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
    const blendInstruction$ = new BehaviorSubject<string>("");
    const blend$ = new BehaviorSubject<boolean>(false);

    const selectedItems$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([images, texts]) => [...images, ...texts]),
    );

    const blendEffect$ = blend$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(blendInstruction$, selectedItems$, apiKeys$),
      tap(([_, instruction, selectedItems, apiKeys]) => {
        blend$.next(false);

        if (selectedItems.length < 2 || !instruction.trim() || !apiKeys.gemini) {
          return;
        }

        const positionGenerator = getNextPositions(items$.value.filter((item) => item.isSelected));
        const task$ = blendImages({
          instruction: instruction.trim(),
          items: selectedItems,
          apiKey: apiKeys.gemini,
        }).pipe(
          map((blendedSrc) => {
            const { x, y, z } = positionGenerator.next().value;
            const newImage: CanvasItem = {
              id: `blended-${Date.now()}`,
              type: "image",
              src: blendedSrc,
              x,
              y,
              width: 200,
              height: 200,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, newImage]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([blendInstruction$, selectedItems$]).pipe(
      map(([instruction, selectedItems]) => {
        if (selectedItems.length < 2) return html``;
        return html`
          <div class="blend-section">
            <textarea
              placeholder="Enter blending instruction..."
              .value=${instruction}
              @input=${(e: Event) => blendInstruction$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${() => blend$.next(true)}>Blend</button>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(blendEffect$));
  },
);
