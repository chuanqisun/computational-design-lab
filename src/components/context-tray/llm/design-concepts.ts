import { GoogleGenAI, type Schema, ThinkingLevel, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { ImageItem, TextItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type DesignInput = Pick<TextItem, "title" | "content"> | Pick<ImageItem, "src">;

export interface DesignRequirement {
  materials: string[];
  colors: string[];
  shapes: string[];
  mechanisms: string[];
  surfaceOptions: string[];
}

export interface DesignConcept {
  title: string;
  description: string;
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
        if (design.title && design.description) {
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
                },
                required: ["title", "description"],
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

        const requirementText = `
Materials: ${inputs.requirements.materials.join(", ") || "Any"}
Colors: ${inputs.requirements.colors.join(", ") || "Any"}
Shapes: ${inputs.requirements.shapes.join(", ") || "Any"}
Mechanisms: ${inputs.requirements.mechanisms.join(", ") || "Any"}
Surface Options: ${inputs.requirements.surfaceOptions.join(", ") || "Any"}
`;

        const prompt = `
Generate ${inputs.numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${requirementText}

For each design, provide a highly detailed text description that captures both the conceptual vision and the specific physical details (materials, form, finish, mechanism).
Focus on how the requirements are integrated into the design.
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
