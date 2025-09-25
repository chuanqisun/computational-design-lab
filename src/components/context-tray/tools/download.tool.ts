import { html } from "lit-html";
import { map, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { ImageItem } from "../../canvas/canvas.component";

export const DownloadTool = createComponent(({ selectedImages$ }: { selectedImages$: Observable<ImageItem[]> }) => {
  const downloadImage = (src: string, filename: string) => {
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return selectedImages$.pipe(
    map((selectedImages) => {
      if (selectedImages.length !== 1) return html``;
      return html`<button @click=${() => downloadImage(selectedImages[0].src, `${Date.now()}.png`)}>Download</button>`;
    }),
  );
});
