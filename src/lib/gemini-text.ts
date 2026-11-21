import { GoogleGenAI, type Interactions } from "@google/genai";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "./gemini-models";

/** One turn of a few-shot conversation. `system` turns are merged into the system instruction. */
export interface GeminiTurn {
  role: "system" | "user" | "model";
  content: string | Interactions.Content[];
}

export interface GeminiTextRequest {
  apiKey: string;
  /** A plain prompt, or a conversation (system instruction + few-shot user/model turns). */
  input: string | Interactions.Content[] | GeminiTurn[];
  /** Ask for a JSON response (equivalent of OpenAI's `json_object` format); the prompt describes the shape. */
  json?: boolean;
  signal?: AbortSignal;
}

const toContent = (content: string | Interactions.Content[]): Interactions.Content[] =>
  typeof content === "string" ? [{ type: "text", text: content }] : content;

const isTurns = (input: GeminiTextRequest["input"]): input is GeminiTurn[] =>
  Array.isArray(input) && input.length > 0 && "role" in input[0];

function buildRequest(request: GeminiTextRequest) {
  let systemInstruction: string | undefined;
  let input: Interactions.Step[];

  if (isTurns(request.input)) {
    const system = request.input.filter((turn) => turn.role === "system");
    systemInstruction = system.length
      ? system.map((turn) => (typeof turn.content === "string" ? turn.content : "")).join("\n\n")
      : undefined;
    input = request.input
      .filter((turn) => turn.role !== "system")
      .map((turn) =>
        turn.role === "user"
          ? { type: "user_input" as const, content: toContent(turn.content) }
          : { type: "model_output" as const, content: toContent(turn.content) },
      );
  } else {
    input = [{ type: "user_input", content: toContent(request.input as string | Interactions.Content[]) }];
  }

  return {
    model: GEMINI_TEXT_MODEL,
    ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
    input,
    ...(request.json ? { response_format: { type: "text" as const, mime_type: "application/json" } } : {}),
    generation_config: { thinking_level: GEMINI_TEXT_THINKING },
    store: false,
  };
}

/** Streams text deltas from the shared Gemini text model. */
export async function* streamGeminiText(request: GeminiTextRequest): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: request.apiKey });
  const stream = await ai.interactions.create({ ...buildRequest(request), stream: true }, { signal: request.signal });
  for await (const event of stream) {
    if (event.event_type === "step.delta" && event.delta.type === "text") yield event.delta.text;
  }
}

/** Returns the full (trimmed) text response from the shared Gemini text model. */
export async function generateGeminiText(request: GeminiTextRequest): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: request.apiKey });
  const interaction = await ai.interactions.create(buildRequest(request), { signal: request.signal });
  return (interaction.steps ?? [])
    .flatMap((step) => (step.type === "model_output" ? (step.content ?? []) : []))
    .flatMap((content) => (content.type === "text" ? [content.text] : []))
    .join("")
    .trim();
}
