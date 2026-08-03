import { GoogleGenAI } from "@google/genai";
import { Observable, from } from "rxjs";
import { progress$ } from "../progress/progress";

export function imageToimage(input: { instruction: string; image: string; apiKey: string }): Observable<string> {
  return from(
    (async () => {
      progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const model = "gemini-3.1-flash-lite-image";

        // Helper to parse data URL
        const parseDataUrl = (dataUrl: string) => {
          const [header, data] = dataUrl.split(",");
          const mimeType = header.split(":")[1].split(";")[0];
          return { mimeType, data };
        };

        // Add the image to parts
        const { mimeType, data } = parseDataUrl(input.image);

        const response = await ai.interactions.create({
          model,
          input: [
            {
              type: "user_input",
              content: [
                { type: "image", mime_type: mimeType, data },
                { type: "text", text: input.instruction },
              ],
            },
          ],
          response_modalities: ["image"],
          store: false,
          stream: true,
        });

        const images = new Map<number, { mimeType: string; data: string }>();
        for await (const event of response) {
          if (event.event_type !== "step.delta" || event.delta.type !== "image" || !event.delta.data) continue;

          const current = images.get(event.index);
          images.set(event.index, {
            mimeType: event.delta.mime_type || current?.mimeType || "image/png",
            data: `${current?.data || ""}${event.delta.data}`,
          });
        }

        const image = images.values().next().value;
        return image ? `data:${image.mimeType};base64,${image.data}` : "";
      } finally {
        progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen - 1 });
      }
    })(),
  );
}
