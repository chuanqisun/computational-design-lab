import { JSONParser } from "@streamparser/json";
import { generateGeminiText, streamGeminiText } from "../../lib/gemini-text";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";

export interface StreamParametersParams {
  parti: string;
  concepts: { name: string; description: string }[];
  artifacts: { name: string; description: string }[];
  domain: string;
  existingParameters: string[];
  rejectedParameters: string[];
  apiKey: string;
}

export interface Parameter {
  name: string;
  description: string;
}

export function streamParameters$(params: StreamParametersParams): Observable<Parameter> {
  return new Observable<Parameter>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    // Unsubscribing aborts the in-flight Gemini request.
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());

    const parser = new JSONParser();

    // Wire up parser event to emit parameters
    parser.onValue = (entry) => {
      // Check if this is an array item under the "parameters" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const parameter = entry.value as unknown as Parameter;
        if (parameter.name && parameter.description) {
          subscriber.next(parameter);
        }
      }
    };

    // Call Gemini in JSON mode, streaming output
    (async () => {
      try {
        const conceptsList = params.concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");
        const artifactsList = params.artifacts.map((a) => `- ${a.name}: ${a.description}`).join("\n");

        const existingList =
          params.existingParameters.length > 0
            ? `\n\nExisting parameters (avoid repetition):\n${params.existingParameters.map((p) => `- ${p}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedParameters.length > 0
            ? `\n\nRejected parameters (do not suggest these):\n${params.rejectedParameters.map((p) => `- ${p}`).join("\n")}`
            : "";

        const isIncremental = params.existingParameters.length > 0;
        const count = isIncremental ? 2 : 3;

        const prompt = `
Generate design parameters for ${params.domain} based on this Parti, concepts, and artifacts:

\`\`\`parti
${params.parti}
\`\`\`

\`\`\`concepts
${conceptsList}
\`\`\`

\`\`\`artifacts
${artifactsList}
\`\`\`${existingList}${rejectedList}

Generate ${count} design parameters that represent specific design decisions that a designer must make for ${params.domain}.
Each parameter should be single purpose, representing an atomic decision that is usually associated with a list of possible choices.

Parameter name should be concrete and concise, representing a specific design decision (e.g., "Fabric material" for clothing, "Location" for art installation).
Parameter description should be a short sentence that defines what this design decision encompasses, including example values that can be assigned to this parameter. This provides clarity about the scope and potential choices without introducing bias into the design process.

Respond in this JSON format:
{
  "parameters": [
    {
      "name": "string",
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
  });
}

export function regenerateParameterDescription$(params: {
  parameterName: string;
  domain: string;
  apiKey: string;
  existingParameters?: Parameter[];
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
            {
              role: "system",
              content: `Generate a description for a design parameter in the context of ${params.domain}. The description should be a short sentence that defines what this design decision encompasses, including example values that can be assigned to this parameter. This provides clarity about the scope and potential choices without introducing bias into the design process.`,
            },

            // Few-shot examples using existing parameters
            ...(params.existingParameters ?? []).flatMap((example) => [
              { role: "user" as const, content: example.name },
              { role: "model" as const, content: example.description },
            ]),

            { role: "user", content: params.parameterName },
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
