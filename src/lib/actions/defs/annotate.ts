export interface ImageRegion {
  /** Fractions of the image size, 0..1. */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

/** Same stroke as the human Sketch tool so the image model sees an identical annotation format. */
export const SKETCH_STROKE_COLOR = "#ff0000";

/** Box geometry in image pixels (pure; tested). */
export function regionToPixels(region: ImageRegion, width: number, height: number) {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const x = clamp(region.x) * width;
  const y = clamp(region.y) * height;
  return {
    x,
    y,
    w: Math.min(clamp(region.w) * width, width - x),
    h: Math.min(clamp(region.h) * height, height - y),
  };
}

/**
 * Rasterize agent-provided regions onto the image, producing the same kind of annotated PNG the human
 * Sketch tool produces from freehand strokes.
 */
export async function annotateImageWithRegions(src: string, regions: ImageRegion[]): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the image to annotate."));
    image.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0);

  const lineWidth = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) / 128));
  context.strokeStyle = SKETCH_STROKE_COLOR;
  context.fillStyle = SKETCH_STROKE_COLOR;
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.font = `bold ${lineWidth * 5}px sans-serif`;
  context.textBaseline = "bottom";

  for (const region of regions) {
    const box = regionToPixels(region, canvas.width, canvas.height);
    context.strokeRect(box.x, box.y, box.w, box.h);
    if (region.label) {
      const textY = box.y > lineWidth * 6 ? box.y - lineWidth : box.y + box.h + lineWidth * 6;
      context.fillText(region.label, box.x, textY);
    }
  }

  return canvas.toDataURL("image/png");
}
