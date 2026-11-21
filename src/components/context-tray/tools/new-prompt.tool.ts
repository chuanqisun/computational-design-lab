import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  merge,
  mergeWith,
  tap,
  withLatestFrom,
  type Observable,
} from "rxjs";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import "./new-prompt.tool.css";

export const NewPromptTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const prompt$ = new BehaviorSubject("");
    const render$ = new BehaviorSubject(false);
    const write$ = new BehaviorSubject(false);
    const search$ = new BehaviorSubject(false);

    void persistSubject(prompt$, "context-tray:new:prompt");

    const runtime = getActionRuntime(items$, apiKeys$);

    const renderEffect$ = render$.pipe(
      filter(Boolean),
      tap(() => render$.next(false)),
      withLatestFrom(prompt$, selected$),
      tap(([_, prompt, selected]) => {
        if (!prompt.trim()) return;
        runUserAction(runtime, "render_image", { prompt: prompt.trim(), cardIds: selected.map((item) => item.id) });
      }),
      ignoreElements(),
    );

    const writeEffect$ = write$.pipe(
      filter(Boolean),
      tap(() => write$.next(false)),
      withLatestFrom(prompt$),
      tap(([_, inputText]) => {
        const trimmed = inputText.trim();
        if (!trimmed) return;
        runUserAction(runtime, "add_card", { text: trimmed });
        prompt$.next("");
      }),
      ignoreElements(),
    );

    const searchEffect$ = search$.pipe(
      filter(Boolean),
      tap(() => search$.next(false)),
      withLatestFrom(prompt$, selected$),
      filter(([_, prompt]) => Boolean(prompt.trim())),
      tap(([_, prompt, selected]) => {
        runUserAction(runtime, "search_references", {
          prompt: prompt.trim(),
          cardIds: selected.map((item) => item.id),
          maxResults: 8,
        });
      }),
      ignoreElements(),
    );

    return combineLatest([prompt$, apiKeys$]).pipe(
      map(([prompt, apiKeys]) => {
        const disabled = !prompt.trim() || !apiKeys.gemini;
        const disabledTitle = !apiKeys.gemini ? "Gemini API key required" : "";

        return html`
          <div class="new-prompt-tool">
            <textarea
              rows="2"
              placeholder="Describe an image to render, write a note, or search references..."
              .value=${prompt}
              @input=${(event: Event) => prompt$.next((event.target as HTMLTextAreaElement).value)}
            ></textarea>
            <div class="actions">
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => render$.next(true)}>Render</button>
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => write$.next(true)}>Write</button>
              <button ?disabled=${disabled} title=${disabledTitle} @click=${() => search$.next(true)}>Search</button>
            </div>
          </div>
        `;
      }),
      mergeWith(merge(renderEffect$, writeEffect$, searchEffect$)),
    );
  },
);
