import { JSONParser } from "@streamparser/json";
import { generateGeminiText, streamGeminiText } from "../../lib/gemini-text";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";

export interface StreamArtifactsParams {
  parti: string;
  concepts: { name: string; description: string }[];
  existingArtifacts: string[];
  rejectedArtifacts: string[];
  apiKey: string;
}

export interface Artifact {
  name: string;
  description: string;
}

export function streamArtifacts$(params: StreamArtifactsParams): Observable<Artifact> {
  return new Observable<Artifact>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    // Unsubscribing aborts the in-flight Gemini request.
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());

    const parser = new JSONParser();

    // Wire up parser event to emit artifacts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "artifacts" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const artifact = entry.value as unknown as Artifact;
        if (artifact.name && artifact.description) {
          subscriber.next(artifact);
        }
      }
    };

    // Call Gemini in JSON mode, streaming output
    (async () => {
      try {
        const conceptsList = params.concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");

        const existingList =
          params.existingArtifacts.length > 0
            ? `\n\nExisting artifacts (avoid repetition):\n${params.existingArtifacts.map((a) => `- ${a}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedArtifacts.length > 0
            ? `\n\nRejected artifacts (do not suggest these):\n${params.rejectedArtifacts.map((a) => `- ${a}`).join("\n")}`
            : "";

        const isIncremental = params.existingArtifacts.length > 0;
        const count = isIncremental ? 3 : 5;

        const prompt = `
Generate moodboard artifacts based on this Parti and concepts:

\`\`\`parti
${params.parti}
\`\`\`

\`\`\`concepts
${conceptsList}
\`\`\`${existingList}${rejectedList}

Generate ${count} diverse artifacts that would be commonly seen in a moodboard. Each artifact should represent or evoke the Parti and be suitable for image generation.
An artifact should be grounded in the real world and a human's lived experience, e.g. an object, material, texture, color scheme, sound, smell, emotion, or environment that evokes the intended experience of the design.

Artifact name should be very short (one word or short phrase).
Artifact description should be one detailed sentence including subject, scene, and style for AI image generation.

Respond in this JSON format:
{
  "artifacts": [
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

export function regenerateArtifactDescription$(params: {
  artifactName: string;
  apiKey: string;
  existingArtifacts?: Artifact[];
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
              content:
                "Generate a detailed description for a moodboard artifact. The description should be one detailed sentence including subject, scene, and style for AI image generation. The artifact should be grounded in the real world and human's lived experience.",
            },

            // Few-shot examples using existing artifacts
            ...(params.existingArtifacts ?? []).flatMap((example) => [
              { role: "user" as const, content: example.name },
              { role: "model" as const, content: example.description },
            ]),

            { role: "user", content: params.artifactName },
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

export function generateArtifactFromImage$(params: {
  imageBase64: string;
  /** MIME type of the image data, e.g. "image/png". */
  mimeType?: string;
  apiKey: string;
  existingArtifacts?: Artifact[];
}): Observable<Artifact> {
  return new Observable<Artifact>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    const abortController = new AbortController();

    (async () => {
      try {
        const existingContext = params.existingArtifacts?.length
          ? `\n\nFor consistency, here are examples of existing artifacts:\n${params.existingArtifacts
              .map((a) => `- ${a.name}: ${a.description}`)
              .join("\n")}`
          : "";

        const text = await generateGeminiText({
          apiKey: params.apiKey,
          signal: abortController.signal,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image and generate a moodboard artifact entry for it.  

Generate a name and description following these guidelines:
- Name should be very short (one word or short phrase)
- Description should be one detailed sentence including subject, scene, and style for AI image generation
- The artifact should be grounded in the real world and human's lived experience${existingContext}

Respond in this JSON format:
{
  "name": "string",
  "description": "string"
}`,
                },
                {
                  type: "image",
                  data: params.imageBase64,
                  mime_type: params.mimeType ?? "image/jpeg",
                },
              ],
            },
          ],
          json: true,
        });
        try {
          const parsed = JSON.parse(text) as Artifact;
          if (parsed.name && parsed.description) {
            subscriber.next(parsed);
          } else {
            subscriber.error(new Error("Invalid artifact format in response"));
          }
        } catch (parseError) {
          subscriber.error(new Error("Failed to parse JSON response"));
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

export async function fileToDataUrl(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
