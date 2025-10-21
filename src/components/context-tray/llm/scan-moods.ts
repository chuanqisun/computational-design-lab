import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";
import type { ImageItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface MoodResult {
  imageId: string;
  moods: Array<{ mood: string; arousal: number }>;
}

export function scanMoods$(inputs: { image: ImageItem; apiKey: string }): Observable<MoodResult> {
  return new Observable<MoodResult>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: inputs.apiKey,
    });

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const parser = new JSONParser();
        let currentResult: MoodResult | null = null;

        parser.onValue = (entry) => {
          if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
            const moodEntry = entry.value as unknown as { mood: string; arousal: number };
            if (moodEntry.mood && typeof moodEntry.arousal === "number") {
              if (!currentResult) {
                currentResult = { imageId: inputs.image.id, moods: [] };
              }
              currentResult.moods.push(moodEntry);
            }
          }
        };

        const developerPrompt = `Analyze the provided image and identify 3-5 moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 5, where 1 is calm/low energy and 5 is intense/high energy.

Respond in this JSON format:
{
  "moods": [
    {
      "mood": "string",
      "arousal": number
    }
  ]
}`;

        const response = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: [
              { role: "developer", content: developerPrompt },
              {
                role: "user",
                content: [
                  { type: "input_text", text: "Analyze this image for moods and arousal levels." },
                  { type: "input_image", image_url: inputs.image.src, detail: "auto" },
                ],
              },
            ],
            reasoning: { effort: "minimal" },
            text: { verbosity: "low", format: { type: "json_object" } },
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of response) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }

        if (currentResult) {
          subscriber.next(currentResult);
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

export function scanMoodsSupervised$(inputs: {
  image: ImageItem;
  apiKey: string;
  requiredList?: string[];
}): Observable<MoodResult> {
  return new Observable<MoodResult>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: inputs.apiKey,
    });

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const parser = new JSONParser();
        let currentResult: MoodResult | null = null;

        parser.onValue = (entry) => {
          if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
            const moodEntry = entry.value as unknown as { mood: string; arousal: number };
            if (moodEntry.mood && typeof moodEntry.arousal === "number") {
              if (!currentResult) {
                currentResult = { imageId: inputs.image.id, moods: [] };
              }
              currentResult.moods.push(moodEntry);
            }
          }
        };

        let promptParts: string[] = [];

        if (inputs.requiredList && inputs.requiredList.length > 0) {
          const requiredListFormatted = inputs.requiredList.map((m) => `"${m}"`).join(", ");
          promptParts.push(
            `Analyze the provided image and assign an arousal level to each of the following moods: ${requiredListFormatted}.`,
          );
          promptParts.push(
            `For each mood in the list, provide the exact mood string and an arousal level from 1 to 5, where 1 means the image has very low intensity of that mood and 5 means the image has very high intensity of that mood.`,
          );
        } else {
          promptParts.push("Analyze the provided image and identify 3-5 moods it evokes.");
          promptParts.push(
            "For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 5, where 1 is calm/low energy and 5 is intense/high energy.",
          );
        }

        const developerPrompt = `${promptParts.join("\n\n")}

Respond in this JSON format:
{
  "moods": [
    {
      "mood": "string",
      "arousal": number
    }
  ]
}`;

        const response = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: [
              { role: "developer", content: developerPrompt },
              {
                role: "user",
                content: [
                  { type: "input_text", text: "Analyze this image for moods and arousal levels." },
                  { type: "input_image", image_url: inputs.image.src, detail: "auto" },
                ],
              },
            ],
            reasoning: { effort: "minimal" },
            text: { verbosity: "low", format: { type: "json_object" } },
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of response) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }

        if (currentResult) {
          subscriber.next(currentResult);
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
