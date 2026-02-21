import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem, TextItem } from "../../canvas/canvas.component";
import "./text-content.tool.css";

export const TextContentTool = createComponent(
  ({ selectedTexts$, items$ }: { selectedTexts$: Observable<TextItem[]>; items$: BehaviorSubject<CanvasItem[]> }) => {
    const updateItem = (id: string, updates: Partial<TextItem>) => {
      const currentItems = items$.value;
      const nextItems = currentItems.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      items$.next(nextItems);
    };

    return selectedTexts$.pipe(
      map((selectedTexts) => {
        if (selectedTexts.length === 0) return html``;
        return html`
          <div class="text-content-tool">
            ${repeat(
              selectedTexts,
              (txt) => txt.id,
              (txt) => html`
                <div class="text-item-content">
                  <div class="input-group">
                    <label for="title-${txt.id}">Title</label>
                    <input
                      id="title-${txt.id}"
                      type="text"
                      .value=${txt.title}
                      @input=${(e: Event) =>
                        updateItem(txt.id, {
                          title: (e.target as HTMLInputElement).value,
                        })}
                    />
                  </div>
                  <div class="input-group">
                    <label for="content-${txt.id}">Content</label>
                    <textarea
                      id="content-${txt.id}"
                      .value=${txt.content}
                      @input=${(e: Event) =>
                        updateItem(txt.id, {
                          content: (e.target as HTMLTextAreaElement).value,
                        })}
                    ></textarea>
                  </div>
                </div>
              `,
            )}
          </div>
        `;
      }),
    );
  },
);
