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
import type { ImageItem, TextItem } from "../../canvas/canvas.component";
import { sortItemsAlongAxis } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import { scanMoods$, scanMoodsSupervised$ } from "../llm/scan-moods";
import { submitTask } from "../tasks";
import "./user-testing.css";

interface MoodEntry {
  mood: string;
  arousal: number;
}

interface MoodResult {
  itemId: string;
  moods: MoodEntry[];
}

export const UserTestingTool = createComponent(
  ({
    selectedImages$,
    selectedTexts$,
    apiKeys$,
    items$,
  }: {
    selectedImages$: Observable<ImageItem[]>;
    selectedTexts$: Observable<TextItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
    items$: BehaviorSubject<any[]>;
  }) => {
    const moodResults$ = new BehaviorSubject<Map<string, { mood: string; arousal: number }[]>>(new Map());
    const scanning$ = new BehaviorSubject<boolean>(false);

    const scanAction$ = new BehaviorSubject<boolean>(false);
    const lockedMoods$ = new BehaviorSubject<Set<string>>(new Set());
    const sortXMood$ = new BehaviorSubject<string | null>(null);
    const sortYMood$ = new BehaviorSubject<string | null>(null);

    const selectedItems$ = combineLatest([selectedImages$, selectedTexts$]).pipe(
      map(([images, texts]) => [...images, ...texts]),
    );

    // Load existing mood scan results from metadata
    const loadExistingResults$ = selectedItems$.pipe(
      tap((selectedItems) => {
        const results = new Map<string, { mood: string; arousal: number }[]>();
        selectedItems.forEach((item) => {
          if (item.metadata?.moodScan) {
            results.set(item.id, item.metadata.moodScan);
          }
        });
        moodResults$.next(results);
      }),
      ignoreElements(),
    );

    const scanEffect$ = scanAction$.pipe(
      filter((action) => action),
      withLatestFrom(selectedItems$, apiKeys$, lockedMoods$),
      tap(([_, selectedItems, apiKeys, lockedMoods]) => {
        if (selectedItems.length === 0 || !apiKeys.gemini) {
          return;
        }

        scanning$.next(true);

        const requiredList = lockedMoods.size > 0 ? Array.from(lockedMoods) : undefined;

        const tasks = selectedItems.map((item) => {
          const scanObservable$ = requiredList
            ? scanMoodsSupervised$({
                item,
                apiKey: apiKeys.gemini!,
                requiredList,
              })
            : scanMoods$({
                item,
                apiKey: apiKeys.gemini!,
              });

          return scanObservable$.pipe(
            tap((result: MoodResult) => {
              // Update in-memory results
              const currentResults = moodResults$.value;
              currentResults.set(result.itemId, result.moods);
              moodResults$.next(new Map(currentResults));

              // Persist to metadata
              const currentItems = items$.value;
              const updatedItems = currentItems.map((currentItem) =>
                currentItem.id === result.itemId
                  ? {
                      ...currentItem,
                      metadata: {
                        ...currentItem.metadata,
                        moodScan: result.moods,
                      },
                    }
                  : currentItem,
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

    const sortXEffect$ = sortXMood$.pipe(
      filter((mood) => mood !== null),
      withLatestFrom(selectedItems$, moodResults$),
      tap(([mood, selectedItems, moodResults]) => {
        if (selectedItems.length < 2 || !mood) return;

        const sorted = sortItemsAlongAxis({
          axis: "x",
          items: selectedItems,
          getPosition: (item) => item.x,
          getValue: (item) => {
            const moods = moodResults.get(item.id) || [];
            return moods.find((m) => m.mood === mood)?.arousal || 0;
          },
        });

        const currentItems = items$.value;
        const updatedItems = currentItems.map((item) => {
          const sortedItem = sorted.find((s) => s.item.id === item.id);
          return sortedItem ? { ...item, x: sortedItem.position } : item;
        });

        items$.next(updatedItems);
      }),
      ignoreElements(),
    );

    const sortYEffect$ = sortYMood$.pipe(
      filter((mood) => mood !== null),
      withLatestFrom(selectedItems$, moodResults$),
      tap(([mood, selectedItems, moodResults]) => {
        if (selectedItems.length < 2 || !mood) return;

        const sorted = sortItemsAlongAxis({
          axis: "y",
          items: selectedItems,
          getPosition: (item) => item.y,
          getValue: (item) => {
            const moods = moodResults.get(item.id) || [];
            return moods.find((m) => m.mood === mood)?.arousal || 0;
          },
        });

        const currentItems = items$.value;
        const updatedItems = currentItems.map((item) => {
          const sortedItem = sorted.find((s) => s.item.id === item.id);
          return sortedItem ? { ...item, y: sortedItem.position } : item;
        });

        items$.next(updatedItems);
      }),
      ignoreElements(),
    );

    const template$ = combineLatest([
      selectedItems$,
      moodResults$,
      scanning$,
      lockedMoods$,
      sortXMood$,
      sortYMood$,
    ]).pipe(
      map(([selectedItems, moodResults, scanning, lockedMoods, _sortXMood, _sortYMood]) => {
        if (selectedItems.length === 0) return html``;

        const hasResults = moodResults.size > 0;

        // Extract all unique moods from results
        const allMoods = new Set<string>();
        for (const moods of moodResults.values()) {
          for (const { mood } of moods) {
            allMoods.add(mood);
          }
        }
        const sortedMoods = Array.from(allMoods).sort();

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
            <button @click=${() => scanAction$.next(true)} ?disabled=${scanning}>
              ${scanning ? "Scanning..." : "Scan Moods"}
            </button>

            ${hasResults
              ? html`
                  <div class="mood-results">
                    ${selectedItems.length === 1
                      ? html`
                          <div class="single-image-results">
                            ${Array.from(moodResults.entries())
                              .filter(([id]) => id === selectedItems[0].id)
                              .map(
                                ([_, moods]) => html`
                                  ${[...moods]
                                    .sort((a, b) => a.mood.localeCompare(b.mood))
                                    .map(
                                      ({ mood, arousal }) => html`
                                        <div class="mood-item" @click=${() => toggleLock(mood)}>
                                          <span class="mood-label"> ${lockedMoods.has(mood) ? "🔒 " : ""}${mood} </span>
                                          <span class="arousal-level">${arousal}/10</span>
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
                                  if (selectedItems.some((item) => item.id === id)) {
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
            ${hasResults && sortedMoods.length > 0
              ? html`
                  <div class="sort-controls">
                    <label>
                      Sort X:
                      <select @change=${(e: Event) => sortXMood$.next((e.target as HTMLSelectElement).value || null)}>
                        <option value="">-- Select mood --</option>
                        ${sortedMoods.map((mood) => html`<option value=${mood}>${mood}</option>`)}
                      </select>
                    </label>
                    <label>
                      Sort Y:
                      <select @change=${(e: Event) => sortYMood$.next((e.target as HTMLSelectElement).value || null)}>
                        <option value="">-- Select mood --</option>
                        ${sortedMoods.map((mood) => html`<option value=${mood}>${mood}</option>`)}
                      </select>
                    </label>
                  </div>
                `
              : html``}
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$, loadExistingResults$, sortXEffect$, sortYEffect$));
  },
);
