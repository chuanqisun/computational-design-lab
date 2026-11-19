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
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import type { ApiKeys } from "../../connections/storage";

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

    void persistSubject(blendInstruction$, "context-tray:blend:instruction");

    const runtime = getActionRuntime(items$, apiKeys$);

    const blendEffect$ = blend$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(blendInstruction$, selected$),
      tap(([_, instruction, selected]) => {
        blend$.next(false);
        if (selected.length < 2 || !instruction.trim()) return;
        runUserAction(runtime, "blend_images", {
          instruction: instruction.trim(),
          cardIds: selected.map((item) => item.id),
        });
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
