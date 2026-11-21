import { JSONParser } from "@streamparser/json";
import { generateGeminiText, streamGeminiText } from "../../lib/gemini-text";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";

export interface StreamConceptsParams {
  parti: string;
  existingConcepts: string[];
  rejectedConcepts: string[];
  apiKey: string;
}

export interface Concept {
  concept: string;
  description: string;
}

export function streamConcepts$(params: StreamConceptsParams): Observable<Concept> {
  return new Observable<Concept>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    const abortController = new AbortController();

    const parser = new JSONParser();

    // Wire up parser event to emit concepts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "concepts" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const concept = entry.value as unknown as Concept;
        if (concept.concept && concept.description) {
          subscriber.next(concept);
        }
      }
    };

    // Call Gemini in JSON mode, streaming output
    (async () => {
      try {
        const existingList =
          params.existingConcepts.length > 0
            ? `\n\nExisting concepts (avoid repetition):\n${params.existingConcepts.map((c) => `- ${c}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedConcepts.length > 0
            ? `\n\nRejected concepts (do not suggest these):\n${params.rejectedConcepts.map((c) => `- ${c}`).join("\n")}`
            : "";

        const prompt = `
Generate conceptual keywords that best represent this Parti:

\`\`\`parti
${params.parti}
\`\`\`${existingList}${rejectedList}

Generate up to ${params.existingConcepts.length ? 3 : 5} new concepts (one word, or compound word) with short descriptions that capture some essence of the Parti. Each concept should be unique and meaningful.

Respond in this JSON format:
{
  "concepts": [
    {
      "concept": "string",
      "description": "string"
    }
  ]
}
        `.trim();

        for await (const delta of streamGeminiText({
          apiKey: params.apiKey,
          input: prompt,
          json: true,
          signal: abortController.signal,
        })) {
          parser.write(delta);
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}

export function regenerateDescription$(params: {
  concept: string;
  apiKey: string;
  existingConcepts?: Concept[];
}): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    const abortController = new AbortController();

    (async () => {
      try {
        const text = await generateGeminiText({
          apiKey: params.apiKey,
          signal: abortController.signal,
          input: [
            { role: "system", content: "Write a short one-sentence description for the provided concept." },

            // Few-shot examples using existing concepts
            ...(params.existingConcepts ?? []).flatMap((example) => [
              { role: "user" as const, content: example.concept },
              { role: "model" as const, content: example.description },
            ]),

            { role: "user", content: params.concept },
          ],
        });
        if (text) subscriber.next(text);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}
