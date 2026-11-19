import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  finalize,
  last,
  map,
  of,
  takeUntil,
  type Subscription,
} from "rxjs";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { placeRows, type Position } from "../../components/canvas/layout";
import { ActionLog } from "../workflows/action-log";
import type { Registry } from "./registry";
import { validateSchema } from "./schema";
import { buildUiState, toCardView } from "./ui-state";
import {
  ActionError,
  type ActionContext,
  type ActionDef,
  type ActionResult,
  type Actor,
  type Availability,
  type CardView,
  type UiState,
  type Viewport,
} from "./types";

export interface ActionRuntimeOptions {
  items$: BehaviorSubject<CanvasItem[]>;
  apiKeys$: { readonly value: { gemini?: string } };
  registry: Registry;
  stop$?: Observable<void>;
  log?: ActionLog;
  getViewport?: () => Viewport;
  /** Card fill/render; injected so tests never hit the network. */
  settle: (ids: string[], ctx: ActionContext) => Observable<void>;
  makeThumb?: (src: string) => Promise<string | undefined>;
  newId?: (prefix: string) => string;
}

export interface RunningAction {
  actionId: string;
  name: string;
  actor: Actor;
}

export interface ActionRuntime {
  readonly items$: BehaviorSubject<CanvasItem[]>;
  readonly apiKeys$: { readonly value: { gemini?: string } };
  readonly registry: Registry;
  readonly log: ActionLog;
  readonly running$: BehaviorSubject<RunningAction[]>;
  /** Emits created card ids after each action (used to reveal new cards). */
  readonly created$: Subject<{ ids: string[]; actor: Actor }>;
  dispatch$(name: string, args: Record<string, unknown>, actor: Actor): Observable<ActionResult>;
  getUiState(): UiState;
  /** Availability of an action against the selection (tray), the whole board (agent), or explicit targets. */
  availability(name: string, targets: "selection" | "board" | CardView[]): Availability;
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, width: 1200, height: 800 };

const defaultNewId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function errorResult(error: string, reason: string): ActionResult {
  return { summary: `${error}: ${reason}`, error, reason };
}

function stripHumanArgs(def: ActionDef, args: Record<string, unknown>): Record<string, unknown> {
  if (!def.humanArgs?.length) return args;
  return Object.fromEntries(Object.entries(args).filter(([key]) => !def.humanArgs!.includes(key)));
}

export function createActionRuntime(options: ActionRuntimeOptions): ActionRuntime {
  const { items$, apiKeys$, registry } = options;
  const log = options.log ?? new ActionLog();
  const stop$ = options.stop$ ?? EMPTY;
  const getViewport = options.getViewport ?? (() => DEFAULT_VIEWPORT);
  const newId = options.newId ?? defaultNewId;
  const running$ = new BehaviorSubject<RunningAction[]>([]);
  const created$ = new Subject<{ ids: string[]; actor: Actor }>();

  const getUiState = (): UiState =>
    buildUiState({
      items: items$.value,
      running: running$.value,
      viewport: getViewport(),
      hasApiKey: !!apiKeys$.value.gemini,
    });

  const checkAvailability = (def: ActionDef, state: UiState, targets: CardView[]): Availability => {
    const available = def.isAvailable({ state, targets });
    if (available !== true) return available;
    if (def.needsApiKey && !state.hasApiKey) return { reason: "Gemini API key required" };
    return true;
  };

  const availability: ActionRuntime["availability"] = (name, targets) => {
    const def = registry.get(name);
    if (!def) return { reason: "Unknown action" };
    const state = getUiState();
    const resolved =
      targets === "selection"
        ? state.cards.filter((card) => card.isSelected)
        : targets === "board"
          ? state.cards
          : targets;
    return checkAvailability(def, state, resolved);
  };

  const findCards = (ids: string[]): CanvasItem[] => {
    const items = items$.value;
    const missing = ids.filter((id) => !items.some((item) => item.id === id));
    if (missing.length) throw new ActionError("card_not_found", `No card with id ${missing.join(", ")}`);
    return ids.map((id) => items.find((item) => item.id === id)!);
  };

  const dispatch$ = (name: string, rawArgs: Record<string, unknown>, actor: Actor): Observable<ActionResult> =>
    defer(() => {
      const def = registry.get(name);
      if (!def) return of(errorResult("unknown_action", `No action named "${name}"`));

      const args = rawArgs ?? {};
      const humanArgKeys = new Set(def.humanArgs ?? []);
      const declaredArgs = Object.fromEntries(Object.entries(args).filter(([key]) => !humanArgKeys.has(key)));
      const usedHumanArgs = Object.keys(args).filter((key) => humanArgKeys.has(key));

      if (actor === "ai" && usedHumanArgs.length) {
        return of(errorResult("invalid_args", `${usedHumanArgs.join(", ")} cannot be provided by the agent`));
      }
      const schemaErrors = validateSchema(declaredArgs, def.parameters);
      if (schemaErrors.length) return of(errorResult("invalid_args", schemaErrors.join("; ")));

      if (actor === "ai" && typeof def.agent === "object") {
        return of(errorResult("unsupported_for_agent", def.agent.unsupported));
      }

      const cardIds = Array.isArray(args.cardIds)
        ? (args.cardIds as string[])
        : typeof args.cardId === "string"
          ? [args.cardId]
          : undefined;
      let targets: CanvasItem[];
      try {
        targets = cardIds ? findCards(cardIds) : items$.value.filter((item) => item.isSelected);
      } catch (error) {
        const err = error as ActionError;
        return of(errorResult(err.code, err.message));
      }

      const state = getUiState();
      const available = checkAvailability(def, state, targets.map(toCardView));
      if (available !== true) return of(errorResult("unavailable", available.reason));

      const abortController = new AbortController();
      const ctx: ActionContext = {
        actor,
        signal: abortController.signal,
        apiKey: apiKeys$.value.gemini ?? "",
        items$,
        getState: getUiState,
        targets,
        cards: findCards,
        place: (count, near) =>
          placeRows(items$.value, count, {
            near: near ?? targets.map((target) => target.id),
            viewport: getViewport(),
          }),
        placer: (near) => {
          let positions: Position[] | null = null;
          let index = 0;
          return () => {
            positions ??= placeRows(items$.value, 64, {
              near: near ?? targets.map((target) => target.id),
              viewport: getViewport(),
            });
            const pos = positions[index++ % positions.length];
            return { ...pos, z: pos.z + Math.floor(index / positions.length) * positions.length };
          };
        },
        background: (task$) => {
          task$.pipe(takeUntil(stop$), catchError((error) => {
            console.error(`Background work for ${name} failed`, error);
            return EMPTY;
          })).subscribe();
        },
        newId,
        addCards: (cards) => items$.next([...items$.value, ...cards]),
        updateCard: (id, patch) =>
          items$.next(
            items$.value.map((item) =>
              item.id === id
                ? { ...item, ...patch, metadata: patch.metadata ? { ...item.metadata, ...patch.metadata } : item.metadata }
                : item,
            ),
          ),
        settle$: (ids) => options.settle(ids, ctx),
      };

      const loggedArgs = stripHumanArgs(def, args);
      const startedAt = Date.now();
      const recordId =
        def.log === "skip"
          ? null
          : log.start({ actor, action: name, args: loggedArgs, inputIds: targets.map((t) => t.id) }, def.log);
      const actionId = recordId ?? newId("run");
      running$.next([...running$.value, { actionId, name, actor }]);

      let stopped = false;
      let stopSub: Subscription | undefined;

      return def.run(args as Record<string, any>, ctx).pipe(
        takeUntil(
          new Observable<void>((subscriber) => {
            stopSub = stop$.subscribe(() => {
              stopped = true;
              abortController.abort();
              subscriber.next();
            });
            return () => stopSub?.unsubscribe();
          }),
        ),
        last(undefined, undefined as ActionResult | undefined),
        map((result): ActionResult => {
          if (stopped || !result) return errorResult("stopped", "Stopped before completing");
          return result;
        }),
        catchError((error: unknown) => {
          const code = error instanceof ActionError ? error.code : "action_failed";
          const message = error instanceof Error ? error.message : String(error);
          return of(errorResult(code, message));
        }),
        map((result) => {
          const outputIds = [...(result.created ?? []), ...(result.updated ?? [])];
          if (recordId) {
            log.update(recordId, {
              status: result.error ? "error" : "done",
              summary: result.summary,
              error: result.error ? result.reason ?? result.error : undefined,
              outputIds,
              durationMs: Date.now() - startedAt,
            });
            if (options.makeThumb && result.created?.length) void attachThumbs(recordId, result.created);
          }
          if (result.created?.length) created$.next({ ids: result.created, actor });
          return result;
        }),
        finalize(() => {
          abortController.abort();
          running$.next(running$.value.filter((entry) => entry.actionId !== actionId));
        }),
      );
    });

  const attachThumbs = async (recordId: string, ids: string[]) => {
    const thumbs: string[] = [];
    for (const id of ids.slice(0, 4)) {
      const item = items$.value.find((candidate) => candidate.id === id);
      const src = item?.imageSrc || item?.videoPosterSrc;
      if (!src) continue;
      const thumb = await options.makeThumb!(src).catch(() => undefined);
      if (thumb) thumbs.push(thumb);
    }
    if (thumbs.length) log.update(recordId, { outputThumbs: thumbs });
  };

  return { items$, apiKeys$, registry, log, running$, created$, dispatch$, getUiState, availability };
}
