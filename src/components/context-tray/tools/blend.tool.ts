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
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { blendImages } from "../llm/blend-images";
import { submitTask } from "../tasks";

export const BlendTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const blendInstruction$ = new BehaviorSubject<string>("");
    const blend$ = new BehaviorSubject<boolean>(false);

    const blendEffect$ = blend$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(blendInstruction$, selected$, apiKeys$),
      tap(([_, instruction, selected, apiKeys]) => {
        blend$.next(false);

        if (selected.length < 2 || !instruction.trim() || !apiKeys.gemini) {
          return;
        }

        const positionGenerator = getNextPositions(items$.value.filter((item) => item.isSelected));
        const task$ = blendImages({
          instruction: instruction.trim(),
          items: selected,
          apiKey: apiKeys.gemini,
        }).pipe(
          map((blendedSrc) => {
            const { x, y, z } = positionGenerator.next().value;
            const card: CanvasItem = {
              id: `blended-${Date.now()}`,
              imageSrc: blendedSrc,
              x,
              y,
              width: 200,
              height: 300,
              isSelected: false,
              zIndex: z,
            };
            items$.next([...items$.value, card]);
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([blendInstruction$, selected$]).pipe(
      map(([instruction, selected]) => {
        if (selected.length < 2) return html``;
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
