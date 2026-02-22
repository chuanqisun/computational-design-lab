import { html } from "lit-html";
import { map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";

export const FileTool = createComponent(({ selectedWithImage$ }: { selectedWithImage$: Observable<CanvasItem[]> }) => {
  const downloadImage = (src: string, filename: string) => {
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyImage = async (src: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const mimeType = blob.type || "image/png";
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
    } catch (error) {
      console.error("Failed to copy image:", error);
    }
  };

  const viewImage = async (src: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error("Failed to view image:", error);
    }
  };

  return selectedWithImage$.pipe(
    map((selected) => {
      if (selected.length !== 1 || !selected[0].imageSrc) return html``;
      const src = selected[0].imageSrc;
      return html`
        <button @click=${() => downloadImage(src, `${Date.now()}.png`)}>Download</button>
        <button @click=${() => copyImage(src)}>Copy</button>
        <button @click=${() => viewImage(src)}>View</button>
      `;
    }),
  );
});
