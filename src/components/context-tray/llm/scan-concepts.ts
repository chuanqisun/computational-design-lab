import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";
import type { ImageItem, TextItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type ConceptualScanInput = Pick<TextItem, "title" | "content"> | Pick<ImageItem, "src">;

export interface Concept {
  title: string;
  description: string;
}

export function scanConcepts$(inputs: {
  items: ConceptualScanInput[];
  instruction: string;
  apiKey: string;
}): Observable<Concept> {
  return new Observable<Concept>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: inputs.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit concepts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "concepts" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const concept = entry.value as unknown as Concept;
        if (concept.title && concept.description) {
          subscriber.next(concept);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        // Build content array with text and images
        const contentItems = inputs.items.map((item) => {
          if ("src" in item) {
            return { type: "input_image" as const, image_url: item.src, detail: "auto" as const };
          } else {
            return { type: "input_text" as const, text: `${item.title}: ${item.content}` };
          }
        });

        const developerPrompt = `Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.

Respond in this JSON format:
{
  "concepts": [
    {
      "title": "string",
      "description": "string"
    }
  ]
}`;

        const userMessage = inputs.instruction;

        const response = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: [
              { role: "developer", content: developerPrompt },
              {
                role: "user",
                content: [{ type: "input_text", text: userMessage }, ...contentItems],
              },
            ],
            reasoning: { effort: "minimal" },
            text: { verbosity: "low", format: { type: "json_object" } },
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of response) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}
