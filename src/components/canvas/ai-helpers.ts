import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../lib/gemini-models";
import { progress$ } from "../progress/progress";

/**
 * Converts a URL or fetchable resource to a base64 string.
 */
async function urlToBase64(url: string, signal?: AbortSignal): Promise<string> {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url, { signal });
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

const GEMINI_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/mpeg",
  "video/mpg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/webm",
  "video/wmv",
  "video/3gpp",
  "video/vnd.youtube.yt",
]);

function normalizeGeminiVideoMimeType(mimeType?: string): string | null {
  const baseMimeType = mimeType?.split(";", 1)[0].trim().toLowerCase();
  return baseMimeType && GEMINI_VIDEO_MIME_TYPES.has(baseMimeType) ? baseMimeType : null;
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

export function enhancePrompt(originalPrompt: string, cardContext: string, apiKey: string): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    void (async () => {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image. 
      
      Original prompt: '${originalPrompt}'
      Context from card: '${cardContext}'
      
      Keep it descriptive but concise. Return ONLY the enhanced prompt.`;

      const interaction = await ai.interactions.create(
        {
          model: GEMINI_TEXT_MODEL,
          input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
          generation_config: { thinking_level: GEMINI_TEXT_THINKING },
          store: false,
        },
        { signal: abortController.signal },
      );

      const text = extractInteractionText(interaction.steps);
      if (!text) throw new Error("No enhanced prompt generated");
      subscriber.next(text);
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}

export interface CardContent {
  title?: string;
  body?: string;
  imagePrompt?: string;
  imageSrc?: string;
  videoSrc?: string;
  videoMimeType?: string;
}

export function fillCard(content: CardContent, apiKey: string): Observable<Partial<CardContent>> {
  return new Observable<Partial<CardContent>>((subscriber) => {
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());

    void (async () => {
      const parts: Interactions.Content[] = [];
      let prompt = `I have a card with the following content:
Title: ${content.title || "(missing)"}
Body: ${content.body || "(missing)"}
Image Prompt: ${content.imagePrompt || "(missing)"}

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image or video is provided, generate a detailed image generation prompt.
- If image or video is provided, use it to generate the missing text fields.
- Never generate or return video content.

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}`;

      parts.push({ type: "text", text: prompt });

      if (content.imageSrc) {
        try {
          const dataUrl = await urlToBase64(content.imageSrc, abortController.signal);
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

      if (content.videoSrc) {
        try {
          const dataUrl = await urlToBase64(content.videoSrc, abortController.signal);
          const extracted = extractDataFromDataUrl(dataUrl);
          const mimeType =
            normalizeGeminiVideoMimeType(extracted.mimeType) ?? normalizeGeminiVideoMimeType(content.videoMimeType);
          if (!mimeType) throw new Error("Unsupported Gemini video MIME type");

          parts.push({
            type: "video",
            mime_type: mimeType,
            data: extracted.data,
          });
        } catch (e) {
          throw new Error("Failed to process video for AI", { cause: e });
        }
      }

      const properties: Record<string, { type: "string" }> = {};
      const required: string[] = [];
      if (!content.title) {
        properties.title = { type: "string" };
        required.push("title");
      }
      if (!content.body) {
        properties.body = { type: "string" };
        required.push("body");
      }
      if (!content.videoSrc && !content.imageSrc && !content.imagePrompt) {
        properties.imagePrompt = { type: "string" };
        required.push("imagePrompt");
      }

      if (required.length === 0) {
        subscriber.next({});
        subscriber.complete();
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create(
        {
          model: GEMINI_TEXT_MODEL,
          input: [{ type: "user_input", content: parts }],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: { type: "object", properties, required },
          },
          generation_config: { thinking_level: GEMINI_TEXT_THINKING },
          store: false,
        },
        { signal: abortController.signal },
      );

      const text = extractInteractionText(interaction.steps);
      if (!text) {
        subscriber.next({});
        subscriber.complete();
        return;
      }

      try {
        const parsed = JSON.parse(text) as Partial<CardContent>;
        const updates: Partial<CardContent> = {};
        if (!content.title && typeof parsed.title === "string") updates.title = parsed.title;
        if (!content.body && typeof parsed.body === "string") updates.body = parsed.body;
        if (!content.videoSrc && !content.imagePrompt && typeof parsed.imagePrompt === "string") {
          updates.imagePrompt = parsed.imagePrompt;
        }
        subscriber.next(updates);
      } catch (e) {
        console.error("Failed to parse JSON response from AI", text);
        subscriber.next({});
      }
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}

export function generateRefinedCardText(input: {
  oldImageSrc: string;
  newImageSrc: string;
  oldTitle: string;
  oldBody: string;
  apiKey: string;
}): Observable<{ title: string; body: string }> {
  return new Observable<{ title: string; body: string }>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    void (async () => {
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
          const dataUrl = await urlToBase64(input.oldImageSrc, abortController.signal);
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
          const dataUrl = await urlToBase64(input.newImageSrc, abortController.signal);
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

      const interaction = await ai.interactions.create(
        {
          model: GEMINI_TEXT_MODEL,
          input: [{ type: "user_input", content: parts }],
          response_format: { type: "text", mime_type: "application/json" },
          generation_config: { thinking_level: GEMINI_TEXT_THINKING },
          store: false,
        },
        { signal: abortController.signal },
      );

      const text = extractInteractionText(interaction.steps);
      if (!text) {
        subscriber.next({ title: input.oldTitle || "Untitled", body: input.oldBody || "" });
        subscriber.complete();
        return;
      }

      try {
        const parsed = JSON.parse(text);
        subscriber.next({
          title: parsed.title || input.oldTitle || "Untitled",
          body: parsed.body || input.oldBody || "",
        });
      } catch (e) {
        console.error("Failed to parse JSON response from AI for sketch refinement", text);
        subscriber.next({ title: input.oldTitle || "Untitled", body: input.oldBody || "" });
      }
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}
