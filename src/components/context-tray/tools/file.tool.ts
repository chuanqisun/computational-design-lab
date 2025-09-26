import { html } from "lit-html";
import { map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { ImageItem } from "../../canvas/canvas.component";

export const FileTool = createComponent(({ selectedImages$ }: { selectedImages$: Observable<ImageItem[]> }) => {
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

  return selectedImages$.pipe(
    map((selectedImages) => {
      if (selectedImages.length !== 1) return html``;
      return html`
        <button @click=${() => downloadImage(selectedImages[0].src, `${Date.now()}.png`)}>Download</button>
        <button @click=${() => copyImage(selectedImages[0].src)}>Copy</button>
        <button @click=${() => viewImage(selectedImages[0].src)}>View</button>
      `;
    }),
  );
});
