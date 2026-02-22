import { html, nothing } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";

export const ExportTool = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  const openInStudio = () => {
    const selected = items$.value.filter((item) => item.isSelected);
    const data = selected.map(({ isSelected: _isSelected, ...item }) => item);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);
    const studioUrl = new URL("studio.html", window.location.href);
    studioUrl.searchParams.set("fromCanvasBlob", blobUrl);
    window.open(studioUrl.href, "_blank");
    // Revoke the blob URL after enough time for the new tab to fetch it
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  };

  return items$.pipe(
    map((items) => {
      const selected = items.filter((item) => item.isSelected);
      if (selected.length === 0) return html`${nothing}`;
      return html`<button @click=${openInStudio}>Open in Studio (${selected.length})</button>`;
    }),
  );
});
