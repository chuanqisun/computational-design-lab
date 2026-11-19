import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_VIDEO_MODEL } from "../../lib/gemini-models";
import { progress$ } from "../progress/progress";

export interface GeminiConnection {
  apiKey: string;
}

export interface GenerateVideoOptions {
  prompt: string;
  model?: string;
  aspectRatio?: "16:9" | "9:16";
  duration?: "4s" | "8s" | "15s";
  startFrameUrl?: string;
}

export interface GenerateVideoResult {
  url: string;
}

function parseDataUrl(src: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(src);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const parsed = parseDataUrl(String(reader.result));
      parsed ? resolve(parsed.data) : reject(new Error("Could not encode media."));
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read media.")));
    reader.readAsDataURL(blob);
  });
}

async function sourceToInline(src: string): Promise<{ mimeType: string; data: string }> {
  const inline = parseDataUrl(src);
  if (inline) return inline;

  const response = await fetch(src);
  if (!response.ok) throw new Error(`Media request failed with status ${response.status}.`);
  const blob = await response.blob();
  return { mimeType: blob.type || "image/png", data: await blobToBase64(blob) };
}

function extractVideo(
  steps: Interactions.Step[] | undefined,
  outputVideo?: Interactions.VideoContent,
): { data: string; mimeType: string } {
  for (const step of steps || []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content || []) {
      if (content.type === "video" && content.data) {
        return { data: content.data, mimeType: content.mime_type || "video/mp4" };
      }
    }
  }
  if (outputVideo?.data) {
    return { data: outputVideo.data, mimeType: outputVideo.mime_type || "video/mp4" };
  }
  throw new Error("Gemini returned no video.");
}

export function generateVideo(
  connection: GeminiConnection,
  options: GenerateVideoOptions,
): Observable<GenerateVideoResult> {
  return new Observable<GenerateVideoResult>((subscriber) => {
    progress$.next({ ...progress$.value, videoGen: progress$.value.videoGen + 1 });

    const abortController = new AbortController();
    let isAborted = false;

    subscriber.add(() => {
      progress$.next({ ...progress$.value, videoGen: Math.max(0, progress$.value.videoGen - 1) });
      isAborted = true;
      abortController.abort();
    });

    void (async () => {
      try {
        const ai = new GoogleGenAI({
          apiKey: connection.apiKey,
          apiVersion: "v1beta",
        });

        const model = options.model && !options.model.startsWith("veo-") ? options.model : GEMINI_VIDEO_MODEL;
        const contents: Interactions.Content[] = [];

        if (options.startFrameUrl) {
          const startFrame = await sourceToInline(options.startFrameUrl);
          contents.push({
            type: "image",
            mime_type: startFrame.mimeType || "image/png",
            data: startFrame.data,
          });
        }

        const promptText = options.startFrameUrl
          ? `Use Image1 as the starting frame. ${options.prompt.trim()}`
          : options.prompt.trim();

        contents.push({ type: "text", text: promptText });

        const interaction = await ai.interactions.create(
          {
            api_version: "v1beta",
            model,
            input: [{ type: "user_input", content: contents }],
            response_format: {
              type: "video",
              delivery: "inline",
              aspect_ratio: options.aspectRatio || "16:9",
              duration: options.duration ?? "4s",
            },
            store: false,
            stream: false,
          },
          { signal: abortController.signal },
        );

        if (isAborted) return;

        const video = extractVideo(interaction.steps, interaction.output_video);
        subscriber.next({ url: `data:${video.mimeType};base64,${video.data}` });
        subscriber.complete();
      } catch (error) {
        if (!isAborted) {
          subscriber.error(error);
        }
      }
    })();
  });
}
