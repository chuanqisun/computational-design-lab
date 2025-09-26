import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import "./canvas-page.css";
import type { CanvasItem } from "./components/canvas/canvas.component";
import { CanvasComponent } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { progress$ } from "./components/progress/progress";
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

  const progressText = progress$.pipe(
    map((status) => {
      const tasks = [];
      if (status.textGen > 0) tasks.push(`Writing ${status.textGen} items`);
      if (status.imageGen > 0) tasks.push(`Rendering ${status.imageGen} items`);
      return tasks.join(" | ") || "Idle";
    }),
  );

  const template$ = combineLatest([items$, trayWidth$]).pipe(
    map(([, trayWidth]) => {
      return html`
        <header class="app-header">
          <h1>Computational Mood Board</h1>
          <div class="app-header__right">
            ${observe(progressText)}
            <button commandfor="connection-dialog" command="show-modal">Setup</button>
          </div>
        </header>
        <main class="main" style="--tray-width: ${trayWidth}px;">
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
      `;
    }),
  );

  return template$;
});

render(Main(), document.getElementById("app")!);
