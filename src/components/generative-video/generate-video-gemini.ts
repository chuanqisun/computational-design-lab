import { GoogleGenAI } from "@google/genai";
import { Observable } from "rxjs";
import type { GenerateVideosParameters } from "../connections/gemini-video.types";
import { progress$ } from "../progress/progress";

export interface GeminiConnection {
  apiKey: string;
}

export interface GenerateVideoOptions {
  prompt: string;
  model: string;
  aspectRatio?: "16:9" | "9:16";
  startFrameUrl?: string;
}

export interface GenerateVideoResult {
  url: string;
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

    (async () => {
      try {
        const ai = new GoogleGenAI({
          apiKey: connection.apiKey,
        });

        const params: GenerateVideosParameters = {
          model: options.model,
          prompt: options.prompt,
          config: {
            aspectRatio: options.aspectRatio || "16:9",
            resolution: "720p",
            durationSeconds: 4,
          },
        };

        if (options.startFrameUrl) {
          if (options.startFrameUrl.startsWith("data:")) {
            const [mimeTypePart, data] = options.startFrameUrl.split(",");
            const mimeType = mimeTypePart.split(":")[1].split(";")[0];
            params.image = {
              imageBytes: data,
              mimeType,
            };
          } else {
            // Fetch external image
            const response = await fetch(options.startFrameUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            const [, data] = dataUrl.split(",");
            params.image = {
              imageBytes: data,
              mimeType: blob.type,
            };
          }
        }

        let operation = await (ai as any).models.generateVideos(params);

        while (!operation.done && !isAborted) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          if (isAborted) break;
          operation = await (ai as any).operations.getVideosOperation({
            operation: operation,
          });
        }

        if (isAborted) return;

        if (operation.response && operation.response.generatedVideos && operation.response.generatedVideos.length > 0) {
          const generatedVideo = operation.response.generatedVideos[0];
          const vidData = generatedVideo.video;

          if (!vidData) {
            subscriber.error(new Error("Video data missing in response"));
            return;
          }

          let videoUrl: string;

          if (vidData.videoBytes) {
            // Handle base64 video bytes
            videoUrl = `data:${vidData.mimeType || "video/mp4"};base64,${vidData.videoBytes}`;
          } else if (vidData.uri) {
            // Handle video URI - requires API key in header
            const response = await fetch(vidData.uri, {
              headers: { "x-goog-api-key": connection.apiKey },
              redirect: "follow",
            });
            if (!response.ok) {
              throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();
            videoUrl = URL.createObjectURL(blob);
          } else {
            subscriber.error(new Error("Video data is missing both videoBytes and uri"));
            return;
          }

          subscriber.next({ url: videoUrl });
          subscriber.complete();
        } else {
          subscriber.error(new Error("Invalid operation response"));
        }
      } catch (error) {
        if (!isAborted) {
          subscriber.error(error);
        }
      }
    })();
  });
}
