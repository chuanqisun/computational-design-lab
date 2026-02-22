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

export interface CardContent {
  title?: string;
  body?: string;
  imagePrompt?: string;
  imageSrc?: string;
}

export function fillCard(content: CardContent, apiKey: string): Observable<Partial<CardContent>> {
  return from(
    (async () => {
      const parts: any[] = [];
      let prompt = `I have a card with the following content:
Title: ${content.title || "(missing)"}
Body: ${content.body || "(missing)"}
Image Prompt: ${content.imagePrompt || "(missing)"}

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image is provided, generate a detailed image generation prompt.
- If image is provided, use it to generate the missing text fields.

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}`;

      parts.push({ text: prompt });

      if (content.imageSrc) {
        try {
          const dataUrl = await urlToBase64(content.imageSrc);
          const { mimeType, data } = extractDataFromDataUrl(dataUrl);
          parts.push({
            inlineData: {
              mimeType,
              data,
            },
          });
        } catch (e) {
          console.error("Failed to process image for AI", e);
          // Continue without image if failed
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return {};

      try {
        return JSON.parse(text) as Partial<CardContent>;
      } catch (e) {
        console.error("Failed to parse JSON response from AI", text);
        return {};
      }
    })(),
  );
}
