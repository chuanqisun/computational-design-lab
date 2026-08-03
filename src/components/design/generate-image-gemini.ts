import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";

export interface GeminiConnection {
  apiKey: string;
}

export interface GenerateImageOptions {
  prompt: string;
  width: number;
  height: number;
  model?: string;
  images?: string[];
  aspectRatio?: string;
}

export interface GenerateImageResult {
  url: string;
}

export function generateImage(
  connection: GeminiConnection,
  options: GenerateImageOptions,
): Observable<GenerateImageResult> {
  return new Observable<GenerateImageResult>((subscriber) => {
    progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });

    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen - 1 });
      abortController.abort();
    });

    if (!options.prompt.trim()) {
      subscriber.error(new Error("Prompt cannot be empty"));
      return;
    }

    (async () => {
      const ai = new GoogleGenAI({
        apiKey: connection.apiKey,
      });

      const model = options.model || "gemini-3.1-flash-image";
      const input: Interactions.Content[] = [
        ...(options.images?.map((image) => {
          const [mimeTypePart, data] = image.split(",");
          const mimeType = mimeTypePart.split(":")[1].split(";")[0];
          return { type: "image" as const, data, mime_type: mimeType };
        }) || []),
        { type: "text", text: options.prompt },
      ];

      const response = await ai.interactions.create(
        {
          model,
          input,
          response_modalities: ["image"],
          ...(options.aspectRatio
            ? { response_format: { type: "image" as const, aspect_ratio: options.aspectRatio } }
            : {}),
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

      const imageUrls = [...images.values()].map(({ mimeType, data }) => `data:${mimeType};base64,${data}`);

      if (imageUrls.length > 0) {
        subscriber.next({
          url: imageUrls[0],
        });
        subscriber.complete();
      } else {
        subscriber.error(new Error("No image generated"));
      }
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}
