import { BehaviorSubject, Subscription } from "rxjs";
import { stop$, stopAllTasks } from "../../components/context-tray/tasks";
import type { ActionRuntime } from "../actions/runtime";
import { runAgent$, type AgentEvent, type AgentStopReason } from "./auto-iterate";
import { browserEncoders } from "./media-encode";

export interface AgentStatus {
  running: boolean;
  turn: number;
  maxTurns: number;
  action?: string;
  /** Latest message from the agent (progress note or final summary). */
  message?: string;
  stopReason?: AgentStopReason;
}

export const agentStatus$ = new BehaviorSubject<AgentStatus>({ running: false, turn: 0, maxTurns: 0 });

let subscription: Subscription | null = null;

const reasonText: Record<AgentStopReason, string> = {
  done: "Finished",
  max_turns: "Reached the turn limit",
  card_limit: "Paused at the new-card limit",
  stopped: "Stopped",
  error: "Error",
};

export function describeAgentStatus(status: AgentStatus): string {
  if (status.running) {
    return `AI · ${status.action ?? "thinking"} · ${status.turn}/${status.maxTurns}`;
  }
  return status.stopReason ? `AI · ${reasonText[status.stopReason].toLowerCase()}` : "AI · idle";
}

export function startAgent(input: { runtime: ActionRuntime; agentsMd: string; apiKey: string; goal?: string }): void {
  if (subscription) return;
  agentStatus$.next({ running: true, turn: 0, maxTurns: 0 });
  subscription = runAgent$({
    agentsMd: input.agentsMd,
    goal: input.goal,
    runtime: input.runtime,
    encoders: browserEncoders,
    apiKey: input.apiKey,
    stop$,
  }).subscribe({
    next: (event: AgentEvent) => {
      const status = agentStatus$.value;
      switch (event.type) {
        case "turn":
          agentStatus$.next({ ...status, turn: event.turn, maxTurns: event.maxTurns, action: undefined });
          break;
        case "action-start":
          agentStatus$.next({ ...status, action: event.name });
          break;
        case "message":
          agentStatus$.next({ ...status, message: event.text });
          break;
        case "stopped":
          agentStatus$.next({
            ...status,
            running: false,
            action: undefined,
            stopReason: event.reason,
            message: event.message ?? status.message,
          });
          break;
      }
    },
    complete: () => {
      subscription = null;
      if (agentStatus$.value.running) agentStatus$.next({ ...agentStatus$.value, running: false });
    },
  });
}

/** Turning Auto-Iterate off stops everything, same as the Stop button. */
export function stopAgent(): void {
  if (!subscription) return;
  stopAllTasks();
}
