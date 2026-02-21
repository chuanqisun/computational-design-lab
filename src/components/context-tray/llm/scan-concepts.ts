import { GoogleGenAI, type Schema, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
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
        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["title", "description"],
              },
            },
          },
          required: ["concepts"],
        };

        const developerPrompt = `Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.`;

        const parts: any[] = [{ text: inputs.instruction }];

        for (const item of inputs.items) {
          if ("src" in item) {
            const base64Data = item.src.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = item.src.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
            parts.push({ inlineData: { data: base64Data, mimeType } });
          } else {
            parts.push({ text: `${item.title}: ${item.content}` });
          }
        }

        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: developerPrompt,
          },
          contents: [{ role: "user", parts }],
        });

        for await (const chunk of response) {
          const textPart = chunk.text;
          if (textPart) parser.write(textPart);
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

