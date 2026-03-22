import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeMap,
  mergeWith,
  type Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import { persistSubject } from "../../../lib/persistence";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { generatePersonas$, rankDesigns$ } from "../llm/synthetic-users";
import { submitTask } from "../tasks";
import {
  buildGridConfig,
  getFeedbackPosition,
  getHeaderItemPosition,
  getPersonaPosition,
  getRankedItemPosition,
} from "./user-testing-layout";
import "./user-testing.css";

export const UserTestingTool = createComponent(
  ({
    selected$,
    apiKeys$,
    items$,
  }: {
    selected$: Observable<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    items$: BehaviorSubject<CanvasItem[]>;
  }) => {
    const trait$ = new BehaviorSubject<string>("");
    const segment$ = new BehaviorSubject<string>("All");
    const numUsers$ = new BehaviorSubject<number>(3);
    const isRunning$ = new BehaviorSubject<boolean>(false);
    const progressMsg$ = new BehaviorSubject<string>("");
    const startAction$ = new BehaviorSubject<boolean>(false);

    void persistSubject(trait$, "context-tray:user-testing:trait");
    void persistSubject(segment$, "context-tray:user-testing:segment");
    void persistSubject(numUsers$, "context-tray:user-testing:num-users");

    const startEffect$ = startAction$.pipe(
      filter((v) => v === true),
      tap(() => startAction$.next(false)),
      withLatestFrom(selected$, trait$, segment$, numUsers$, apiKeys$),
      tap(([_, selectedItems, trait, segment, numUsers, apiKeys]) => {
        if (selectedItems.length === 0 || !apiKeys.gemini || !trait.trim()) return;

        isRunning$.next(true);
        progressMsg$.next("Generating personas...");

        const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex ?? 0), 0);
        const origin = {
          x: Math.min(...selectedItems.map((i) => i.x)),
          y: Math.min(...selectedItems.map((i) => i.y)),
        };
        const config = buildGridConfig(selectedItems, numUsers, origin, { colGap: 20, rowGap: 20 });

        // Move original items to header row positions
        const movedItems = items$.value.map((item) => {
          const idx = selectedItems.findIndex((s) => s.id === item.id);
          if (idx >= 0) {
            const pos = getHeaderItemPosition(idx, config);
            return { ...item, x: pos.x, y: pos.y, width: pos.width, height: pos.height };
          }
          return item;
        });
        items$.next(movedItems);

        const task$ = generatePersonas$({
          trait: trait.trim(),
          segment: segment || "All",
          numUsers,
          apiKey: apiKeys.gemini,
        }).pipe(
          mergeMap((persona, userIndex) => {
            progressMsg$.next(`Ranking for ${persona.name}...`);

            const personaPos = getPersonaPosition(userIndex, config);
            const personaCard: CanvasItem = {
              id: `persona-${Date.now()}-${Math.random()}`,
              title: persona.name,
              body: `${persona.occupation}, age ${persona.age}\n${persona.description}`,
              x: personaPos.x,
              y: personaPos.y,
              width: personaPos.width,
              height: personaPos.height,
              zIndex: maxZ + 1 + userIndex,
              isSelected: false,
            };
            items$.next([...items$.value, personaCard]);

            return rankDesigns$({
              persona,
              items: selectedItems,
              trait: trait.trim(),
              apiKey: apiKeys.gemini!,
            }).pipe(
              tap((ranking) => {
                const newCards: CanvasItem[] = [];

                ranking.rankedItemIds.forEach((itemId, rankPosition) => {
                  const original = selectedItems.find((i) => i.id === itemId);
                  if (!original) return;
                  const pos = getRankedItemPosition(userIndex, rankPosition, config);
                  newCards.push({
                    id: `ranked-${Date.now()}-${Math.random()}`,
                    title: original.title,
                    body: original.body,
                    imageSrc: original.imageSrc,
                    imagePrompt: original.imagePrompt,
                    x: pos.x,
                    y: pos.y,
                    width: pos.width,
                    height: pos.height,
                    zIndex: maxZ + 10 + userIndex * 10 + rankPosition,
                    isSelected: false,
                  });
                });

                const feedbackPos = getFeedbackPosition(userIndex, config);
                newCards.push({
                  id: `feedback-${Date.now()}-${Math.random()}`,
                  title: `${persona.name}'s Feedback`,
                  body: ranking.feedback,
                  x: feedbackPos.x,
                  y: feedbackPos.y,
                  width: feedbackPos.width,
                  height: feedbackPos.height,
                  zIndex: maxZ + 10 + userIndex * 10 + config.numItems,
                  isSelected: false,
                });

                items$.next([...items$.value, ...newCards]);
              }),
            );
          }),
          tap({
            complete: () => {
              isRunning$.next(false);
              progressMsg$.next("");
            },
            error: () => {
              isRunning$.next(false);
              progressMsg$.next("Error occurred");
            },
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([selected$, trait$, segment$, numUsers$, isRunning$, progressMsg$, apiKeys$]).pipe(
      map(([selected, trait, segment, numUsers, isRunning, progressMsg, apiKeys]) => {
        if (selected.length === 0) return html``;

        return html`
          <div class="user-testing">
            <div class="field">
              <label for="user-testing-trait">Trait</label>
              <input
                type="text"
                id="user-testing-trait"
                placeholder="e.g. playfulness"
                .value=${trait}
                @input=${(e: Event) => trait$.next((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label for="user-testing-segment">Segment</label>
              <input
                type="text"
                id="user-testing-segment"
                placeholder="All"
                .value=${segment}
                @input=${(e: Event) => segment$.next((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label for="user-testing-users">Users</label>
              <input
                type="number"
                id="user-testing-users"
                min="1"
                max="5"
                .value=${String(numUsers)}
                @input=${(e: Event) => numUsers$.next(parseInt((e.target as HTMLInputElement).value) || 3)}
              />
            </div>
            ${progressMsg ? html`<div class="progress-msg">${progressMsg}</div>` : html``}
            <button @click=${() => startAction$.next(true)} ?disabled=${isRunning || !apiKeys.gemini || !trait.trim()}>
              ${isRunning ? "Running..." : "Start"}
            </button>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(startEffect$));
  },
);
