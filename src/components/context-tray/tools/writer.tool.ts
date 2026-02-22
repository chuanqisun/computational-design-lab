import { html } from "lit-html";
import { BehaviorSubject, filter, ignoreElements, map, mergeWith, tap, withLatestFrom, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { generateTitle$ } from "../llm/generate-title-gemini";
import { submitTask } from "../tasks";

export const WriterTool = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: Observable<ApiKeys> }) => {
    const inputText$ = new BehaviorSubject<string>("");
    const write$ = new BehaviorSubject<boolean>(false);

    const writeEffect$ = write$.pipe(
      filter((trigger) => trigger === true),
      withLatestFrom(inputText$, apiKeys$),
      tap(([_, inputText, apiKeys]) => {
        write$.next(false);

        const trimmed = inputText.trim();
        if (!trimmed || !apiKeys.gemini) {
          return;
        }

        const task$ = generateTitle$({ text: trimmed, apiKey: apiKeys.gemini }).pipe(
          map((caption) => {
            const canvasElement = document.querySelector("[data-canvas]") as HTMLElement;
            const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
            const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);

            const card: CanvasItem = {
              id: `writer-${Date.now()}`,
              title: caption || "Text",
              body: trimmed,
              imagePrompt: trimmed,
              x: center.x - 100,
              y: center.y - 150,
              width: 200,
              height: 300,
              isSelected: false,
              zIndex: maxZ + 1,
            };

            items$.next([...items$.value, card]);
            inputText$.next("");
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = inputText$.pipe(
      map(
        (inputText) => html`
          <div class="blend-section">
            <textarea
              placeholder="Write something to add on canvas..."
              .value=${inputText}
              @input=${(e: Event) => inputText$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${() => write$.next(true)}>Write</button>
          </div>
        `,
      ),
    );

    return template$.pipe(mergeWith(writeEffect$));
  },
);
