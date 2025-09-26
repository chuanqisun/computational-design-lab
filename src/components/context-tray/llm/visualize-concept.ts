import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable, map, mergeMap } from "rxjs";
import { generateImage, type GeminiConnection } from "../../design/generate-image-gemini";
import { progress$ } from "../../progress/progress";
import type { Concept } from "./scan-concepts";

export interface VisualizeConceptProps {
  concept: Concept;
  instruction: string;
  openaiApiKey: string;
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

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: props.openaiApiKey,
    });

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

        const responseStream = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: prompt,
            text: { format: { type: "json_object" }, verbosity: "low" },
            reasoning: { effort: "minimal" },
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of responseStream) {
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
