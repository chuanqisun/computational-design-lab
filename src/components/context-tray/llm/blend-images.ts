import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

/**
 * Use Google Gen AI gemini flash 2.5 image model to blend items based on user provided instruction.
 * Returns the observable of image data url
 */
export function blendImages(input: { instruction: string; items: CanvasItem[]; apiKey: string }): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });

    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen - 1 });
      abortController.abort();
    });

    (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const model = "gemini-3.1-flash-image";
        const parts: Interactions.Content[] = [
          {
            type: "text",
            text: input.instruction,
          },
        ];

        // Helper to parse data URL
        const parseDataUrl = (dataUrl: string) => {
          const [header, data] = dataUrl.split(",");
          const mimeType = header.split(":")[1].split(";")[0];
          return { mimeType, data };
        };

        // Add items to parts
        for (const item of input.items) {
          if (item.imageSrc) {
            const { mimeType, data } = parseDataUrl(item.imageSrc);
            parts.push({
              type: "image",
              mime_type: mimeType,
              data,
            });
          }
          if (item.body) {
            parts.push({
              type: "text",
              text: item.body,
            });
          }
        }

        const response = await ai.interactions.create(
          {
            model,
            input: parts,
            response_modalities: ["image"],
            store: false,
            stream: true,
          },
          { signal: abortController.signal },
        );

        const images = new Map<number, { mimeType: string; data: string }>();
        for await (const event of response) {
          if (event.event_type !== "step.delta" || event.delta.type !== "image" || !event.delta.data) continue;

          const current = images.get(event.index);
          images.set(event.index, {
            mimeType: event.delta.mime_type || current?.mimeType || "image/png",
            data: `${current?.data || ""}${event.delta.data}`,
          });
        }

        const image = [...images.values()].at(-1);
        const imageUrl = image ? `data:${image.mimeType};base64,${image.data}` : "";

        subscriber.next(imageUrl);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
