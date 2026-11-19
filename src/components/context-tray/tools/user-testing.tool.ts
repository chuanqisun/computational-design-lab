import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  finalize,
  ignoreElements,
  map,
  mergeMap,
  mergeWith,
  type Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import {
  resolveInterviewSelection,
  startLiveInterview,
  summarizeInterview$,
  type LiveInterviewSession,
} from "../llm/interview";
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
    const interviewState$ = new BehaviorSubject<"idle" | "connecting" | "active" | "summarizing">("idle");
    const progressMsg$ = new BehaviorSubject<string>("");
    const startAction$ = new BehaviorSubject<boolean>(false);
    let activeInterview: {
      session: LiveInterviewSession;
      personaCard: CanvasItem;
      contextItems: CanvasItem[];
      snapshot: CanvasItem[];
    } | null = null;

    const handleInterviewClick = async () => {
      if (interviewState$.value === "active" && activeInterview) {
        const current = activeInterview;
        activeInterview = null;
        const transcript = await current.session.stop();

        if (transcript.length === 0) {
          interviewState$.next("idle");
          progressMsg$.next("No conversation recorded to summarize.");
          return;
        }

        const apiKey = apiKeys$.value.gemini;
        if (!apiKey) {
          interviewState$.next("idle");
          progressMsg$.next("Gemini API key required to summarize interview.");
          return;
        }

        interviewState$.next("summarizing");
        progressMsg$.next("Summarizing interview...");

        const fallbackPos = {
          x: current.personaCard.x + current.personaCard.width + 20,
          y: current.personaCard.y,
          z: (current.personaCard.zIndex ?? 0) + 1,
        };
        const pos = getNextPositions(current.snapshot).next().value || fallbackPos;

        const summaryTask$ = summarizeInterview$({
          personaCard: current.personaCard,
          contextItems: current.contextItems,
          transcript,
          apiKey,
        }).pipe(
          tap((summary) => {
            const summaryCard: CanvasItem = {
              id: `interview-summary-${crypto.randomUUID()}`,
              title: summary.title,
              body: summary.body,
              x: pos.x,
              y: pos.y,
              width: 240,
              height: 300,
              zIndex: pos.z,
              isSelected: false,
              metadata: {
                kind: "interview-summary",
                personaCardId: current.personaCard.id,
                personaName: current.personaCard.title || "Synthetic User",
              },
            };
            items$.next([...items$.value, summaryCard]);
          }),
          tap({
            error: () => {
              progressMsg$.next("Failed to summarize interview.");
            },
          }),
          finalize(() => {
            interviewState$.next("idle");
            if (progressMsg$.value !== "Failed to summarize interview.") progressMsg$.next("");
          }),
        );

        submitTask(summaryTask$);
        return;
      }

      if (interviewState$.value !== "idle") return;

      const apiKey = apiKeys$.value.gemini;
      const snapshot = items$.value.filter((item) => item.isSelected);
      const selection = resolveInterviewSelection(snapshot);
      if (!apiKey || !selection.canInterview || !selection.personaCard) return;

      const personaCard = selection.personaCard;
      const contextItems = selection.contextItems;

      interviewState$.next("connecting");
      progressMsg$.next("Starting interview...");

      try {
        const session = await startLiveInterview({
          personaCard,
          contextItems,
          apiKey,
          onStatus: (status) => progressMsg$.next(status),
          onError: (error) => progressMsg$.next(error.message),
          onClose: () => {
            if (activeInterview) {
              activeInterview = null;
              interviewState$.next("idle");
              progressMsg$.next("Interview ended.");
            }
          },
        });
        activeInterview = { session, personaCard, contextItems, snapshot };
        interviewState$.next("active");
      } catch (error) {
        activeInterview = null;
        interviewState$.next("idle");
        progressMsg$.next(error instanceof Error ? error.message : "Failed to start interview.");
      }
    };

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
              metadata: {
                kind: "synthetic-user",
                persona,
              },
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
            error: () => {
              progressMsg$.next("Error occurred");
            },
          }),
          finalize(() => {
            isRunning$.next(false);
            if (progressMsg$.value !== "Error occurred") progressMsg$.next("");
          }),
        );

        submitTask(task$);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([
      selected$,
      trait$,
      segment$,
      numUsers$,
      isRunning$,
      interviewState$,
      progressMsg$,
      apiKeys$,
    ]).pipe(
      map(([selected, trait, segment, numUsers, isRunning, interviewState, progressMsg, apiKeys]) => {
        if (selected.length === 0 && interviewState === "idle") return html``;

        const interviewSelection = resolveInterviewSelection(selected);
        const interviewButtonLabel =
          interviewState === "active"
            ? "Stop"
            : interviewState === "connecting"
              ? "Connecting..."
              : interviewState === "summarizing"
                ? "Summarizing..."
                : "Interview";
        const isInterviewDisabled =
          interviewState === "active"
            ? false
            : interviewState !== "idle" || isRunning || !apiKeys.gemini || !interviewSelection.canInterview;
        const interviewTitle =
          interviewState === "active"
            ? "Stop interview and summarize findings"
            : !apiKeys.gemini
              ? "Gemini API key required"
              : !interviewSelection.canInterview
                ? "Select exactly one synthetic user card (plus any cards to discuss)"
                : "Conduct a live voice interview with the selected synthetic user";

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
            <div class="actions">
              <button
                @click=${() => startAction$.next(true)}
                ?disabled=${isRunning || interviewState !== "idle" || !apiKeys.gemini || !trait.trim()}
              >
                ${isRunning ? "Running..." : "Start"}
              </button>
              <button
                class=${interviewState === "active" ? "interview-stop" : ""}
                @click=${() => void handleInterviewClick()}
                ?disabled=${isInterviewDisabled}
                title=${interviewTitle}
              >
                ${interviewButtonLabel}
              </button>
            </div>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(startEffect$));
  },
);
