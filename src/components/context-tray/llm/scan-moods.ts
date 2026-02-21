import { GoogleGenAI, type Schema, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { ImageItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface MoodResult {
  imageId: string;
  moods: Array<{ mood: string; arousal: number }>;
}

export function scanMoods$(inputs: { image: ImageItem; apiKey: string }): Observable<MoodResult> {
  return new Observable<MoodResult>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });
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

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            moods: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mood: { type: Type.STRING },
                  arousal: { type: Type.NUMBER },
                },
                required: ["mood", "arousal"],
              },
            },
          },
          required: ["moods"],
        };

        const developerPrompt = `Analyze the provided image and identify 3-5 moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.`;

        const base64Data = inputs.image.src.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = inputs.image.src.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";

        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: developerPrompt,
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "Analyze this image for moods and arousal levels." },
                { inlineData: { data: base64Data, mimeType } },
              ],
            },
          ],
        });

        for await (const chunk of response) {
          const textPart = chunk.text;
          if (textPart) parser.write(textPart);
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
  });
}

export function scanMoodsSupervised$(inputs: {
  image: ImageItem;
  apiKey: string;
  requiredList?: string[];
}): Observable<MoodResult> {
  return new Observable<MoodResult>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });
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

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        let promptParts: string[] = [];

        if (inputs.requiredList && inputs.requiredList.length > 0) {
          const requiredListFormatted = inputs.requiredList.map((m) => `"${m}"`).join(", ");
          promptParts.push(
            `Analyze the provided image and assign an arousal level to each of the following moods: ${requiredListFormatted}.`,
          );
          promptParts.push(
            `For each mood in the list, provide the exact mood string and an arousal level from 1 to 10, where 1 means the image has very low intensity of that mood and 10 means the image has very high intensity of that mood.`,
          );
        } else {
          promptParts.push("Analyze the provided image and identify 3-5 moods it evokes.");
          promptParts.push(
            "For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.",
          );
        }

        const developerPrompt = promptParts.join("\n\n");

        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            moods: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mood: { type: Type.STRING },
                  arousal: { type: Type.NUMBER },
                },
                required: ["mood", "arousal"],
              },
            },
          },
          required: ["moods"],
        };

        const base64Data = inputs.image.src.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = inputs.image.src.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";

        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: developerPrompt,
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "Analyze this image for moods and arousal levels." },
                { inlineData: { data: base64Data, mimeType } },
              ],
            },
          ],
        });

        for await (const chunk of response) {
          const textPart = chunk.text;
          if (textPart) parser.write(textPart);
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
  });
}
