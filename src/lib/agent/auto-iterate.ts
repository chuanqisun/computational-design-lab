import { GoogleGenAI, type Interactions } from "@google/genai";
import { lastValueFrom, Observable } from "rxjs";
import { getAgentDeclarations, isAgentVisible } from "../actions/registry";
import type { ActionRuntime } from "../actions/runtime";
import type { ActionResult, UiState } from "../actions/types";
import { GEMINI_AGENT_MODEL, GEMINI_AGENT_THINKING } from "../gemini-models";
import { allowsClearCanvas } from "../workflows/workflow-storage";
import { buildAgentSystemInstruction, buildInitialAgentPrompt } from "./agent-prompt";
import { buildObservation, type MediaEncoders, type ObservationBudget, type ObservationPart } from "./observe";

export type AgentStopReason = "done" | "max_turns" | "card_limit" | "stopped" | "error";

export type AgentEvent =
  | { type: "turn"; turn: number; maxTurns: number }
  | { type: "message"; text: string }
  | { type: "action-start"; name: string; args: Record<string, unknown>; callId: string }
  | { type: "action-end"; name: string; result: ActionResult }
  | { type: "stopped"; reason: AgentStopReason; message?: string };

export type CreateInteraction = (
  params: Record<string, any>,
  options: { signal: AbortSignal },
) => Promise<Interactions.Interaction>;

export interface RunAgentOptions {
  agentsMd: string;
  goal?: string;
  runtime: ActionRuntime;
  encoders: MediaEncoders;
  /** Defaults to the Gemini Interactions API with `apiKey`. */
  createInteraction?: CreateInteraction;
  apiKey?: string;
  stop$?: Observable<void>;
  maxTurns?: number;
  maxNewCards?: number;
  maxVideos?: number;
  budget?: ObservationBudget;
}

export const DEFAULT_MAX_TURNS = 12;
export const DEFAULT_MAX_NEW_CARDS = 25;
export const DEFAULT_MAX_VIDEOS = 2;

function interactionText(steps: Interactions.Step[] | undefined): string {
  return (steps ?? [])
    .filter((step): step is Interactions.ModelOutputStep => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part): part is Interactions.TextContent => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function resultText(result: ActionResult): string {
  const { media: _media, ...rest } = result;
  return JSON.stringify(rest);
}

/**
 * Auto-Iterate agent loop: Gemini function calling over the shared action layer.
 * Every call goes through `runtime.dispatch$(name, args, "ai")`, exactly like a human click.
 */
export function runAgent$(options: RunAgentOptions): Observable<AgentEvent> {
  return new Observable<AgentEvent>((subscriber) => {
    const controller = new AbortController();
    const stopSub = options.stop$?.subscribe(() => controller.abort());
    const emit = (event: AgentEvent) => {
      if (!subscriber.closed) subscriber.next(event);
    };

    const { runtime } = options;
    const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    const maxNewCards = options.maxNewCards ?? DEFAULT_MAX_NEW_CARDS;
    const maxVideos = options.maxVideos ?? DEFAULT_MAX_VIDEOS;
    const clearAllowed = allowsClearCanvas(options.agentsMd);
    const createInteraction: CreateInteraction =
      options.createInteraction ??
      ((params, requestOptions) =>
        new GoogleGenAI({ apiKey: options.apiKey ?? "" }).interactions.create(params as never, requestOptions) as Promise<Interactions.Interaction>);

    const agentDefs = [...runtime.registry.values()].filter(isAgentVisible);
    const declarations = getAgentDeclarations(runtime.registry);

    const availability = () => {
      const available: string[] = [];
      const unavailable: { name: string; reason: string }[] = [];
      for (const def of agentDefs) {
        if (def.name === "clear_canvas" && !clearAllowed) {
          unavailable.push({ name: def.name, reason: "Not allowed by the workflow" });
          continue;
        }
        const result = runtime.availability(def.name, "board");
        if (result === true) available.push(def.name);
        else unavailable.push({ name: def.name, reason: result.reason });
      }
      return { available, unavailable };
    };

    let prevState: UiState | undefined;
    let lastObservedAt = Date.now();

    const observe = async (mediaCardIds: string[] = []): Promise<ObservationPart[]> => {
      const state = runtime.getUiState();
      const { available, unavailable } = availability();
      const userActions = runtime.log.records.filter(
        (record) => record.actor === "user" && record.timestamp >= lastObservedAt,
      );
      const parts = await buildObservation({
        state,
        items: runtime.items$.value,
        prev: prevState,
        available,
        unavailable,
        userActions,
        mediaCardIds,
        encoders: options.encoders,
        budget: options.budget,
      });
      prevState = state;
      lastObservedAt = Date.now();
      return parts;
    };

    const run = async (): Promise<AgentEvent> => {
      let input: Interactions.Step[] = [
        {
          type: "user_input",
          content: [{ type: "text", text: buildInitialAgentPrompt(options.goal) }, ...(await observe())],
        },
      ];
      let previousId: string | undefined;
      let createdCount = 0;
      let videoCount = 0;

      for (let turnIndex = 1; turnIndex <= maxTurns; turnIndex++) {
        if (controller.signal.aborted) return { type: "stopped", reason: "stopped" };
        emit({ type: "turn", turn: turnIndex, maxTurns });
        const interaction = await createInteraction(
          {
            model: GEMINI_AGENT_MODEL,
            system_instruction: buildAgentSystemInstruction(options.agentsMd),
            input,
            tools: declarations,
            previous_interaction_id: previousId,
            generation_config: {
              thinking_level: GEMINI_AGENT_THINKING,
              tool_choice: { allowed_tools: { mode: "auto", tools: availability().available } },
            },
            store: true,
          },
          { signal: controller.signal },
        );

        const steps = interaction.steps ?? [];
        const answered = new Set(
          steps
            .filter((step): step is Interactions.FunctionResultStep => step.type === "function_result")
            .map((step) => step.call_id),
        );
        const calls = steps.filter(
          (step): step is Interactions.FunctionCallStep => step.type === "function_call" && !answered.has(step.id),
        );
        const text = interactionText(steps);

        if (calls.length === 0) return { type: "stopped", reason: "done", message: text || undefined };
        if (text) emit({ type: "message", text });

        const results: Interactions.FunctionResultStep[] = [];
        for (const [index, call] of calls.entries()) {
          if (controller.signal.aborted) return { type: "stopped", reason: "stopped" };
          if (createdCount >= maxNewCards) {
            return { type: "stopped", reason: "card_limit", message: `Paused after ${createdCount} new cards.` };
          }

          const args = (call.arguments ?? {}) as Record<string, unknown>;
          emit({ type: "action-start", name: call.name, args, callId: call.id });

          let result: ActionResult;
          if (call.name === "clear_canvas" && !clearAllowed) {
            result = { summary: "refused", error: "unavailable", reason: "clear_canvas is not allowed by the workflow" };
          } else if (call.name === "animate" && videoCount >= maxVideos) {
            result = { summary: "refused", error: "budget", reason: `Video budget of ${maxVideos} per run is used up` };
          } else {
            result = await lastValueFrom(runtime.dispatch$(call.name, args, "ai"));
            if (call.name === "animate" && !result.error) videoCount += 1;
          }
          createdCount += result.created?.length ?? 0;
          emit({ type: "action-end", name: call.name, result });
          if (result.error === "stopped" || controller.signal.aborted) return { type: "stopped", reason: "stopped" };

          const isLast = index === calls.length - 1;
          const content: ObservationPart[] = [
            { type: "text", text: resultText(result) },
            ...((result.media ?? []) as ObservationPart[]),
            ...(isLast ? await observe(result.created ?? []) : []),
          ];
          results.push({
            type: "function_result",
            name: call.name,
            call_id: call.id,
            result: content,
            ...(result.error ? { is_error: true } : {}),
          });
        }

        input = results;
        previousId = interaction.id;
      }

      return { type: "stopped", reason: "max_turns", message: `Reached the ${maxTurns}-turn limit.` };
    };

    run()
      .then((final) => emit(controller.signal.aborted ? { type: "stopped", reason: "stopped" } : final))
      .catch((error: unknown) => {
        if (controller.signal.aborted) emit({ type: "stopped", reason: "stopped" });
        else emit({ type: "stopped", reason: "error", message: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => subscriber.complete());

    return () => {
      controller.abort();
      stopSub?.unsubscribe();
    };
  });
}
