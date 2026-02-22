import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../../progress/progress";

export function generateImagePrompt$(input: { text: string; apiKey: string }): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });

    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      abortController.abort();
    });

    (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const model = "gemini-3-flash-preview";

        const response = await ai.models.generateContentStream({
          model,
          config: {
            responseModalities: ["TEXT"],
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
            abortSignal: abortController.signal,
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Create a detailed image generation prompt for the following text. The prompt should be descriptive, visual, and suitable for a text-to-image model. Return only the prompt.\n\n${input.text}`,
                },
              ],
            },
          ],
        });

        let prompt = "";
        for await (const chunk of response) {
          if (chunk.text) {
            prompt += chunk.text;
          }
        }

        subscriber.next(prompt.trim());
        subscriber.complete();
      } catch (e) {
        subscriber.error(e);
      } finally {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      }
    })();
  });
}
