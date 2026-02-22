import { html } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import "./text-content.tool.css";

export const TextContentTool = createComponent(
  ({ selected$, items$ }: { selected$: Observable<CanvasItem[]>; items$: BehaviorSubject<CanvasItem[]> }) => {
    const updateItem = (id: string, updates: Partial<CanvasItem>) => {
      const currentItems = items$.value;
      const nextItems = currentItems.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      items$.next(nextItems);
    };

    return selected$.pipe(
      map((selected) => {
        if (selected.length === 0) return html``;
        return html`
          <div class="text-content-tool">
            ${repeat(
              selected,
              (card) => card.id,
              (card) => html`
                <div class="text-item-content">
                  <div class="input-group">
                    <label for="title-${card.id}">Title</label>
                    <input
                      id="title-${card.id}"
                      type="text"
                      .value=${card.title || ""}
                      @input=${(e: Event) =>
                        updateItem(card.id, {
                          title: (e.target as HTMLInputElement).value,
                        })}
                    />
                  </div>
                  <div class="input-group">
                    <label for="body-${card.id}">Body</label>
                    <textarea
                      id="body-${card.id}"
                      .value=${card.body || ""}
                      @input=${(e: Event) =>
                        updateItem(card.id, {
                          body: (e.target as HTMLTextAreaElement).value,
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
