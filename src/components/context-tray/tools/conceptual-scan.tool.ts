import { html } from "lit-html";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  mergeWith,
  Observable,
  of,
  scan,
  startWith,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { SCAN_LENSES, type ScanLens } from "../../../lib/actions/defs/generate";
import type { ApiKeys } from "../../connections/storage";
import { rateLenses$, type LensScores } from "../llm/rate-lenses";
import "./conceptual-scan.tool.css";

export interface SuitabilityState {
  scores: LensScores | null;
  loading: boolean;
}

const IDLE: SuitabilityState = { scores: null, loading: false };
const SETTLE_MS = 400;
const CACHE_LIMIT = 32;

/** Cheap content fingerprint of an image data URL (avoids hashing megabytes on every emission). */
const imageFingerprint = (src?: string) =>
  src
    ? `${src.length}:${src.slice(0, 64)}:${src.slice(src.length >> 1, (src.length >> 1) + 64)}:${src.slice(-64)}`
    : "";

/** Order-independent key over the selected content (ignores ids and positions). */
export const selectionContentKey = (items: CanvasItem[]) =>
  items
    .map((item) => [item.title ?? "", item.body ?? "", imageFingerprint(item.imageSrc)].join("\u0000"))
    .sort()
    .join("\u0001");

/**
 * Scores every scan lens for the current selection via the Decisions API.
 * - dedupes identical selection content (consecutive and via an LRU cache of completed results)
 * - waits for the selection to settle, then aborts any outdated in-flight request (switchMap)
 */
export function lensSuitability$(
  selected$: Observable<CanvasItem[]>,
  apiKeys$: Observable<ApiKeys>,
  rate: typeof rateLenses$ = rateLenses$,
): Observable<SuitabilityState> {
  // Completed results by content key, so re-selecting the same content never re-requests.
  const cache = new Map<string, LensScores>();
  const remember = (key: string, scores: LensScores) => {
    cache.delete(key);
    cache.set(key, scores);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  };

  return combineLatest([selected$, apiKeys$]).pipe(
    map(([items, keys]) => ({ items, apiKey: keys.gemini ?? "", key: selectionContentKey(items) })),
    distinctUntilChanged((a, b) => a.key === b.key && a.apiKey === b.apiKey),
    debounceTime(SETTLE_MS),
    distinctUntilChanged((a, b) => a.key === b.key && a.apiKey === b.apiKey),
    // switchMap unsubscribes the previous rateLenses$, which aborts its in-flight request.
    switchMap(({ items, apiKey, key }): Observable<SuitabilityState> => {
      if (!items.length || !apiKey) return of(IDLE);
      const cached = cache.get(key);
      if (cached) return of({ scores: cached, loading: false });
      return rate({ items, apiKey }).pipe(
        tap((scores) => remember(key, scores)),
        map((scores) => ({ scores, loading: false })),
        startWith({ scores: null, loading: true }),
        catchError((error) => {
          console.warn("[scan] lens suitability failed", error);
          return of(IDLE);
        }),
      );
    }),
    // While loading, keep showing the previous scores so meters animate old -> new instead of resetting.
    scan((prev, next) => (next.loading ? { scores: prev.scores, loading: true } : next), IDLE),
    startWith(IDLE),
  );
}

export const ConceptualScanTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const scanTypes = (Object.keys(SCAN_LENSES) as ScanLens[]).map((id) => ({
      id,
      label: `${id[0].toUpperCase()}${id.slice(1)}`,
    }));
    const runtime = getActionRuntime(items$, apiKeys$);

    const scan$ = new BehaviorSubject<(typeof scanTypes)[number] | null>(null);

    const scanEffect$ = scan$.pipe(
      filter((scanType): scanType is (typeof scanTypes)[number] => scanType !== null),
      withLatestFrom(selected$),
      tap(([scanType, selected]) => {
        if (selected.length === 0) return;
        runUserAction(runtime, "scan_concept", { lens: scanType.id, cardIds: selected.map((item) => item.id) });
      }),
      ignoreElements(),
    );

    const suitability$ = lensSuitability$(selected$, apiKeys$);

    const template$ = combineLatest([selected$, suitability$]).pipe(
      map(([selected, { scores, loading }]) => {
        if (selected.length === 0) return html``;

        return html`
          <div class="conceptual-scan-section">
            <div class="scan-options">
              ${scanTypes.map((scanType) => {
                const value = scores?.relative[scanType.id] ?? 0;
                const probability = scores?.probabilities[scanType.id] ?? 0;
                return html`
                  <button
                    class="scan-option"
                    title=${scores ? `Best-fit probability: ${Math.round(probability * 100)}%` : ""}
                    @click=${() => scan$.next(scanType)}
                  >
                    <span class="scan-label">${scanType.label}</span>
                    <span class="scan-meter ${loading ? "loading" : ""}" aria-hidden="true">
                      <span class="scan-meter-fill" style="--fill: ${value}"></span>
                    </span>
                  </button>
                `;
              })}
            </div>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$));
  },
);
