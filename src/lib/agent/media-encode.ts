import type { Interactions } from "@google/genai";
import type { MediaEncoders } from "./observe";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = src;
  });
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxPx: number, quality = 0.8): string {
  const scale = Math.min(1, maxPx / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

const toImageContent = (dataUrl: string): Interactions.ImageContent => ({
  type: "image",
  mime_type: "image/jpeg",
  data: dataUrl.slice(dataUrl.indexOf(",") + 1),
});

export async function encodeImage(src: string, maxPx: number): Promise<Interactions.ImageContent | undefined> {
  const image = await loadImage(src);
  return toImageContent(drawScaled(image, image.naturalWidth, image.naturalHeight, maxPx));
}

export async function encodeVideoFrames(
  src: string,
  maxPx: number,
): Promise<{ frames: Interactions.ImageContent[]; durationS?: number } | undefined> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Video failed to load"));
  });
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const times = duration > 0 ? [0.05, duration / 2, Math.max(0, duration - 0.1)] : [0];
  const frames: Interactions.ImageContent[] = [];
  for (const time of times) {
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = time;
    });
    frames.push(toImageContent(drawScaled(video, video.videoWidth, video.videoHeight, maxPx)));
  }
  video.removeAttribute("src");
  video.load();
  return { frames, durationS: duration || undefined };
}

/** Tiny data URL thumbnail for the action log. */
export async function makeThumb(src: string): Promise<string | undefined> {
  const image = await loadImage(src);
  return drawScaled(image, image.naturalWidth, image.naturalHeight, 96, 0.7);
}

export const browserEncoders: MediaEncoders = { image: encodeImage, videoFrames: encodeVideoFrames };
