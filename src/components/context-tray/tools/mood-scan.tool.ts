import { html } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  ignoreElements,
  map,
  merge,
  mergeWith,
  Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { ImageItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import { scanMoods$, scanMoodsSupervised$ } from "../llm/scan-moods";
import { submitTask } from "../tasks";
import "./mood-scan.css";

interface MoodEntry {
  mood: string;
  arousal: number;
}

interface MoodResult {
  imageId: string;
  moods: MoodEntry[];
}

export const MoodScanTool = createComponent(
  ({
    selectedImages$,
    apiKeys$,
    items$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    items$: BehaviorSubject<any[]>;
  }) => {
    const moodResults$ = new BehaviorSubject<Map<string, { mood: string; arousal: number }[]>>(new Map());
    const scanning$ = new BehaviorSubject<boolean>(false);

    const scanAction$ = new BehaviorSubject<boolean>(false);
    const lockedMoods$ = new BehaviorSubject<Set<string>>(new Set());

    // Load existing mood scan results from metadata
    const loadExistingResults$ = selectedImages$.pipe(
      tap((selectedImages) => {
        const results = new Map<string, { mood: string; arousal: number }[]>();
        selectedImages.forEach((img) => {
          if (img.metadata?.moodScan) {
            results.set(img.id, img.metadata.moodScan);
          }
        });
        moodResults$.next(results);
      }),
      ignoreElements(),
    );

    const scanEffect$ = scanAction$.pipe(
      filter((action) => action),
      withLatestFrom(selectedImages$, apiKeys$, lockedMoods$),
      tap(([_, selectedImages, apiKeys, lockedMoods]) => {
        if (selectedImages.length === 0 || !apiKeys.openai) {
          return;
        }

        scanning$.next(true);

        const requiredList = lockedMoods.size > 0 ? Array.from(lockedMoods) : undefined;

        const tasks = selectedImages.map((image) => {
          const scanObservable$ = requiredList
            ? scanMoodsSupervised$({
                image,
                apiKey: apiKeys.openai!,
                requiredList,
              })
            : scanMoods$({
                image,
                apiKey: apiKeys.openai!,
              });

          return scanObservable$.pipe(
            tap((result: MoodResult) => {
              // Update in-memory results
              const currentResults = moodResults$.value;
              currentResults.set(result.imageId, result.moods);
              moodResults$.next(new Map(currentResults));

              // Persist to metadata
              const currentItems = items$.value;
              const updatedItems = currentItems.map((item) =>
                item.id === result.imageId
                  ? {
                      ...item,
                      metadata: {
                        ...item.metadata,
                        moodScan: result.moods,
                      },
                    }
                  : item,
              );
              items$.next(updatedItems);
            }),
          );
        });

        const task$ = merge(...tasks).pipe(
          tap({
            complete: () => {
              scanning$.next(false);
            },
            error: () => {
              scanning$.next(false);
            },
          }),
        );

        submitTask(task$);
        scanAction$.next(false);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([selectedImages$, moodResults$, scanning$, lockedMoods$]).pipe(
      map(([selectedImages, moodResults, scanning, lockedMoods]) => {
        if (selectedImages.length === 0) return html``;

        const hasResults = moodResults.size > 0;

        const toggleLock = (mood: string) => {
          const newLocked = new Set(lockedMoods);
          if (newLocked.has(mood)) {
            newLocked.delete(mood);
          } else {
            newLocked.add(mood);
          }
          lockedMoods$.next(newLocked);
        };

        return html`
          <div class="mood-scan-section">
            <h3>Mood Scan</h3>
            <button @click=${() => scanAction$.next(true)} ?disabled=${scanning}>
              ${scanning ? "Scanning..." : "Scan Moods"}
            </button>
            ${hasResults
              ? html`
                  <div class="mood-results">
                    ${selectedImages.length === 1
                      ? html`
                          <div class="single-image-results">
                            ${Array.from(moodResults.entries())
                              .filter(([id]) => id === selectedImages[0].id)
                              .map(
                                ([_, moods]) => html`
                                  ${[...moods]
                                    .sort((a, b) => a.mood.localeCompare(b.mood))
                                    .map(
                                      ({ mood, arousal }) => html`
                                        <div class="mood-item" @click=${() => toggleLock(mood)}>
                                          <span class="mood-label"> ${lockedMoods.has(mood) ? "🔒 " : ""}${mood} </span>
                                          <span class="arousal-level">${arousal}/5</span>
                                        </div>
                                      `,
                                    )}
                                `,
                              )}
                          </div>
                        `
                      : html`
                          <div class="multi-image-results">
                            ${Array.from(
                              (() => {
                                const moodAverages = new Map<string, { total: number; count: number }>();

                                for (const [id, moods] of moodResults.entries()) {
                                  if (selectedImages.some((img) => img.id === id)) {
                                    for (const { mood, arousal } of moods) {
                                      const current = moodAverages.get(mood) || { total: 0, count: 0 };
                                      moodAverages.set(mood, {
                                        total: current.total + arousal,
                                        count: current.count + 1,
                                      });
                                    }
                                  }
                                }

                                return moodAverages;
                              })().entries(),
                            )
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(
                                ([mood, { total, count }]) => html`
                                  <div class="mood-item" @click=${() => toggleLock(mood)}>
                                    <span class="mood-label">
                                      ${lockedMoods.has(mood) ? "🔒 " : ""}${mood} (${count})
                                    </span>
                                    <span class="arousal-level">${(total / count).toFixed(1)}/5</span>
                                  </div>
                                `,
                              )}
                          </div>
                        `}
                  </div>
                `
              : html``}
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$, loadExistingResults$));
  },
);
