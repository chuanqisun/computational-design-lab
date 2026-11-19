import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  mergeWith,
  type Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { resolveInterviewSelection, startLiveInterview, type LiveInterviewSession } from "../llm/interview";
import "./user-testing.css";

export type InterviewState = "idle" | "connecting" | "active";

interface ActiveInterviewState {
  session: LiveInterviewSession;
  personaCard: CanvasItem;
  contextItems: CanvasItem[];
  snapshot: CanvasItem[];
}

export const interviewState$ = new BehaviorSubject<InterviewState>("idle");
const interviewStatus$ = new BehaviorSubject<string>("");
/** Summaries run in the background, so a new interview can start while earlier ones are summarized. */
const pendingSummaries$ = new BehaviorSubject<number>(0);
const summaryError$ = new BehaviorSubject<string>("");
const summaryMessage$ = combineLatest([pendingSummaries$, summaryError$]).pipe(
  map(([pending, error]) =>
    pending ? `Summarizing ${pending} interview${pending > 1 ? "s" : ""} in the background...` : error,
  ),
);
let activeInterview: ActiveInterviewState | null = null;

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
    const runtime = getActionRuntime(items$, apiKeys$);

    const handleInterviewClick = async () => {
      if (interviewState$.value === "active" && activeInterview) {
        const current = activeInterview;
        activeInterview = null;
        const transcript = await current.session.stop();

        if (transcript.length === 0) {
          interviewState$.next("idle");
          interviewStatus$.next("No conversation recorded to summarize.");
          return;
        }

        // Free the interview slot immediately; the summary continues in the background.
        interviewState$.next("idle");
        interviewStatus$.next("");
        summaryError$.next("");
        pendingSummaries$.next(pendingSummaries$.value + 1);

        runUserAction(
          runtime,
          "interview_persona",
          { cardIds: [current.personaCard.id, ...current.contextItems.map((item) => item.id)], _transcript: transcript },
          (result) => {
            pendingSummaries$.next(Math.max(0, pendingSummaries$.value - 1));
            if (!result || result.error) summaryError$.next("Failed to summarize interview.");
          },
        );
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
      interviewStatus$.next("Starting interview...");

      try {
        const session = await startLiveInterview({
          personaCard,
          contextItems,
          apiKey,
          onStatus: (status) => interviewStatus$.next(status),
          onError: (error) => interviewStatus$.next(error.message),
          onClose: () => {
            if (activeInterview) {
              activeInterview = null;
              interviewState$.next("idle");
              interviewStatus$.next("Interview ended.");
            }
          },
        });
        activeInterview = { session, personaCard, contextItems, snapshot };
        interviewState$.next("active");
      } catch (error) {
        activeInterview = null;
        interviewState$.next("idle");
        interviewStatus$.next(error instanceof Error ? error.message : "Failed to start interview.");
      }
    };

    void persistSubject(trait$, "context-tray:user-testing:trait");
    void persistSubject(segment$, "context-tray:user-testing:segment");
    void persistSubject(numUsers$, "context-tray:user-testing:num-users");

    const startEffect$ = startAction$.pipe(
      filter((v) => v === true),
      tap(() => startAction$.next(false)),
      withLatestFrom(selected$, trait$, segment$, numUsers$),
      tap(([_, selectedItems, trait, segment, numUsers]) => {
        if (selectedItems.length === 0 || !trait.trim()) return;

        isRunning$.next(true);
        progressMsg$.next("Generating personas and rankings...");
        runUserAction(
          runtime,
          "run_user_testing",
          { trait: trait.trim(), segment: segment || "All", numUsers, cardIds: selectedItems.map((item) => item.id) },
          (result) => {
            isRunning$.next(false);
            progressMsg$.next(result?.error ? "Error occurred" : "");
          },
        );
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
      interviewStatus$,
      progressMsg$,
      apiKeys$,
      summaryMessage$,
    ]).pipe(
      map(([selected, trait, segment, numUsers, isRunning, interviewState, interviewStatus, progressMsg, apiKeys, summaryMessage]) => {
        if (selected.length === 0 && interviewState === "idle" && !summaryMessage) return html``;

        const statusMessage = interviewStatus || progressMsg;
        const interviewSelection = resolveInterviewSelection(selected);
        const interviewButtonLabel =
          interviewState === "active"
            ? "Stop"
            : interviewState === "connecting"
              ? "Connecting..."
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
            ${statusMessage ? html`<div class="progress-msg">${statusMessage}</div>` : html``}
            ${summaryMessage ? html`<div class="progress-msg">${summaryMessage}</div>` : html``}
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
