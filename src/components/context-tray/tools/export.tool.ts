import { html, nothing } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";

/** UI-adapter side effect of export_cards: open the exported cards in Studio. */
function openInStudio(data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const blobUrl = URL.createObjectURL(blob);
  const studioUrl = new URL("studio.html", window.location.href);
  studioUrl.searchParams.set("fromCanvasBlob", blobUrl);
  window.open(studioUrl.href, "_blank");
  // Revoke the blob URL after enough time for the new tab to fetch it
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

export const ExportTool = createComponent(
  ({ items$, apiKeys$ }: { items$: BehaviorSubject<CanvasItem[]>; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const runtime = getActionRuntime(items$, apiKeys$);

    const exportSelected = () => {
      const cardIds = items$.value.filter((item) => item.isSelected).map((item) => item.id);
      runUserAction(runtime, "export_cards", { cardIds }, (result) => {
        if (result && !result.error) openInStudio(result.data);
      });
    };

    return items$.pipe(
      map((items) => {
        const selected = items.filter((item) => item.isSelected);
        if (selected.length === 0) return html`${nothing}`;
        return html`<button @click=${exportSelected}>Open in Studio (${selected.length})</button>`;
      }),
    );
  },
);
