import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import {
  GEMINI_IMAGE_MODEL,
  GEMINI_SEARCH_IMAGE_THINKING,
  GEMINI_TEXT_MODEL,
  GEMINI_TEXT_THINKING,
} from "../../../lib/gemini-models";
import { progress$ } from "../../progress/progress";

export interface SearchResultItem {
  title: string;
  details: string;
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

export function streamSearchResults$({
  apiKey,
  prompt,
  contextText,
  images = [],
  maxResults = 9,
}: {
  apiKey: string;
  prompt: string;
  contextText?: string;
  images?: string[];
  maxResults?: number;
}): Observable<SearchResultItem> {
  return new Observable<SearchResultItem>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    const ai = new GoogleGenAI({ apiKey });
    const parser = new JSONParser();
    let emittedCount = 0;

    parser.onValue = (entry) => {
      if (emittedCount >= maxResults) return;
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const item = entry.value as Record<string, unknown>;
        const title = typeof item.title === "string" ? item.title.trim() : "";
        const details = typeof item.details === "string" ? item.details.trim() : "";
        if (title && details) {
          emittedCount += 1;
          subscriber.next({ title, details });
        }
      }
    };

    void (async () => {
      try {
        const schema = {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  details: { type: "string" },
                },
                required: ["title", "details"],
              },
            },
          },
          required: ["results"],
        };

        const searchPrompt = `Search online to find the top ${maxResults} most representative, distinct real-world products, references, or projects for the request below.
For each result, return:
- "title": exact, concise name (product, project, or reference title, max 6 words).
- "details": precise, concise 1-2 sentence description of its key visual features, materials/form, and why it is a strong reference.
Keep entries accurate, specific, and non-redundant.

Request: ${prompt.trim()}${contextText ? `\n\nSelected canvas context:\n${contextText}` : ""}`;

        const content: Interactions.Content[] = [...images.map(toImageContent), { type: "text", text: searchPrompt }];
        const input: Interactions.Step[] = [{ type: "user_input", content }];

        const stream = await ai.interactions.create(
          {
            model: GEMINI_TEXT_MODEL,
            input,
            tools: [{ type: "google_search" }],
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: GEMINI_TEXT_THINKING },
            store: false,
            stream: true,
          },
          { signal: abortController.signal },
        );

        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta.type === "text") {
            parser.write(event.delta.text);
          }
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}

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

      const runAttempt = (tools?: Interactions.Tool[]) =>
        ai.interactions.create(
          {
            model: GEMINI_IMAGE_MODEL,
            input,
            ...(tools ? { tools } : {}),
            response_format: {
              type: "image",
              mime_type: "image/jpeg",
              aspect_ratio: "1:1",
              image_size: "1K",
            },
            generation_config: { thinking_level: GEMINI_SEARCH_IMAGE_THINKING },
            store: false,
          },
          { signal: abortController.signal },
        );

      const toolAttempts: (Interactions.Tool[] | undefined)[] = [
        [{ type: "google_search", search_types: ["web_search", "image_search"] }],
        [{ type: "google_search", search_types: ["web_search"] }],
        undefined,
      ];

      let interaction: Awaited<ReturnType<typeof runAttempt>> | undefined;
      let lastError: unknown;
      for (const tools of toolAttempts) {
        if (abortController.signal.aborted) break;
        try {
          interaction = await runAttempt(tools);
          break;
        } catch (error) {
          lastError = error;
          if (abortController.signal.aborted) throw error;
          const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : NaN;
          if (status !== 400) throw error;
        }
      }

      if (!interaction) throw lastError ?? new Error("Search did not return an image.");

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
