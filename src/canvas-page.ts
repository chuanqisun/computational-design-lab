import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import "./canvas-page.css";
import type { CanvasItem } from "./components/canvas/canvas.component";
import { CanvasComponent } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { ResizerComponent } from "./components/resizer/resizer";
import { createComponent } from "./sdk/create-component";

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const items$ = new BehaviorSubject<CanvasItem[]>([]);
  const trayWidth$ = new BehaviorSubject(320); // 20rem in px

  const template$ = combineLatest([items$, trayWidth$]).pipe(
    map(([, trayWidth]) => {
      return html`
        <header class="app-header">
          <h1>Computational Mood Board</h1>
          <button commandfor="connection-dialog" command="show-modal">Setup</button>
        </header>
        <main class="main" style="--tray-width: ${trayWidth}px;">
          <div class="canvas-area">${CanvasComponent({ items$, apiKeys$ })}</div>
          ${ResizerComponent({ trayWidth$ })}
          <div class="context-tray-area">${ContextTrayComponent({ items$, apiKeys$ })}</div>
        </main>
        <dialog class="connection-form" id="connection-dialog">
          <div class="connections-dialog-body">
            ${ConnectionsComponent({ apiKeys$ })}
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
