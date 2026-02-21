import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../../progress/progress";

export function generateTitle$(input: { text: string; apiKey: string }): Observable<string> {
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
            abortSignal: abortController.signal,
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `One word/short phrase summary of text. Return text directly, no quotes.\n\n${input.text}`,
                },
              ],
            },
          ],
        });

        let caption = "";
        for await (const chunk of response) {
          if (chunk.text) {
            caption += chunk.text;
          }
        }

        subscriber.next(caption.trim());
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
