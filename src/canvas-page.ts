import { html, render } from "lit-html";
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  merge,
  mergeWith,
  of,
  scan,
  shareReplay,
  skip,
  startWith,
  Subject,
  switchMap,
  take,
} from "rxjs";
import "./canvas-page.css";
import { CanvasComponent, type CanvasItem } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, loadCanvasItems, saveCanvasItems, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { taskRunner$ } from "./components/context-tray/tasks";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { hasActiveTasks, progressText, stopTasks } from "./components/progress/progress";
import { ResizerComponent } from "./components/resizer/resizer";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

// Register custom elements
GenerativeImageElement.define(() => ({
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

// Initialize items from IndexedDB (with migration)
const items$ = new BehaviorSubject<CanvasItem[]>([]);
loadCanvasItems().then((loadedItems) => items$.next(loadedItems));
const canvasInteraction$ = new Subject<"start" | "end">();

type PersistedCanvasItem = Omit<CanvasItem, "isSelected">;

function toPersistedItems(items: CanvasItem[]): PersistedCanvasItem[] {
  return items.map(({ isSelected: _isSelected, ...persisted }) => persisted);
}

function isSamePersistedItems(prev: PersistedCanvasItem[], curr: PersistedCanvasItem[]): boolean {
  if (prev.length !== curr.length) return false;

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = curr[i];

    if (
      a.id !== b.id ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.width !== b.width ||
      a.height !== b.height ||
      a.zIndex !== b.zIndex ||
      a.title !== b.title ||
      a.body !== b.body ||
      a.imageSrc !== b.imageSrc ||
      a.imagePrompt !== b.imagePrompt
    ) {
      return false;
    }

    const aMetadata = a.metadata;
    const bMetadata = b.metadata;

    if (aMetadata !== bMetadata) {
      if (!aMetadata || !bMetadata) return false;
      if (JSON.stringify(aMetadata) !== JSON.stringify(bMetadata)) return false;
    }
  }

  return true;
}

const isCanvasIdle$ = canvasInteraction$.pipe(
  scan((activeCount, event) => {
    if (event === "start") return activeCount + 1;
    return Math.max(0, activeCount - 1);
  }, 0),
  map((activeCount) => activeCount === 0),
  startWith(true),
  distinctUntilChanged(),
  shareReplay({ refCount: true, bufferSize: 1 }),
);

// Auto-save items when they change (debounced)
const autoSave$ = items$.pipe(
  skip(1), // Skip initial empty value
  map(toPersistedItems),
  distinctUntilChanged(isSamePersistedItems),
  switchMap((items) =>
    isCanvasIdle$.pipe(
      filter((isIdle) => isIdle),
      take(1),
      map(() => items),
    ),
  ),
  debounceTime(250),
  switchMap((items) =>
    saveCanvasItems(items as CanvasItem[]).catch((error) => {
      console.error("Failed to save canvas items:", error);
    }),
  ),
);

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const trayWidth$ = new BehaviorSubject(320); // 20rem in px
  const canvasUI = CanvasComponent({ items$, apiKeys$, interaction$: canvasInteraction$ });
  const contextTrayUI = ContextTrayComponent({ items$, apiKeys$ });
  const resizerUI = ResizerComponent({ trayWidth$ });
  const connectionsUI = ConnectionsComponent({ apiKeys$ });

  const effects$ = merge(taskRunner$, autoSave$).pipe(ignoreElements());

  const template$ = of(html`
    <header class="app-header">
      <h1>Computational Mood Board</h1>
      <div class="app-header__right">
        ${observe(progressText)}
        ${observe(
          hasActiveTasks.pipe(
            map((hasActive) => (hasActive ? html`<button @click=${stopTasks}>Stop</button>` : html``)),
          ),
        )}
        <button commandfor="connection-dialog" command="show-modal">Setup</button>
      </div>
    </header>
    <main class="main" style="--tray-width: ${observe(trayWidth$)}px;">
      <div class="canvas-area">${canvasUI}</div>
      ${resizerUI}
      <div class="context-tray-area">${contextTrayUI}</div>
    </main>
    <dialog class="connection-form" id="connection-dialog">
      <div class="connections-dialog-body">
        ${connectionsUI}
        <form method="dialog">
          <button>Close</button>
        </form>
      </div>
    </dialog>
  `).pipe(mergeWith(effects$));

  return template$;
});

render(Main(), document.getElementById("app")!);
