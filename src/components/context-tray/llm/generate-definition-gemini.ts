import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../../progress/progress";

export function generateDefinition$(input: { text: string; apiKey: string }): Observable<string> {
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
                  text: `Define this term or phrase in 2-3 sentences. Return text directly, no quotes.\n\n${input.text}`,
                },
              ],
            },
          ],
        });

        let definition = "";
        for await (const chunk of response) {
          if (chunk.text) {
            definition += chunk.text;
          }
        }

        subscriber.next(definition.trim());
        subscriber.complete();
      } catch (e) {
        subscriber.error(e);
      }
    })();
  });
}
