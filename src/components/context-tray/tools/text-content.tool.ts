import { html } from "lit-html";
import { map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { TextItem } from "../../canvas/canvas.component";

export const TextContentTool = createComponent(({ selectedTexts$ }: { selectedTexts$: Observable<TextItem[]> }) => {
  return selectedTexts$.pipe(
    map((selectedTexts) => {
      if (selectedTexts.length === 0) return html``;
      return html`
        <div class="text-content-section">
          ${selectedTexts.map(
            (txt: TextItem) => html`
              <div class="text-item-content">
                <h3>${txt.title}</h3>
                <div class="text-content">${txt.content}</div>
              </div>
            `,
          )}
        </div>
      `;
    }),
  );
});
