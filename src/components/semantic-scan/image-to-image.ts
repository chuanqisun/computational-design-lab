import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_IMAGE_EDIT_MODEL, GEMINI_IMAGE_THINKING } from "../../lib/gemini-models";
import { progress$ } from "../progress/progress";

export function imageToimage(input: { instruction: string; image: string; apiKey: string }): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, imageGen: Math.max(0, progress$.value.imageGen - 1) });
      abortController.abort();
    });

    void (async () => {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });

      // Helper to parse data URL
      const parseDataUrl = (dataUrl: string) => {
        const [header, data] = dataUrl.split(",");
        const mimeType = header.split(":")[1].split(";")[0];
        return { mimeType, data };
      };

      // Add the image to parts
      const { mimeType, data } = parseDataUrl(input.image);

      const response = await ai.interactions.create(
        {
          model: GEMINI_IMAGE_EDIT_MODEL,
          input: [
            {
              type: "user_input",
              content: [
                { type: "image", mime_type: mimeType, data },
                { type: "text", text: input.instruction },
              ],
            },
          ],
          response_format: { type: "image" },
          generation_config: { thinking_level: GEMINI_IMAGE_THINKING },
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

      const image = images.values().next().value;
      subscriber.next(image ? `data:${image.mimeType};base64,${image.data}` : "");
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}
