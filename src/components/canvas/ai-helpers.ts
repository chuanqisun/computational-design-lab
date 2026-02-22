import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { from, map, Observable, switchMap } from "rxjs";

/**
 * Converts a URL or fetchable resource to a base64 string.
 */
async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result is "data:image/png;base64,..."
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function extractDataFromDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL");
  }
  return { mimeType: matches[1], data: matches[2] };
}

export function getCaption(src: string, apiKey: string): Observable<string> {
  return from(urlToBase64(src)).pipe(
    switchMap(async (dataUrl) => {
      const { mimeType, data } = extractDataFromDataUrl(dataUrl);
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseModalities: ["TEXT"],
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Describe this image in a short caption." },
              {
                inlineData: {
                  mimeType,
                  data,
                },
              },
            ],
          },
        ],
      });
      return response;
    }),
    map((response) => {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No caption generated");
      return text;
    }),
  );
}

export function enhancePrompt(originalPrompt: string, cardContext: string, apiKey: string): Observable<string> {
  return from(
    (async () => {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image. 
      
      Original prompt: '${originalPrompt}'
      Context from card: '${cardContext}'
      
      Keep it descriptive but concise. Return ONLY the enhanced prompt.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseModalities: ["TEXT"],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No enhanced prompt generated");
      return text;
    })(),
  );
}
