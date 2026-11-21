import { EMPTY, catchError, defer, finalize, last, map, mergeMap, of, switchMap, tap, toArray } from "rxjs";
import { enhancePrompt, generateRefinedCardText } from "../../../components/canvas/ai-helpers";
import type { CanvasItem } from "../../../components/canvas/canvas.component";
import { blendImages } from "../../../components/context-tray/llm/blend-images";
import { designConcepts$ } from "../../../components/context-tray/llm/design-concepts";
import { scanConcepts$ } from "../../../components/context-tray/llm/scan-concepts";
import { MAX_SEARCH_RESULTS, searchImages, streamSearchResults$ } from "../../../components/context-tray/llm/search-images";
import { visualizeConcept$ } from "../../../components/context-tray/llm/visualize-concept";
import { generateImage } from "../../../components/design/generate-image-gemini";
import { imageToimage } from "../../../components/semantic-scan/image-to-image";
import { needsFill, needsRender } from "../card-fill";
import { ActionError, type ActionContext, type ActionDef, type ActionResult } from "../types";
import { annotateImageWithRegions, type ImageRegion } from "./annotate";

const cardIdsParam = {
  type: "array" as const,
  items: { type: "string" as const },
  description: "Input card ids. Defaults to the current selection.",
};

const needTargets =
  (min: number, filter: (card: { kind: string; body?: string }) => boolean = () => true, reason?: string) =>
  ({ targets }: { targets: { kind: string; body?: string }[] }) =>
    targets.filter(filter).length >= min
      ? (true as const)
      : { reason: reason ?? `Select at least ${min} card${min > 1 ? "s" : ""}` };

/** Add a card at the next streamed position, returning its id. */
function addStreamedCard(ctx: ActionContext, next: () => { x: number; y: number; z: number }, card: Partial<CanvasItem>, prefix: string) {
  const pos = next();
  const id = ctx.newId(prefix);
  const item: CanvasItem = { width: 200, height: 300, isSelected: false, ...card, id, x: pos.x, y: pos.y, zIndex: pos.z };
  // Mark cards the action will settle as pending from the start, so the card view shows a placeholder instead of
  // starting its own <generative-image> render (which would generate the same image twice).
  if (!item.metadata?.pending) {
    const pending = needsRender(item) ? "image" : needsFill(item) ? "fill" : undefined;
    if (pending) item.metadata = { ...item.metadata, pending };
  }
  ctx.addCards([item]);
  return id;
}

/** Settle each created card as soon as it streams in, then report them all (in creation order). */
function collectAndSettle(ctx: ActionContext, summary: (ids: string[]) => string) {
  return (source: import("rxjs").Observable<string>) => {
    const ids: string[] = [];
    return source.pipe(
      tap((id) => ids.push(id)),
      mergeMap((id) => ctx.settle$([id]), 4),
      toArray(),
      map((): ActionResult => ({ summary: summary(ids), created: [...ids] })),
      // If stopped, cards still queued for settling never started; drop their pending placeholder.
      finalize(() => {
        for (const id of ids) {
          if (ctx.items$.value.find((item) => item.id === id)?.metadata?.pending) {
            ctx.updateCard(id, { metadata: { pending: undefined } });
          }
        }
      }),
    );
  };
}

export const renderImage: ActionDef<{ prompt: string; cardIds?: string[] }> = {
  name: "render_image",
  description:
    "Render a new image card from a text prompt. Text and images of the input cards (if any) are used as additional context.",
  parameters: {
    type: "object",
    properties: { prompt: { type: "string" }, cardIds: cardIdsParam },
    required: ["prompt"],
  },
  needsApiKey: true,
  isAvailable: () => true,
  run: (args, ctx) => {
    const prompt = args.prompt.trim();
    if (!prompt) throw new ActionError("invalid_args", "prompt must not be empty");
    const fullPrompt = [prompt, ...ctx.targets.filter((c) => c.body).map((c) => c.body)].join(" ");
    const images = ctx.targets.filter((c) => c.imageSrc).map((c) => c.imageSrc!);
    const next = ctx.placer();
    return generateImage(
      { apiKey: ctx.apiKey },
      { prompt: fullPrompt, width: 512, height: 512, images: images.length ? images : undefined },
    ).pipe(
      map((result) => addStreamedCard(ctx, next, { imageSrc: result.url, imagePrompt: prompt }, "rendered")),
      collectAndSettle(ctx, (ids) => `Rendered ${ids.length} image(s) for "${prompt.slice(0, 40)}"`),
    );
  },
  log: "record",
  humanEntry: "tray:New/Render",
  agent: "native",
};

export const searchReferences: ActionDef<{ prompt: string; cardIds?: string[]; maxResults?: number }> = {
  name: "search_references",
  description:
    "Search the web for visual references on a topic. Creates one card (title, details, reference image) per result. Input cards add context.",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      cardIds: cardIdsParam,
      maxResults: { type: "integer", minimum: 1, maximum: MAX_SEARCH_RESULTS },
    },
    required: ["prompt"],
  },
  needsApiKey: true,
  isAvailable: () => true,
  run: (args, ctx) => {
    const prompt = args.prompt.trim();
    if (!prompt) throw new ActionError("invalid_args", "prompt must not be empty");
    const contextText = ctx.targets
      .flatMap((card) => [card.title, card.body, card.imagePrompt])
      .filter(Boolean)
      .join("\n");
    const images = ctx.targets.flatMap((card) => (card.imageSrc ? [card.imageSrc] : []));
    const sourceId = ctx.newId("search");
    const next = ctx.placer();
    const created: string[] = [];

    return streamSearchResults$({
      apiKey: ctx.apiKey,
      prompt,
      contextText,
      images,
      maxResults: args.maxResults ?? MAX_SEARCH_RESULTS,
    }).pipe(
      mergeMap((result) => {
        const id = addStreamedCard(
          ctx,
          next,
          {
            title: result.title,
            body: result.details,
            metadata: { source: "gemini-image-search", sourceId, prompt, pending: "search" },
          },
          "search",
        );
        created.push(id);
        const imagePrompt = `Search for and generate a clear, representative visual reference image of "${result.title}". ${result.details}\nSearch topic: ${prompt}. Clean single-subject presentation, no text labels or watermarks.`;
        return searchImages(ctx.apiKey, imagePrompt).pipe(
          tap((imageResult) =>
            ctx.updateCard(id, {
              imageSrc: imageResult.url,
              metadata: { searchSuggestions: imageResult.searchSuggestions },
            }),
          ),
          catchError((error) => {
            console.error(`Search image generation failed for "${result.title}":`, error);
            return EMPTY;
          }),
          finalize(() => ctx.updateCard(id, { metadata: { pending: undefined } })),
        );
      }),
      last(undefined, null),
      map(() => ({ summary: `Found ${created.length} reference(s) for "${prompt.slice(0, 40)}"`, created: [...created] })),
    );
  },
  log: "record",
  humanEntry: "tray:New/Search",
  agent: "native",
};

export const VISUALIZE_STYLES = {
  abstract:
    "Create abstract, artistic visualizations that capture the essence of the concept in non-literal, symbolic ways. Use diverse artistic styles, colors, and compositions to represent ideas metaphorically.",
  concrete:
    "Create concrete, realistic visualizations that depict the concept in literal, tangible forms. Focus on detailed, lifelike representations that show the concept as it might appear in reality.",
} as const;

export const visualizeConcept: ActionDef<{ style: keyof typeof VISUALIZE_STYLES; cardIds?: string[] }> = {
  name: "visualize_concept",
  description: "Turn the text of the input cards into images. style: abstract (symbolic) or concrete (realistic).",
  parameters: {
    type: "object",
    properties: { style: { type: "string", enum: ["abstract", "concrete"] }, cardIds: cardIdsParam },
    required: ["style"],
  },
  needsApiKey: true,
  isAvailable: needTargets(1, (card) => !!card.body, "Select at least one card with text"),
  run: (args, ctx) => {
    const withText = ctx.targets.filter((card) => card.body);
    const description = withText.map((card) => card.body).join(" ");
    const next = ctx.placer();
    return visualizeConcept$({
      concept: { title: "Selected Concept", description },
      instruction: VISUALIZE_STYLES[args.style],
      geminiApiKey: ctx.apiKey,
    }).pipe(
      map((url) => addStreamedCard(ctx, next, { imageSrc: url }, "viz")),
      collectAndSettle(ctx, (ids) => `Visualized ${ids.length} ${args.style} image(s)`),
    );
  },
  log: "record",
  humanEntry: "tray:Visualize",
  agent: "native",
};

export const SCAN_LENSES = {
  emotions:
    "Analyze the selected items and describe how people feel when interacting with them. Focus on emotional responses, moods, and psychological impact.",
  associations:
    "Identify what concepts, objects, memories, or cultural references people associate with the selected items.",
  symbolism:
    "Extract symbols, icons, and abstract meanings from the selected items. What do these elements represent metaphorically?",
  shape: "Analyze the geometric shapes, contours, silhouettes, and profiles present in the selected items.",
  material:
    "Identify the materials involved in or inspired by the selected items. Focus on physical properties and material expression.",
  color:
    "Analyze the color palette present in the selected items and any colors associated with the underlying concepts.",
  tactility:
    "Describe how the selected items would feel to the touch. Focus on texture, temperature, hardness, and surface finish.",
  acoustics:
    "Imagine the sounds associated with the selected items. What do people hear when using or interacting with them?",
  interactions:
    "Describe how people interact with the selected items. Focus on gestures, ergonomics, and functional usage patterns.",
  narrative:
    "Create a narrative based on the selected items. Weave together the visual and textual elements into a cohesive story or scenario.",
} as const;

export type ScanLens = keyof typeof SCAN_LENSES;

export const scanConcept: ActionDef<{ lens: ScanLens; cardIds?: string[] }> = {
  name: "scan_concept",
  description: "Analyze the input cards through a lens and create concept cards (title, description, rendered image).",
  parameters: {
    type: "object",
    properties: { lens: { type: "string", enum: Object.keys(SCAN_LENSES) }, cardIds: cardIdsParam },
    required: ["lens"],
  },
  needsApiKey: true,
  isAvailable: needTargets(1),
  run: (args, ctx) => {
    const next = ctx.placer();
    return scanConcepts$({ items: ctx.targets, instruction: SCAN_LENSES[args.lens], apiKey: ctx.apiKey }).pipe(
      map((concept) =>
        addStreamedCard(
          ctx,
          next,
          { title: concept.title, body: concept.description, imagePrompt: concept.description },
          "scan",
        ),
      ),
      collectAndSettle(ctx, (ids) => `Scanned ${args.lens}: ${ids.length} concept(s)`),
    );
  },
  log: "record",
  humanEntry: "tray:Scan",
  agent: "native",
};

function designRun(
  ctx: ActionContext,
  input: { requirements: string; brandGuide?: string; count: number; prefix: string; label: string },
) {
  const next = ctx.placer();
  return designConcepts$({
    items: ctx.targets,
    requirements: input.requirements,
    brandGuide: input.brandGuide ?? "",
    numDesigns: input.count,
    apiKey: ctx.apiKey,
  }).pipe(
    map((concept) =>
      addStreamedCard(
        ctx,
        next,
        { title: concept.title, body: concept.description, imagePrompt: concept.imagePrompt },
        input.prefix,
      ),
    ),
    collectAndSettle(ctx, (ids) => `${input.label} ${ids.length} design(s)`),
  );
}

export const designConceptsAction: ActionDef<{
  requirements?: string;
  brandGuide?: string;
  count?: number;
  cardIds?: string[];
}> = {
  name: "design_concepts",
  description: "Generate design concepts (title, description, rendered image) from the input cards and requirements.",
  parameters: {
    type: "object",
    properties: {
      requirements: { type: "string" },
      brandGuide: { type: "string" },
      count: { type: "integer", minimum: 1, maximum: 4 },
      cardIds: cardIdsParam,
    },
  },
  needsApiKey: true,
  isAvailable: needTargets(1),
  run: (args, ctx) =>
    designRun(ctx, {
      requirements: args.requirements ?? "",
      brandGuide: args.brandGuide,
      count: args.count ?? 1,
      prefix: "design",
      label: "Designed",
    }),
  log: "record",
  humanEntry: "tray:Design/Create",
  agent: "native",
};

export const iterateDesigns: ActionDef<{
  direction?: string;
  brandGuide?: string;
  count?: number;
  cardIds?: string[];
}> = {
  name: "iterate_designs",
  description: "Iterate on the input designs, optionally following a direction or feedback, producing improved variants.",
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string" },
      brandGuide: { type: "string" },
      count: { type: "integer", minimum: 1, maximum: 5 },
      cardIds: cardIdsParam,
    },
  },
  needsApiKey: true,
  isAvailable: needTargets(1),
  run: (args, ctx) =>
    designRun(ctx, {
      requirements:
        args.direction?.trim() || "Iterate and improve on the existing designs, incorporating any feedback provided.",
      brandGuide: args.brandGuide,
      count: args.count ?? 3,
      prefix: "iterate",
      label: "Iterated",
    }),
  log: "record",
  humanEntry: "tray:Design/Iterate",
  agent: "native",
};

export const blendImagesAction: ActionDef<{ instruction: string; cardIds?: string[] }> = {
  name: "blend_images",
  description: "Blend two or more input cards (images and text) into one new image following an instruction.",
  parameters: {
    type: "object",
    properties: { instruction: { type: "string" }, cardIds: cardIdsParam },
    required: ["instruction"],
  },
  needsApiKey: true,
  isAvailable: needTargets(2),
  run: (args, ctx) => {
    const instruction = args.instruction.trim();
    if (!instruction) throw new ActionError("invalid_args", "instruction must not be empty");
    const next = ctx.placer();
    return blendImages({ instruction, items: ctx.targets, apiKey: ctx.apiKey }).pipe(
      map((src) => addStreamedCard(ctx, next, { imageSrc: src }, "blended")),
      collectAndSettle(ctx, () => `Blended ${ctx.targets.length} cards`),
    );
  },
  log: "record",
  humanEntry: "tray:Blend",
  agent: "native",
};

export const regenerateImage: ActionDef<{ cardId: string; prompt?: string }> = {
  name: "regenerate_image",
  description: "Re-render a card's image from its image prompt (or a new prompt), replacing the current image.",
  parameters: {
    type: "object",
    properties: { cardId: { type: "string" }, prompt: { type: "string" } },
    required: ["cardId"],
  },
  needsApiKey: true,
  isAvailable: () => true,
  run: (args, ctx) => {
    const [card] = ctx.cards([args.cardId]);
    const prompt = (args.prompt ?? card.imagePrompt ?? "").trim();
    if (!prompt) throw new ActionError("invalid_args", "The card has no image prompt; provide prompt");
    ctx.updateCard(card.id, { metadata: { pending: "image" } });
    return enhancePrompt(prompt, "User regeneration request", ctx.apiKey).pipe(
      catchError(() => of(prompt)),
      switchMap((enhanced) =>
        generateImage({ apiKey: ctx.apiKey }, { prompt: enhanced, width: 512, height: 512 }).pipe(
          map((result) => {
            ctx.updateCard(card.id, { imageSrc: result.url, imagePrompt: enhanced });
            return { summary: `Regenerated image of ${card.title || card.id}`, updated: [card.id] };
          }),
        ),
      ),
      finalize(() => ctx.updateCard(card.id, { metadata: { pending: undefined } })),
    );
  },
  log: "record",
  humanEntry: "dialog:Regenerate",
  agent: "native",
};

export const editImage: ActionDef<{
  cardIds?: string[];
  instruction?: string;
  regions?: ImageRegion[];
  _annotatedImage?: string;
}> = {
  name: "edit_image",
  description:
    "Edit the image of the first input card that has an image. Optionally mark regions (x,y,w,h as 0-1 fractions of the image, with a label) to point at what should change; they are drawn onto the image as annotations like a human sketch.",
  parameters: {
    type: "object",
    properties: {
      cardIds: cardIdsParam,
      instruction: { type: "string" },
      regions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            x: { type: "number", minimum: 0, maximum: 1 },
            y: { type: "number", minimum: 0, maximum: 1 },
            w: { type: "number", minimum: 0, maximum: 1 },
            h: { type: "number", minimum: 0, maximum: 1 },
            label: { type: "string" },
          },
          required: ["x", "y", "w", "h"],
        },
      },
    },
  },
  humanArgs: ["_annotatedImage"],
  needsApiKey: true,
  isAvailable: needTargets(1, (card) => card.kind === "image" || card.kind === "mixed", "Select a card with an image"),
  run: (args, ctx) => {
    const source = ctx.targets.find((card) => card.imageSrc);
    if (!source?.imageSrc) throw new ActionError("unavailable", "No input card has an image");
    const instruction =
      args.instruction?.trim() || "Apply the changes indicated by the sketch annotations on this image";
    const next = ctx.placer();

    return defer(async () =>
      args._annotatedImage ??
      (args.regions?.length ? annotateImageWithRegions(source.imageSrc!, args.regions) : source.imageSrc!),
    ).pipe(
      switchMap((image) => imageToimage({ instruction, image, apiKey: ctx.apiKey })),
      switchMap((resultSrc) => {
        if (!resultSrc) throw new Error("Failed to generate the edited image.");
        const id = addStreamedCard(
          ctx,
          next,
          { imageSrc: resultSrc, title: "Analyzing...", body: "Generating text description...", metadata: { pending: "fill" } },
          "sketch-result",
        );
        return generateRefinedCardText({
          oldImageSrc: source.imageSrc!,
          newImageSrc: resultSrc,
          oldTitle: source.title || "",
          oldBody: source.body || "",
          apiKey: ctx.apiKey,
        }).pipe(
          tap((text) => ctx.updateCard(id, { title: text.title, body: text.body })),
          last(undefined, null),
          finalize(() => ctx.updateCard(id, { metadata: { pending: undefined } })),
          map(() => ({ summary: `Edited image of ${source.title || source.id}`, created: [id] })),
        );
      }),
    );
  },
  log: "record",
  humanEntry: "tray:Media/Sketch",
  agent: "equivalent",
};

export const generativeActions = [
  renderImage,
  searchReferences,
  visualizeConcept,
  scanConcept,
  designConceptsAction,
  iterateDesigns,
  blendImagesAction,
  regenerateImage,
  editImage,
];
