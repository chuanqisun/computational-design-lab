import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface Persona {
  name: string;
  age: number;
  occupation: string;
  description: string;
}

export interface RankingResult {
  rankedItemIds: string[];
  feedback: string;
}

export function generatePersonas$({
  trait,
  segment,
  numUsers,
  apiKey,
}: {
  trait: string;
  segment: string;
  numUsers: number;
  apiKey: string;
}): Observable<Persona> {
  return new Observable<Persona>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey });
    const parser = new JSONParser();

    parser.onValue = (entry) => {
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const p = entry.value as any;
        if (p.name && p.description) {
          subscriber.next({
            name: p.name,
            age: p.age ?? 30,
            occupation: p.occupation ?? "",
            description: p.description,
          });
        }
      }
    };

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const segmentText = segment && segment !== "All" ? ` in the segment: ${segment}` : "";
        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            personas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  age: { type: Type.NUMBER },
                  occupation: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "age", "occupation", "description"],
              },
            },
          },
          required: ["personas"],
        };

        const prompt = `Generate ${numUsers} synthetic user personas${segmentText}. Each persona should have varying levels of "${trait}". Give them realistic names, ages, occupations, and a brief 2-3 sentence description of their personality and how "${trait}" manifests in their life.`;

        const stream = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        for await (const chunk of stream) {
          if (chunk.text) parser.write(chunk.text);
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      }
    })();
  });
}

export function rankDesigns$({
  persona,
  items,
  trait,
  apiKey,
}: {
  persona: Persona;
  items: CanvasItem[];
  trait: string;
  apiKey: string;
}): Observable<RankingResult> {
  return new Observable<RankingResult>((subscriber) => {
    const ai = new GoogleGenAI({ apiKey });

    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const schema: Schema = {
          type: Type.OBJECT,
          properties: {
            rankedItemIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            feedback: { type: Type.STRING },
          },
          required: ["rankedItemIds", "feedback"],
        };

        const systemPrompt = `You are ${persona.name}, ${persona.age} years old, ${persona.occupation}. ${persona.description}`;

        const itemsDescription = items
          .map(
            (item, i) =>
              `Design ${i + 1} (id: ${item.id}):${item.title ? ` "${item.title}"` : ""}${item.body ? ` — ${item.body}` : ""}`,
          )
          .join("\n\n");

        const userPrompt = `Here are ${items.length} design concepts:\n\n${itemsDescription}\n\nRank these designs from least to most "${trait}" based on your personal perspective. Return all ${items.length} item IDs in order from least ${trait} (first) to most ${trait} (last). Also write 1-2 sentences of feedback explaining your ranking.`;

        const parts: any[] = [{ text: userPrompt }];

        for (const item of items) {
          if (item.imageSrc) {
            const base64 = item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
            parts.push({ inlineData: { data: base64, mimeType } });
          }
        }

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
          contents: [{ role: "user", parts }],
        });

        const text = response.text;
        if (text) {
          const result = JSON.parse(text) as RankingResult;
          const validIds = new Set(items.map((i) => i.id));
          const rankedIds = result.rankedItemIds.filter((id) => validIds.has(id));
          const missingIds = items.map((i) => i.id).filter((id) => !rankedIds.includes(id));
          subscriber.next({
            rankedItemIds: [...rankedIds, ...missingIds],
            feedback: result.feedback,
          });
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      }
    })();
  });
}
