import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";
import type { Spectrum } from "./spectrums";

export function generateSpectrumImages$(params: {
  image: string;
  spectrum: Spectrum;
  apiKey: string;
}): Observable<{ leftImage: string; rightImage: string }> {
  return new Observable<{ leftImage: string; rightImage: string }>((subscriber) => {
    const abortController = new AbortController();

    (async () => {
      try {
        const ai = new GoogleGenAI({
          apiKey: params.apiKey,
        });
        const model = "gemini-2.5-flash-image-preview";

        // Extract base64 data and mimeType from the image string (assuming data URL format)
        const [mimePart, base64Data] = params.image.split(",");
        const mimeType = mimePart.split(":")[1].split(";")[0];

        // Function to generate image for one end of the spectrum
        const generateForEnd = async (endName: string): Promise<string> => {
          const prompt = `Edit this image to represent the "${endName}" end of the spectrum "${params.spectrum.name}". Description: ${params.spectrum.description}. Make the image embody the qualities of "${endName}" while maintaining the overall composition and style.`;

          const config = {
            responseModalities: ["IMAGE"],
          };
          const contents = [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ];

          const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
          });

          let imageUrl = "";
          for await (const chunk of response) {
            if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
              const parts = chunk.candidates[0].content.parts;
              for (const part of parts) {
                if (part.inlineData) {
                  const { mimeType: mt, data } = part.inlineData;
                  imageUrl = `data:${mt};base64,${data}`;
                }
              }
            }
          }
          return imageUrl;
        };

        const leftImage = await generateForEnd(params.spectrum.leftEndName);
        const rightImage = await generateForEnd(params.spectrum.rightEndName);

        subscriber.next({ leftImage, rightImage });
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}
