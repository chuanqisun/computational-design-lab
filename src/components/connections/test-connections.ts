import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../lib/gemini-models";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "gemini";
  apiKeys: ApiKeys;
}

export function testGeminiConnection(apiKey: string): Observable<string> {
  return new Observable<string>((subscriber) => {
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());

    void (async () => {
      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.interactions.create(
        {
          model: GEMINI_TEXT_MODEL,
          input: [
            {
              type: "user_input",
              content: [{ type: "text", text: "Please respond with exactly 'Gemini test success!'" }],
            },
          ],
          generation_config: { thinking_level: GEMINI_TEXT_THINKING },
          store: false,
          stream: true,
        },
        { signal: abortController.signal },
      );

      let fullText = "";
      for await (const event of stream) {
        if (event.event_type === "step.delta" && event.delta.type === "text") {
          fullText += event.delta.text;
        }
      }

      subscriber.next(fullText || "No response received from Gemini");
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}

export function testConnection({ provider, apiKeys }: TestConnectionRequest): Observable<string> {
  switch (provider) {
    case "gemini":
      if (!apiKeys.gemini) {
        throw new Error("Gemini API key is not set");
      }
      return testGeminiConnection(apiKeys.gemini);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
