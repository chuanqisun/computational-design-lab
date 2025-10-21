import { html, render } from "lit-html";
import { BehaviorSubject, ignoreElements, map, merge, mergeWith, of } from "rxjs";
import "./canvas-page.css";
import type { CanvasItem } from "./components/canvas/canvas.component";
import { CanvasComponent } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { taskRunner$ } from "./components/context-tray/tasks";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { hasActiveTasks, progressText, stopTasks } from "./components/progress/progress";
import { ResizerComponent } from "./components/resizer/resizer";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const items$ = new BehaviorSubject<CanvasItem[]>([]);
  const trayWidth$ = new BehaviorSubject(320); // 20rem in px
  const canvasUI = CanvasComponent({ items$, apiKeys$ });
  const contextTrayUI = ContextTrayComponent({ items$, apiKeys$ });
  const resizerUI = ResizerComponent({ trayWidth$ });
  const connectionsUI = ConnectionsComponent({ apiKeys$ });

  const effects$ = merge(taskRunner$).pipe(ignoreElements());

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
