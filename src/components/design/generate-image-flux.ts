import { Observable } from "rxjs";
import Together from "together-ai";
import { progress$ } from "../progress/progress";

export interface FluxConnection {
  apiKey: string;
}

export interface GenerateImageOptions {
  prompt: string;
  width: number;
  height: number;
  model?: string;
  aspectRatio?: string;
}

export interface GenerateImageResult {
  url: string;
}

export function generateImage(
  connection: FluxConnection,
  options: GenerateImageOptions,
): Observable<GenerateImageResult> {
  return new Observable<GenerateImageResult>((subscriber) => {
    progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen - 1 });
    });

    if (!options.prompt.trim()) {
      subscriber.error(new Error("Prompt cannot be empty"));
      return;
    }

    const together = new Together({
      apiKey: connection.apiKey,
    });

    together.images
      .create({
        model: options.model || "black-forest-labs/FLUX.1-schnell-free",
        prompt: options.prompt,
        width: options.width,
        height: options.height,
        disable_safety_checker: true,
        steps: 4,
      })
      .then((response) => {
        if (!response.data || response.data.length === 0) {
          subscriber.error(new Error("No image data received from Together.ai"));
          return;
        }

        const imageData = response.data[0];
        let url: string;

        if ("b64_json" in imageData && imageData.b64_json) {
          url = `data:image/png;base64,${imageData.b64_json}`;
        } else if ("url" in imageData && imageData.url) {
          url = imageData.url;
        } else {
          subscriber.error(new Error("No valid image data received"));
          return;
        }

        subscriber.next({
          url,
        });
        subscriber.complete();
      })
      .catch((error) => {
        subscriber.error(error);
      });
  });
}
