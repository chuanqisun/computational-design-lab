import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../../lib/gemini-models";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type ConceptualScanInput = CanvasItem;

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
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });
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

    (async () => {
      try {
        const schema = {
          type: "object",
          properties: {
            concepts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["title", "description"],
              },
            },
          },
          required: ["concepts"],
        };

        const developerPrompt = `Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.`;

        const parts: Interactions.Content[] = [{ type: "text", text: inputs.instruction }];

        for (const item of inputs.items) {
          if (item.imageSrc) {
            const base64Data = item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
            parts.push({ type: "image", data: base64Data, mime_type: mimeType });
          }
          if (item.body) {
            parts.push({ type: "text", text: `${item.title || ""}: ${item.body}` });
          }
        }

        const response = await ai.interactions.create(
          {
            model: GEMINI_TEXT_MODEL,
            input: [{ type: "user_input", content: parts }],
            system_instruction: developerPrompt,
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: GEMINI_TEXT_THINKING },
            store: false,
            stream: true,
          },
          { signal: abortController.signal },
        );

        for await (const event of response) {
          if (event.event_type === "step.delta" && event.delta.type === "text") parser.write(event.delta.text);
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
