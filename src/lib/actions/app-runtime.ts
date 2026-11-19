import { finalize, tap, type BehaviorSubject } from "rxjs";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { getWorldViewport } from "../../components/canvas/canvas-viewport";
import { stop$, submitTask } from "../../components/context-tray/tasks";
import { browserEncoders, makeThumb } from "../agent/media-encode";
import { ActionLog } from "../workflows/action-log";
import { createAppRegistry } from "./app-registry";
import { settleCards$ } from "./card-fill";
import { createActionRuntime, type ActionRuntime } from "./runtime";
import type { ActionResult, Viewport } from "./types";

const runtimes = new WeakMap<object, ActionRuntime>();

/** Visible region in world (card) coordinates; the canvas is infinite, so this is not the scroll offset. */
export function getCanvasViewport(): Viewport {
  return getWorldViewport();
}

/** One action runtime per board (`items$`). UI tools and the agent share it. */
export function getActionRuntime(
  items$: BehaviorSubject<CanvasItem[]>,
  apiKeys$: { readonly value: { gemini?: string } },
): ActionRuntime {
  let runtime = runtimes.get(items$);
  if (!runtime) {
    runtime = createActionRuntime({
      items$,
      apiKeys$,
      registry: createAppRegistry(browserEncoders),
      stop$,
      log: new ActionLog(),
      getViewport: getCanvasViewport,
      settle: (ids, ctx) => settleCards$(ids, ctx),
      makeThumb: typeof document === "undefined" ? undefined : makeThumb,
    });
    runtimes.set(items$, runtime);
  }
  return runtime;
}

/**
 * UI adapter: dispatch as the user and surface errors (the AI adapter never alerts).
 * `onDone` always runs once, with the result, or with undefined if the task was stopped.
 */
export function runUserAction(
  runtime: ActionRuntime,
  name: string,
  args: Record<string, unknown> = {},
  onDone?: (result: ActionResult | undefined) => void,
): void {
  let last: ActionResult | undefined;
  submitTask(
    runtime.dispatch$(name, args, "user").pipe(
      tap((result) => {
        last = result;
        if (result.error && result.error !== "stopped") {
          console.error(`${name} failed: ${result.reason ?? result.error}`);
          if (typeof alert === "function") alert(result.reason ?? result.error);
        }
      }),
      finalize(() => onDone?.(last)),
    ),
  );
}

/** Is a tray section shown? Same predicate as the agent's allowed tools, evaluated on the selection. */
export function isTrayVisible(runtime: ActionRuntime, name: string): boolean {
  const availability = runtime.availability(name, "selection");
  return availability === true || availability.reason === "Gemini API key required";
}
