import type { Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../../progress/progress";

interface ImageBlock {
  type?: string;
  data?: string;
  mime_type?: string;
}

interface SearchStep {
  content?: ImageBlock[];
  google_search_result?: { search_suggestions?: string };
}

interface SearchResponse {
  steps?: SearchStep[];
  output_image?: ImageBlock;
  error?: { message?: string };
}

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

    const content: Interactions.Content[] = [...images.map(toImageContent), { type: "text", text: prompt }];
    const input: Interactions.Step[] = [{ type: "user_input", content }];

    void fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image",
        input,
        tools: [{ type: "google_search", search_types: ["web_search", "image_search"] }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "1:1",
          image_size: "2K",
        },
        store: false,
      }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as SearchResponse;
        if (!response.ok) throw new Error(result.error?.message || "Search image query failed.");

        const image = result.steps
          ?.flatMap((step) => step.content || [])
          .find((block) => block.type === "image" && block.data);
        const output = image || result.output_image;
        if (!output?.data) throw new Error("Search did not return an image.");

        subscriber.next({
          url: `data:${output.mime_type || "image/jpeg"};base64,${output.data}`,
          searchSuggestions:
            result.steps?.flatMap((step) =>
              step.google_search_result?.search_suggestions ? [step.google_search_result.search_suggestions] : [],
            ) || [],
        });
        subscriber.complete();
      })
      .catch((error) => subscriber.error(error));
  });
}
