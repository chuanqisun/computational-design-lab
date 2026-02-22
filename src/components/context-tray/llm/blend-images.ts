import { GoogleGenAI, type Part } from "@google/genai";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

/**
 * Use Google Gen AI gemini flash 2.5 image model to blend items based on user provided instruction.
 * Returns the observable of image data url
 */
export function blendImages(input: {
  instruction: string;
  items: CanvasItem[];
  apiKey: string;
}): Observable<string> {
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
        const model = "gemini-2.5-flash-image";
        const config = {
          responseModalities: ["IMAGE"],
          abortSignal: abortController.signal,
        };

        const parts: Part[] = [
          {
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
              inlineData: { mimeType, data },
            });
          }
          if (item.body) {
            parts.push({
              text: item.body,
            });
          }
        }

        const response = await ai.models.generateContentStream({
          model,
          config,
          contents: [
            {
              role: "user",
              parts,
            },
          ],
        });

        let imageUrl = "";
        for await (const chunk of response) {
          if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
            continue;
          }

          const chunkParts = chunk.candidates[0].content.parts;
          for (const part of chunkParts) {
            if (part.inlineData) {
              const { mimeType, data } = part.inlineData;
              imageUrl = `data:${mimeType};base64,${data}`;
            }
          }
        }

        subscriber.next(imageUrl);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
