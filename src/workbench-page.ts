import { html, render } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import type { ImageItem } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { FluxImageElement } from "./components/generative-image/generative-image";
import { SpectroAlignmentComponent } from "./components/spectro-alighment/spectro-alignment.component";
import { createComponent } from "./sdk/create-component";
import "./workbench-page.css";

// Register custom elements
FluxImageElement.define(() => ({
  apiKey: loadApiKeys().together || "",
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
          <section class="tool-section">
            <header class="tool-header">
              <h2>Spectro Alignment</h2>
            </header>
            <div class="tool-content">${SpectroAlignmentComponent({ apiKeys$ })}</div>
          </section>

          <section class="tool-section">
            <header class="tool-header">
              <h2>Conceptual Blender</h2>
            </header>
            <div class="tool-content">
              <!-- Tool implementation placeholder -->
            </div>
          </section>
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
