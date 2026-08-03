import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type DesignInput = CanvasItem;

export type DesignRequirement = string;

export interface DesignConcept {
  title: string;
  description: string;
  imagePrompt: string;
}

export function designConcepts$(inputs: {
  items: DesignInput[];
  requirements: DesignRequirement;
  brandGuide?: string;
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
        const schema = {
          type: "object",
          properties: {
            designs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  imagePrompt: { type: "string" },
                },
                required: ["title", "description", "imagePrompt"],
              },
            },
          },
          required: ["designs"],
        };

        const contents: Interactions.Content[] = inputs.items.flatMap((item) => {
          const parts: Interactions.Content[] = [];
          if (item.imageSrc) {
            const mimeType = item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
            parts.push({ type: "image", mime_type: mimeType, data: item.imageSrc.split(",")[1] });
          }
          if (item.body) {
            parts.push({ type: "text", text: `Title: ${item.title || ""}\nContent: ${item.body}` });
          }
          return parts;
        });

        const requirementText = inputs.requirements || "Any";
        const brandGuide = inputs.brandGuide?.trim() || "";

        const systemPrompt = brandGuide
          ? `You generate design concepts from mixed visual and textual references. Follow the provided brand guide when making design decisions.\n\nBrand guide: ${brandGuide}`
          : "You generate design concepts from mixed visual and textual references.";

        const userPrompt = `
Generate ${inputs.numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${requirementText}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.
`;

        contents.push({ type: "text", text: userPrompt });

        const stream = await ai.interactions.create({
          model: "gemini-3-flash-preview",
          input: contents,
          system_instruction: systemPrompt,
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { thinking_level: "minimal" },
          store: false,
          stream: true,
        });

        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta.type === "text") {
            parser.write(event.delta.text);
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
