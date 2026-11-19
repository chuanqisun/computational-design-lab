import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { Observable } from "rxjs";
import {
  GEMINI_REASONING_MODEL,
  GEMINI_REASONING_THINKING,
  GEMINI_TEXT_MODEL,
  GEMINI_TEXT_THINKING,
} from "../../../lib/gemini-models";
import {
  formatVoiceCatalogForPrompt,
  GEMINI_LIVE_VOICE_NAMES,
  normalizePersonaGender,
  resolvePersonaVoice,
  type GeminiLiveVoiceName,
  type PersonaGender,
} from "../../../lib/gemini-voices";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface Persona {
  name: string;
  age: number;
  gender: PersonaGender;
  occupation: string;
  description: string;
  voiceName: GeminiLiveVoiceName;
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
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    const ai = new GoogleGenAI({ apiKey });
    const parser = new JSONParser();
    const usedVoices = new Set<string>();

    parser.onValue = (entry) => {
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const p = entry.value as Record<string, unknown>;
        if (typeof p.name === "string" && p.name && typeof p.description === "string" && p.description) {
          const gender = normalizePersonaGender(p.gender);
          const occupation = typeof p.occupation === "string" ? p.occupation : "";
          const voiceName = resolvePersonaVoice({
            gender,
            voiceName: p.voiceName,
            seed: `${p.name}:${occupation}:${entry.key}`,
            usedVoices,
          });
          usedVoices.add(voiceName);

          subscriber.next({
            name: p.name,
            age: typeof p.age === "number" ? p.age : 30,
            gender,
            occupation,
            description: p.description,
            voiceName,
          });
        }
      }
    };

    (async () => {
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
                  gender: { type: "string", enum: ["female", "male", "neutral"] },
                  occupation: { type: "string" },
                  description: { type: "string" },
                  voiceName: { type: "string", enum: [...GEMINI_LIVE_VOICE_NAMES] },
                },
                required: ["name", "age", "gender", "occupation", "description", "voiceName"],
              },
            },
          },
          required: ["personas"],
        };

        const prompt = `Generate ${numUsers} synthetic user personas${segmentText}. Each persona should have varying levels of "${trait}". Give them realistic names, ages, genders ("female", "male", or "neutral" for non-binary / gender-neutral personas), occupations, a brief 2-3 sentence description of their personality and how "${trait}" manifests in their life, and a matching Gemini Live voiceName.

Assign each persona a distinct voiceName from the Gemini Live catalog below, matching female personas to female voices, male personas to male voices, and gender-neutral ("neutral") personas to a balanced or personality-fitting voice:
${formatVoiceCatalogForPrompt()}`;

        const stream = await ai.interactions.create(
          {
            model: GEMINI_TEXT_MODEL,
            input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: GEMINI_TEXT_THINKING },
            store: false,
            stream: true,
          },
          { signal: abortController.signal },
        );

        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta.type === "text") parser.write(event.delta.text);
        }

        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
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
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    const ai = new GoogleGenAI({ apiKey });

    (async () => {
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

        const response = await ai.interactions.create(
          {
            model: GEMINI_REASONING_MODEL,
            input: [{ type: "user_input", content: parts }],
            system_instruction: systemPrompt,
            response_format: { type: "text", mime_type: "application/json", schema },
            generation_config: { thinking_level: GEMINI_REASONING_THINKING },
            store: false,
          },
          { signal: abortController.signal },
        );

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
      }
    })();
  });
}
