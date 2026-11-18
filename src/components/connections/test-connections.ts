import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { from, Observable } from "rxjs";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../lib/gemini-models";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "gemini";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: "Please respond with exactly 'OpenAI test success!'",
      max_output_tokens: 16,
    });

    if (response.output && response.output.length > 0) {
      const firstMessage = response.output[0];
      if (firstMessage.type === "message" && firstMessage.content && firstMessage.content.length > 0) {
        const content = firstMessage.content[0];
        if (content.type === "output_text") {
          return content.text;
        }
      }
    }

    return "No response received from OpenAI";
  };

  return from(request());
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
    case "openai":
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key is not set");
      }
      return testOpenAIConnection(apiKeys.openai);

    case "gemini":
      if (!apiKeys.gemini) {
        throw new Error("Gemini API key is not set");
      }
      return testGeminiConnection(apiKeys.gemini);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
