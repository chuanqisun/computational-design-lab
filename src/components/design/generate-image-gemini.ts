import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";

export interface GeminiConnection {
  apiKey: string;
}

export interface GenerateImageOptions {
  prompt: string;
  width: number;
  height: number;
  model?: string;
}

export interface GenerateImageResult {
  url: string;
}

export function generateImage(
  connection: GeminiConnection,
  options: GenerateImageOptions,
): Observable<GenerateImageResult> {
  return new Observable<GenerateImageResult>((subscriber) => {
    if (!options.prompt.trim()) {
      subscriber.error(new Error("Prompt cannot be empty"));
      return;
    }

    (async () => {
      const ai = new GoogleGenAI({
        apiKey: connection.apiKey,
      });
      const config = {
        responseModalities: ["IMAGE"],
      };
      const model = "gemini-2.5-flash-image-preview";
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: options.prompt,
            },
          ],
        },
      ];

      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });

      let imageUrls: string[] = [];

      for await (const chunk of response) {
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

      if (imageUrls.length > 0) {
        subscriber.next({
          url: imageUrls[0],
        });
        subscriber.complete();
      } else {
        subscriber.error(new Error("No image generated"));
      }
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}
