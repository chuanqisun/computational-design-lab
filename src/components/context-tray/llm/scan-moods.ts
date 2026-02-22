import { GoogleGenAI, type Schema, ThinkingLevel, Type } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface MoodResult {
  itemId: string;
  moods: Array<{ mood: string; arousal: number }>;
}

export function scanMoods$(inputs: { item: CanvasItem; apiKey: string }): Observable<MoodResult> {
  return new Observable<MoodResult>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });
    const parser = new JSONParser();
    let currentResult: MoodResult | null = null;

    parser.onValue = (entry) => {
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const moodEntry = entry.value as unknown as { mood: string; arousal: number };
        if (moodEntry.mood && typeof moodEntry.arousal === "number") {
          if (!currentResult) {
            currentResult = { itemId: inputs.item.id, moods: [] };
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

        const developerPrompt = `Analyze the provided item and identify 3-5 moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.`;

        const parts: any[] = [{ text: "Analyze this item for moods and arousal levels." }];

        if (inputs.item.imageSrc) {
          const base64Data = inputs.item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
          const mimeType = inputs.item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        if (inputs.item.body) {
          parts.push({ text: `Title: ${inputs.item.title || ""}\nContent: ${inputs.item.body}` });
        }

        const response = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: developerPrompt,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
          contents: [
            {
              role: "user",
              parts: parts,
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
  item: CanvasItem;
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
            currentResult = { itemId: inputs.item.id, moods: [] };
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
            `Analyze the provided item and assign an arousal level to each of the following moods: ${requiredListFormatted}.`,
          );
          promptParts.push(
            `For each mood in the list, provide the exact mood string and an arousal level from 1 to 10, where 1 means the item has very low intensity of that mood and 10 means the item has very high intensity of that mood.`,
          );
        } else {
          promptParts.push("Analyze the provided item and identify 3-5 moods it evokes.");
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

        const parts: any[] = [{ text: "Analyze this item for moods and arousal levels." }];

        if (inputs.item.imageSrc) {
          const base64Data = inputs.item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
          const mimeType = inputs.item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        if (inputs.item.body) {
          parts.push({ text: `Title: ${inputs.item.title || ""}\nContent: ${inputs.item.body}` });
        }

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
              parts: parts,
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
