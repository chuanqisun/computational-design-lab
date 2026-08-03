import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
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
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
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

        const response = await ai.interactions.create({
          model: "gemini-3.6-flash",
          input: parts,
          system_instruction: developerPrompt,
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { thinking_level: "minimal" },
          store: false,
          stream: true,
        });

        for await (const event of response) {
          if (event.event_type === "step.delta" && event.delta.type === "text") parser.write(event.delta.text);
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      }
    })();
  });
}
