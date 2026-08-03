import { GoogleGenAI, type Interactions } from "@google/genai";
import { from, map, Observable, switchMap } from "rxjs";
import { progress$ } from "../progress/progress";

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

function extractInteractionText(
  steps: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>,
): string {
  return steps
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === "text")
    .map((content) => content.text || "")
    .join("");
}

export function getCaption(src: string, apiKey: string): Observable<string> {
  return from(urlToBase64(src)).pipe(
    switchMap(async (dataUrl) => {
      const { mimeType, data } = extractDataFromDataUrl(dataUrl);
      const ai = new GoogleGenAI({ apiKey });

      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: [
          {
            type: "user_input",
            content: [
              { type: "text", text: "Describe this image in a short caption." },
              { type: "image", mime_type: mimeType, data },
            ],
          },
        ],
        response_modalities: ["text"],
        generation_config: { thinking_level: "minimal" },
        store: false,
      });
      return interaction;
    }),
    map((response) => {
      const text = extractInteractionText(response.steps);
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

      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
        response_modalities: ["text"],
        store: false,
      });

      const text = extractInteractionText(interaction.steps);
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
      const parts: Interactions.Content[] = [];
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

      parts.push({ type: "text", text: prompt });

      if (content.imageSrc) {
        try {
          const dataUrl = await urlToBase64(content.imageSrc);
          const { mimeType, data } = extractDataFromDataUrl(dataUrl);
          parts.push({
            type: "image",
            mime_type: mimeType,
            data,
          });
        } catch (e) {
          console.error("Failed to process image for AI", e);
          // Continue without image if failed
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: [{ type: "user_input", content: parts }],
        response_format: { type: "text", mime_type: "application/json" },
        store: false,
      });

      const text = extractInteractionText(interaction.steps);
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

export function generateRefinedCardText(input: {
  oldImageSrc: string;
  newImageSrc: string;
  oldTitle: string;
  oldBody: string;
  apiKey: string;
}): Observable<{ title: string; body: string }> {
  return from(
    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const parts: Interactions.Content[] = [];

        parts.push({
          type: "text",
          text: `You are an AI assistant helping to refine a card's content after an image modification.
We modified an original image based on user drawing and feedback to produce a refined image.
Original Card Title: "${input.oldTitle || ""}"
Original Card Body: "${input.oldBody || ""}"

We will show you the original (old) image and the refined (new) image.
Please analyze the differences and generate a new title and a new body text that match the refined image while preserving the style and context of the original card.

Your output must be a JSON object with two fields:
- "title": a short, catchy title (max 4 words)
- "body": a concise, compelling description (1-2 sentences)

Return ONLY the JSON object. Do not include any other text or markdown formatting.
Example: {"title": "...", "body": "..."}`,
        });

        if (input.oldImageSrc) {
          try {
            const dataUrl = await urlToBase64(input.oldImageSrc);
            const { mimeType, data } = extractDataFromDataUrl(dataUrl);
            parts.push({
              type: "text",
              text: "This is the original (old) image before modification.",
            });
            parts.push({
              type: "image",
              mime_type: mimeType,
              data,
            });
          } catch (e) {
            console.error("Failed to process old image for text generation", e);
          }
        }

        if (input.newImageSrc) {
          try {
            const dataUrl = await urlToBase64(input.newImageSrc);
            const { mimeType, data } = extractDataFromDataUrl(dataUrl);
            parts.push({
              type: "text",
              text: "This is the refined (new) image after modification.",
            });
            parts.push({
              type: "image",
              mime_type: mimeType,
              data,
            });
          } catch (e) {
            console.error("Failed to process new image for text generation", e);
          }
        }

        const interaction = await ai.interactions.create({
          model: "gemini-3.6-flash",
          input: [{ type: "user_input", content: parts }],
          response_format: { type: "text", mime_type: "application/json" },
          store: false,
        });

        const text = extractInteractionText(interaction.steps);
        if (!text) {
          return { title: input.oldTitle || "Untitled", body: input.oldBody || "" };
        }

        try {
          const parsed = JSON.parse(text);
          return {
            title: parsed.title || input.oldTitle || "Untitled",
            body: parsed.body || input.oldBody || "",
          };
        } catch (e) {
          console.error("Failed to parse JSON response from AI for sketch refinement", text);
          return { title: input.oldTitle || "Untitled", body: input.oldBody || "" };
        }
      } finally {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      }
    })(),
  );
}
