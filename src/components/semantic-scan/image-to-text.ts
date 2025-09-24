import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { Observable, from } from "rxjs";

export function imageToText(input: { instruction: string; image: string; apiKey: string }): Observable<string> {
  return from(
    (async () => {
      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const model = "gemini-2.5-flash-image-preview";
      const config: GenerateContentConfig = {
        responseModalities: ["TEXT"],
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

      let fullText = "";
      for await (const chunk of response) {
        if (chunk.usageMetadata) {
          console.log("Usage metadata:", { usage: chunk.usageMetadata });
        }

        if (chunk.text) {
          fullText += chunk.text;
        }
      }

      return fullText;
    })(),
  );
}
