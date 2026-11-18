import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_IMAGE_MODEL, GEMINI_SEARCH_IMAGE_THINKING } from "../../../lib/gemini-models";
import { progress$ } from "../../progress/progress";

export interface SearchImagesResult {
  url: string;
  searchSuggestions: string[];
}

const toImageContent = (image: string): Interactions.Content => {
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Search requires embedded image cards.");
  return { type: "image", mime_type: match[1], data: match[2] };
};

export function searchImages(apiKey: string, prompt: string, images: string[] = []): Observable<SearchImagesResult> {
  return new Observable((subscriber) => {
    progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, imageGen: Math.max(0, progress$.value.imageGen - 1) });
      abortController.abort();
    });

    void (async () => {
      const content: Interactions.Content[] = [...images.map(toImageContent), { type: "text", text: prompt }];
      const input: Interactions.Step[] = [{ type: "user_input", content }];
      const ai = new GoogleGenAI({ apiKey });

      const interaction = await ai.interactions.create(
        {
          model: GEMINI_IMAGE_MODEL,
          input,
          tools: [{ type: "google_search", search_types: ["web_search", "image_search"] }],
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
            aspect_ratio: "1:1",
            image_size: "2K",
          },
          generation_config: { thinking_level: GEMINI_SEARCH_IMAGE_THINKING },
          store: false,
        },
        { signal: abortController.signal },
      );

      const stepImage = interaction.steps
        .filter((step): step is Interactions.ModelOutputStep => step.type === "model_output")
        .flatMap((step) => step.content || [])
        .find((block): block is Interactions.ImageContent => block.type === "image" && Boolean(block.data));
      const output = stepImage || interaction.output_image;
      if (!output?.data) throw new Error("Search did not return an image.");

      const searchSuggestions = interaction.steps
        .filter((step): step is Interactions.GoogleSearchResultStep => step.type === "google_search_result")
        .flatMap((step) => step.result || [])
        .flatMap((item) => (item.search_suggestions ? [item.search_suggestions] : []));

      subscriber.next({
        url: `data:${output.mime_type || "image/jpeg"};base64,${output.data}`,
        searchSuggestions,
      });
      subscriber.complete();
    })().catch((error) => subscriber.error(error));
  });
}
