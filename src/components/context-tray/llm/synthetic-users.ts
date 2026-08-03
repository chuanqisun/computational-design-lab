import { GoogleGenAI, type Interactions } from "@google/genai";
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

function getInteractionText(outputs: Interactions.Step[] | undefined): string {
  return (outputs || [])
    .filter((output): output is Interactions.ModelOutputStep => output.type === "model_output")
    .flatMap((output) => output.content || [])
    .filter((content): content is Interactions.TextContent => content.type === "text")
    .map((content) => content.text)
    .join("");
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
        const schema = {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "number" },
                  occupation: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name", "age", "occupation", "description"],
              },
            },
          },
          required: ["personas"],
        };

        const prompt = `Generate ${numUsers} synthetic user personas${segmentText}. Each persona should have varying levels of "${trait}". Give them realistic names, ages, occupations, and a brief 2-3 sentence description of their personality and how "${trait}" manifests in their life.`;

        const stream = await ai.interactions.create({
          model: "gemini-3.6-flash",
          input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { thinking_level: "minimal" },
          store: false,
          stream: true,
        });

        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta.type === "text") parser.write(event.delta.text);
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
        const schema = {
          type: "object",
          properties: {
            rankedItemIds: {
              type: "array",
              items: { type: "string" },
            },
            feedback: { type: "string" },
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

        const parts: Interactions.Content[] = [{ type: "text", text: userPrompt }];

        for (const item of items) {
          if (item.imageSrc) {
            const base64 = item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
            parts.push({ type: "image", data: base64, mime_type: mimeType });
          }
        }

        const response = await ai.interactions.create({
          model: "gemini-3.6-flash",
          input: [{ type: "user_input", content: parts }],
          system_instruction: systemPrompt,
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { thinking_level: "minimal" },
          store: false,
        });

        const text = getInteractionText(response.steps);
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
