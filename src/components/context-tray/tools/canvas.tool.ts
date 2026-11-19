import { html } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";

export const CanvasTool = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const runtime = getActionRuntime(items$, apiKeys$);

    const gatherItems = () => runUserAction(runtime, "move_cards", { arrange: "gather" });
    // Organizes the selection, or the whole board when nothing is selected.
    const organizeItems = () => {
      const cardIds = items$.value.filter((item) => item.isSelected).map((item) => item.id);
      runUserAction(runtime, "move_cards", cardIds.length ? { arrange: "organize", cardIds } : { arrange: "organize" });
    };
    const focusSelected = () =>
      runUserAction(runtime, "move_cards", {
        arrange: "focus",
        cardIds: items$.value.filter((item) => item.isSelected).map((item) => item.id),
      });
    const clearAll = () => runUserAction(runtime, "clear_canvas", { confirm: true });

    return items$.pipe(
      map((items) => {
        const hasSelection = items.some((item) => item.isSelected);

        return html`
          <button @click=${gatherItems} ?disabled=${items.length === 0}>Gather</button>
          <button
            @click=${organizeItems}
            ?disabled=${items.length === 0}
            title=${hasSelection ? "Arrange selected cards by creation: one row per action" : "Arrange all cards by creation: one row per action"}
          >
            Organize
          </button>
          <button @click=${focusSelected} ?disabled=${!hasSelection}>Focus</button>
          <button @click=${clearAll} ?disabled=${items.length === 0}>Destroy</button>
        `;
      }),
    );
  },
);
