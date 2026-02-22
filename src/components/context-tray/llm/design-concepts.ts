import { GoogleGenAI, type Schema, ThinkingLevel, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { ImageItem, TextItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type DesignInput = Pick<TextItem, "title" | "content"> | Pick<ImageItem, "src">;

export type DesignRequirement = string;

export interface DesignConcept {
  title: string;
  description: string;
  imagePrompt: string;
}

export function designConcepts$(inputs: {
  items: DesignInput[];
  requirements: DesignRequirement;
  numDesigns: number;
  apiKey: string;
}): Observable<DesignConcept> {
  return new Observable<DesignConcept>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });
    const parser = new JSONParser();

    // Wire up parser event to emit concepts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "designs" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const design = entry.value as unknown as DesignConcept;
        if (design.title && design.description && design.imagePrompt) {
          subscriber.next(design);
        }
      }
    };

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            designs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                },
                required: ["title", "description", "imagePrompt"],
              },
            },
          },
          required: ["designs"],
        };

        const contents = inputs.items.map((item) => {
          if ("src" in item && item.src) {
            return { inlineData: { mimeType: "image/jpeg", data: item.src.split(",")[1] } };
          } else if ("title" in item && "content" in item) {
            return { text: `Title: ${item.title}\nContent: ${item.content}` };
          }
          throw new Error("Invalid item type");
        });

        const requirementText = inputs.requirements || "Any";

        const prompt = `
Generate ${inputs.numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${requirementText}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.
`;

        contents.push({ text: prompt });

        const stream = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: contents }],
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            parser.write(text);
          }
        }

        // Ensure parser processes remaining buffer if any, though stream usually completes it.
        // parser.end(); // JSONParser doesn't have end() in some versions, relying on write.

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      }
    })();
  });
}
