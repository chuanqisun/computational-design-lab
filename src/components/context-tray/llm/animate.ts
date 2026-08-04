import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export type AnimateImageRole = "auto" | "starting-frame" | "reference";
export type AnimateAspectRatio = "default" | "16:9" | "9:16";
export type AnimateDuration = "default" | "4s" | "8s";
export type AnimateTask = "default" | "text_to_video" | "image_to_video" | "reference_to_video" | "edit";

export type AnimateInput =
  | { kind: "video"; cardId: string; src: string; mimeType?: string; title?: string }
  | { kind: "image"; cardId: string; src: string; imageId: string; title?: string }
  | { kind: "text"; cardId: string; text: string; title?: string };

export interface ResolvedAnimateInputs {
  inputs: AnimateInput[];
  omitted: CanvasItem[];
}

const textFields = ["title", "body", "imagePrompt"] as const;

export function resolveAnimateInputs(items: CanvasItem[]): ResolvedAnimateInputs {
  const inputs: AnimateInput[] = [];
  const omitted: CanvasItem[] = [];
  let imageIndex = 0;

  for (const item of items) {
    const videoSrc = item.videoSrc?.trim();
    if (videoSrc) {
      inputs.push({
        kind: "video",
        cardId: item.id,
        src: videoSrc,
        mimeType: item.videoMimeType?.trim() || undefined,
        title: item.title?.trim() || undefined,
      });
      continue;
    }

    const imageSrc = item.imageSrc?.trim();
    if (imageSrc) {
      imageIndex += 1;
      inputs.push({
        kind: "image",
        cardId: item.id,
        src: imageSrc,
        imageId: `Image${imageIndex}`,
        title: item.title?.trim() || undefined,
      });
      continue;
    }

    const text = textFields
      .flatMap((field) => {
        const value = item[field]?.trim();
        if (!value) return [];
        const label = field === "imagePrompt" ? "Image prompt" : `${field[0].toUpperCase()}${field.slice(1)}`;
        return `${label}: ${value}`;
      })
      .join("\n");

    if (text) {
      inputs.push({ kind: "text", cardId: item.id, text, title: item.title?.trim() || undefined });
    } else {
      omitted.push(item);
    }
  }

  return { inputs, omitted };
}

export function setAnimateImageRole(
  roles: Readonly<Record<string, AnimateImageRole>>,
  imageId: string,
  role: AnimateImageRole,
): Record<string, AnimateImageRole> {
  const next = { ...roles };
  if (role === "starting-frame") {
    for (const id of Object.keys(next)) {
      if (next[id] === "starting-frame") next[id] = "auto";
    }
  }
  next[imageId] = role;
  return next;
}

export interface AnimateImageTokens {
  primary: string;
  annotation?: string;
}

export function getAnimateImageTokens(
  inputs: AnimateInput[],
  roles: Readonly<Record<string, AnimateImageRole>>,
  annotatedImageIds: ReadonlySet<string> = new Set(),
): Record<string, AnimateImageTokens> {
  const images = inputs.filter((input): input is Extract<AnimateInput, { kind: "image" }> => input.kind === "image");
  const tokens: Record<string, AnimateImageTokens> = {};
  let referenceIndex = 0;

  for (const image of images) {
    if (roles[image.imageId] === "starting-frame") tokens[image.imageId] = { primary: "<FIRST_FRAME>" };
  }
  for (const role of ["reference", "auto"] as const) {
    for (const image of images) {
      if ((roles[image.imageId] || "auto") === role) {
        tokens[image.imageId] = { primary: `<IMAGE_REF_${referenceIndex++}>` };
      }
    }
  }

  const annotatedStartingFrame = images.find(
    (image) => roles[image.imageId] === "starting-frame" && annotatedImageIds.has(image.imageId),
  );
  if (annotatedStartingFrame) {
    tokens[annotatedStartingFrame.imageId].annotation = `<IMAGE_REF_${referenceIndex}>`;
  }

  return tokens;
}

export function buildAnimateMacro(
  inputs: AnimateInput[],
  roles: Readonly<Record<string, AnimateImageRole>>,
  annotatedImageIds: ReadonlySet<string> = new Set(),
): string {
  const images = inputs.filter((input): input is Extract<AnimateInput, { kind: "image" }> => input.kind === "image");
  const tokens = getAnimateImageTokens(inputs, roles, annotatedImageIds);
  const startingFrame = images.find((image) => roles[image.imageId] === "starting-frame");
  const references = images.filter((image) => roles[image.imageId] === "reference");
  const annotatedStartingFrame =
    startingFrame && annotatedImageIds.has(startingFrame.imageId) ? startingFrame : undefined;
  const groups: string[] = [];

  if (startingFrame) groups.push(`[# Sources <FIRST_FRAME>@${startingFrame.imageId}]`);
  if (references.length || annotatedStartingFrame) {
    const entries = references.map((image) => `${tokens[image.imageId].primary}@${image.imageId}`);
    if (annotatedStartingFrame) {
      entries.push(`${tokens[annotatedStartingFrame.imageId].annotation}@Image${images.length + 1}`);
    }
    groups.push(`[# References ${entries.join(" ")}]`);
  }

  return groups.join(" ");
}

export function combineAnimateInstruction(macro: string, instruction: string): string {
  return [macro, instruction.trim()].filter(Boolean).join(" ");
}

const supportedVideoMimeTypes = new Set([
  "video/mp4",
  "video/mpeg",
  "video/mpg",
  "video/quicktime",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/webm",
  "video/wmv",
  "video/3gpp",
]);

export function normalizeAnimateVideoMimeType(mimeType?: string): string | null {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "video/quicktime") return "video/mov";
  return supportedVideoMimeTypes.has(normalized) ? normalized : null;
}

export function getAnimatePreflightErrors(inputs: AnimateInput[], hasApiKey: boolean): string[] {
  const errors: string[] = [];
  const videos = inputs.filter((input): input is Extract<AnimateInput, { kind: "video" }> => input.kind === "video");

  if (!hasApiKey) errors.push("A Gemini API key is required.");
  if (!inputs.length) errors.push("Select at least one card with video, image, or text content.");
  if (videos.length > 1) errors.push("Animate supports one video input at a time.");
  for (const video of videos) {
    const sourceMimeType = parseDataUrl(video.src)?.mimeType;
    if (
      (sourceMimeType || video.mimeType) &&
      !normalizeAnimateVideoMimeType(sourceMimeType) &&
      !normalizeAnimateVideoMimeType(video.mimeType)
    ) {
      errors.push(`Card “${video.title || video.cardId}” has an unsupported video type.`);
    }
  }

  return errors;
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
  return { mimeType: blob.type, data: await blobToBase64(blob) };
}

function loadInlineImage(source: { mimeType: string; data: string }): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Image could not be decoded.")), { once: true });
    image.src = `data:${source.mimeType};base64,${source.data}`;
  });
}

async function flattenImage(source: { mimeType: string; data: string }, overlay: HTMLCanvasElement): Promise<string> {
  const image = await loadInlineImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.drawImage(image, 0, 0);
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  const flattened = parseDataUrl(canvas.toDataURL("image/png"));
  if (!flattened) throw new Error("Canvas export failed.");
  return flattened.data;
}

export async function prepareAnimateContents(
  inputs: AnimateInput[],
  annotatedImages: ReadonlyMap<string, HTMLCanvasElement>,
  roles: Readonly<Record<string, AnimateImageRole>>,
): Promise<Interactions.Content[]> {
  const contents: Interactions.Content[] = [];
  const annotatedStartingFrames: Interactions.Content[] = [];

  for (const input of inputs) {
    if (input.kind === "text") {
      contents.push({ type: "text", text: input.text });
      continue;
    }

    let source: { mimeType: string; data: string };
    try {
      source = await sourceToInline(input.src);
    } catch (error) {
      if (input.kind === "image") throw new Error(`${input.imageId} could not be loaded.`, { cause: error });
      throw new Error(`Card “${input.title || input.cardId}” could not be loaded.`, { cause: error });
    }

    if (input.kind === "video") {
      const mimeType = normalizeAnimateVideoMimeType(source.mimeType) || normalizeAnimateVideoMimeType(input.mimeType);
      if (!mimeType) throw new Error(`Card “${input.title || input.cardId}” has an unsupported video type.`);
      contents.push({ type: "video", mime_type: mimeType, data: source.data });
      continue;
    }

    const overlay = annotatedImages.get(input.imageId);
    if (!overlay) {
      contents.push({ type: "image", mime_type: source.mimeType || "image/png", data: source.data });
      continue;
    }

    try {
      const annotated = { type: "image" as const, mime_type: "image/png", data: await flattenImage(source, overlay) };
      if (roles[input.imageId] === "starting-frame") {
        contents.push({ type: "image", mime_type: source.mimeType || "image/png", data: source.data });
        annotatedStartingFrames.push(annotated);
      } else {
        contents.push(annotated);
      }
    } catch (error) {
      throw new Error(`${input.imageId} cannot be exported because its source does not allow canvas access.`, {
        cause: error,
      });
    }
  }

  return [...contents, ...annotatedStartingFrames];
}

export function buildAnimateRequest(input: {
  contents: readonly Interactions.Content[];
  instruction: string;
  aspectRatio: AnimateAspectRatio;
  duration: AnimateDuration;
  task: AnimateTask;
}): Interactions.CreateModelInteractionParamsNonStreaming & { stream: false } {
  const steps: Interactions.Step[] = [
    {
      type: "user_input",
      content: [...input.contents, { type: "text", text: input.instruction }],
    },
  ];

  return {
    model: "gemini-omni-flash-preview",
    input: steps,
    response_format: {
      type: "video",
      delivery: "inline",
      ...(input.aspectRatio === "default" ? {} : { aspect_ratio: input.aspectRatio }),
      ...(input.duration === "default" ? {} : { duration: input.duration }),
    },
    ...(input.task === "default" ? {} : { generation_config: { video_config: { task: input.task } } }),
    store: false,
    stream: false,
  };
}

export function generateAnimatedVideo(input: {
  contents: Interactions.Content[];
  instruction: string;
  aspectRatio: AnimateAspectRatio;
  duration: AnimateDuration;
  task: AnimateTask;
  apiKey: string;
}): Observable<{ data: string; mimeType: string }> {
  return new Observable((subscriber) => {
    progress$.next({ ...progress$.value, videoGen: progress$.value.videoGen + 1 });

    const abortController = new AbortController();
    subscriber.add(() => {
      progress$.next({ ...progress$.value, videoGen: Math.max(0, progress$.value.videoGen - 1) });
      abortController.abort();
    });

    void (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const interaction = await ai.interactions.create(buildAnimateRequest(input), {
          signal: abortController.signal,
        });
        subscriber.next(extractAnimateVideo(interaction.steps));
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}

export function extractAnimateVideo(steps: Interactions.Step[] | undefined): { data: string; mimeType: string } {
  for (const step of steps || []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content || []) {
      if (content.type === "video" && content.data) {
        return { data: content.data, mimeType: content.mime_type || "video/mp4" };
      }
    }
  }
  throw new Error("Gemini returned no video.");
}
