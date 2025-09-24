import { html, render } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import type { ImageItem } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { SemanticScanComponent } from "./components/semantic-scan/semantic-scan.component";
import { SpectroAlignmentComponent } from "./components/spectro-alignment/spectro-alignment.component";
import { createComponent } from "./sdk/create-component";
import "./workbench-page.css";

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const images$ = new BehaviorSubject<ImageItem[]>([]);

  const template$ = images$.pipe(
    map(() => {
      return html`
        <header class="app-header">
          <h1>Workbench</h1>
          <button commandfor="connection-dialog" command="show-modal">Setup</button>
        </header>
        <main class="main">
          <details>
            <summary>Semantic Scan</summary>
            <div class="tool-content">
              ${SemanticScanComponent({ apiKeys$ })}
            </div>
          </details>
          <details>
              <summary>Spectro Alignment</summary>
            </header>
            <div class="tool-content">${SpectroAlignmentComponent({ apiKeys$ })}</div>
          </details>

          <details>
            <summary>
              Conceptual Blender
            </summary>
            <div class="tool-content">
              <!-- Tool implementation placeholder -->
            </div>
          </details>
        </main>
        ${ContextTrayComponent({ images$, apiKeys$ })}
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
