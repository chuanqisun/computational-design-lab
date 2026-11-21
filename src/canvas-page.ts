import { html, render } from "lit-html";
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  filter,
  fromEvent,
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
  tap,
} from "rxjs";
import "./canvas-page.css";
import { CanvasComponent, type CanvasItem } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import {
  loadApiKeys,
  loadCanvasItems,
  loadViewportCenter,
  saveCanvasItems,
  saveViewportCenter,
  type ApiKeys,
} from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { taskRunner$ } from "./components/context-tray/tasks";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { hasActiveTasks, progressText, stopTasks } from "./components/progress/progress";
import { ResizerComponent } from "./components/resizer/resizer";
import { TraceDialogComponent } from "./components/workflow/trace-dialog.component";
import { WorkflowEditorComponent } from "./components/workflow/workflow-editor.component";
import { getActionRuntime } from "./lib/actions/app-runtime";
import { getWorldViewport, refreshViewport, scrollToWorld } from "./components/canvas/canvas-viewport";
import { MinimapComponent } from "./components/canvas/minimap.component";
import { persistSubject } from "./lib/persistence";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

// Register custom elements
GenerativeImageElement.define(() => ({
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

// Initialize items from IndexedDB (with migration)
const items$ = new BehaviorSubject<CanvasItem[]>([]);
const canvasInteraction$ = new Subject<"start" | "end">();

const CANVAS_CENTER = { centerX: 4000, centerY: 4000 };

/** Saved centers are world coordinates (identical to the legacy fixed board's scroll coordinates). */
function restoreViewport(canvasArea: HTMLElement, hasItems: boolean) {
  const saved = loadViewportCenter();
  const center = saved ?? (hasItems ? null : CANVAS_CENTER);
  if (!center) {
    refreshViewport();
    return;
  }
  scrollToWorld(center.centerX - canvasArea.clientWidth / 2, center.centerY - canvasArea.clientHeight / 2);
}

loadCanvasItems().then((loadedItems) => {
  // Pending work does not survive a reload; clear stale markers so cards render normally.
  items$.next(
    loadedItems.map((item) =>
      item.metadata?.pending || item.metadata?.pendingImage
        ? { ...item, metadata: { ...item.metadata, pending: undefined, pendingImage: undefined } }
        : item,
    ),
  );
  requestAnimationFrame(() => {
    const canvasArea = document.querySelector(".canvas-area") as HTMLElement;
    if (canvasArea) restoreViewport(canvasArea, loadedItems.length > 0);
  });
});

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

/** Scroll the canvas so the first card the agent created or changed is visible (its output flows down the board). */
function revealCards(ids: string[]) {
  const card = items$.value.find((item) => item.id === ids[0]);
  if (!card) return;
  const view = getWorldViewport();
  const visible =
    card.x + card.width > view.x &&
    card.x < view.x + view.width &&
    card.y + card.height > view.y &&
    card.y < view.y + view.height;
  if (visible) return;
  scrollToWorld(card.x - view.width / 4, card.y - view.height / 4, "smooth");
}

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const runtime = getActionRuntime(items$, apiKeys$);
  void persistSubject(runtime.log.records$, "canvas:action-log");

  const revealEffect$ = runtime.reveal$.pipe(
    switchMap((event) =>
      isCanvasIdle$.pipe(
        filter((isIdle) => isIdle),
        take(1),
        map(() => event),
      ),
    ),
    debounceTime(50),
    tap((event) => requestAnimationFrame(() => revealCards(event.ids))),
  );
  const trayWidth$ = new BehaviorSubject(320); // 20rem in px
  const canvasUI = CanvasComponent({ items$, apiKeys$, interaction$: canvasInteraction$ });
  const minimapUI = MinimapComponent({ items$ });
  const contextTrayUI = ContextTrayComponent({ items$, apiKeys$ });
  const resizerUI = ResizerComponent({ trayWidth$ });
  const connectionsUI = ConnectionsComponent({ apiKeys$, providers: ["gemini"] });
  const traceDialogUI = TraceDialogComponent({ runtime });
  const workflowEditorUI = WorkflowEditorComponent({ runtime, apiKeys$ });

  const saveViewport$ = fromEvent(document, "scroll", { capture: true }).pipe(
    filter((e) => (e.target as HTMLElement).classList?.contains("canvas-area")),
    debounceTime(300),
    tap(() => {
      const view = getWorldViewport();
      saveViewportCenter({ centerX: view.x + view.width / 2, centerY: view.y + view.height / 2 });
    }),
    ignoreElements(),
  );

  const effects$ = merge(taskRunner$, autoSave$, saveViewport$, revealEffect$).pipe(ignoreElements());

  const template$ = of(html`
    <header class="app-header">
      <div class="app-header__left">
        <h1>Computational Mood Board</h1>
        <nav class="app-header__nav">
          <a href="prompt-library.html" target="_blank">Prompts</a>
          <a href="canvas-guide.html" target="_blank">Help</a>
        </nav>
      </div>
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
      ${minimapUI}
      ${resizerUI}
      <div class="context-tray-area">${contextTrayUI}</div>
    </main>
    ${traceDialogUI}
    ${workflowEditorUI}
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
