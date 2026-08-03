import { GoogleGenAI } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable, map, mergeMap } from "rxjs";
import { generateImage, type GeminiConnection } from "../../design/generate-image-gemini";
import { progress$ } from "../../progress/progress";
import type { Concept } from "./scan-concepts";

export interface VisualizeConceptProps {
  concept: Concept;
  instruction: string;
  geminiApiKey: string;
}

/**
 * Take a textual concept and instruction, emit a stream of image URLs visualizing the concept.
 */
export function visualizeConcept$(props: VisualizeConceptProps): Observable<string> {
  const connection: GeminiConnection = { apiKey: props.geminiApiKey };
  return createRenderPrompt(props).pipe(
    mergeMap((prompt) =>
      generateImage(connection, {
        prompt,
        width: 512,
        height: 512,
      }).pipe(map((result) => result.url)),
    ),
  );
}

/**
 * Take a textual concept and instruction, return prompts suitable for image generation with AI.
 * The prompts should describe subject, scene, style in details, match user instruction, and use diverse imagery.
 */
export function createRenderPrompt(props: VisualizeConceptProps): Observable<string> {
  return new Observable<string>((subscriber) => {
    const abortController = new AbortController();
    const ai = new GoogleGenAI({ apiKey: props.geminiApiKey });
    const parser = new JSONParser();

    // Wire up parser event to emit prompts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "prompts" key
      if (
        typeof (entry as any).key === "number" &&
        typeof entry.value === "string" &&
        Array.isArray((entry as any).parent)
      ) {
        subscriber.next(entry.value);
      }
    };

    (async () => {
      try {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });

        const prompt = `
Create detailed prompts for image generation based on the following concept and instruction.

Concept: ${props.concept.title}
Description: ${props.concept.description}
Instruction: ${props.instruction}

Generate up to 3 vivid, detailed descriptions suitable for an AI image generator. Capture diverse elements of the concept following the instruction. Each prompt covers subject, scene, style.

Respond in JSON format:
{
  "prompts": ["prompt1", "prompt2", "prompt3"]
}
        `.trim();

        const schema = {
          type: "object",
          properties: {
            prompts: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
            },
          },
          required: ["prompts"],
        };

        const responseStream = await ai.interactions.create(
          {
            model: "gemini-3.6-flash",
            input: prompt,
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: "minimal" },
            store: false,
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of responseStream) {
          if (chunk.event_type === "step.delta" && chunk.delta.type === "text") {
            parser.write(chunk.delta.text);
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
