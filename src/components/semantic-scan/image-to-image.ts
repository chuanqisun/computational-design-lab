import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { Observable, from } from "rxjs";
import { progress$ } from "../progress/progress";

export function imageToimage(input: { instruction: string; image: string; apiKey: string }): Observable<string> {
  return from(
    (async () => {
      progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen + 1 });
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const model = "gemini-2.5-flash-image";
        const config: GenerateContentConfig = {
          responseModalities: ["IMAGE"],
        };

        // Helper to parse data URL
        const parseDataUrl = (dataUrl: string) => {
          const [header, data] = dataUrl.split(",");
          const mimeType = header.split(":")[1].split(";")[0];
          return { mimeType, data };
        };

        // Add the image to parts
        const { mimeType, data } = parseDataUrl(input.image);

        const response = await ai.models.generateContentStream({
          model,
          config,
          contents: [
            {
              role: "model",
              parts: [
                {
                  inlineData: { mimeType, data },
                },
              ],
            },
            {
              role: "user",
              parts: [
                {
                  text: input.instruction,
                },
              ],
            },
          ],
        });

        let imageUrls: string[] = [];
        for await (const chunk of response) {
          if (chunk.usageMetadata?.totalTokenCount !== undefined) {
            console.log("Usage metadata:", chunk.usageMetadata);
          }

          if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
            continue;
          }

          const parts = chunk.candidates[0].content.parts;
          for (const part of parts) {
            if (part.inlineData) {
              const { mimeType, data } = part.inlineData;
              const imageUrl = `data:${mimeType};base64,${data}`;
              imageUrls.push(imageUrl);
            }
          }
        }

        return imageUrls[0] || "";
      } finally {
        progress$.next({ ...progress$.value, imageGen: progress$.value.imageGen - 1 });
      }
    })(),
  );
}
