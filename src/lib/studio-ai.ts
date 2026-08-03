import { GoogleGenAI, type Interactions } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import type { BehaviorSubject } from "rxjs";
import { loadApiKeys } from "../components/connections/storage";
import { colors } from "../components/material-library/colors";
import { materials } from "../components/material-library/materials";
import { mechanisms } from "../components/material-library/mechanisms";
import { shapes } from "../components/material-library/shapes";
import type { PhotoCard, ScannedPhoto, ScanResult, StudioContent, StudioTurn } from "./studio-types";
import { colorsByName, materialsById, mechanismsById, shapesById } from "./studio-utils";

const studioSystemPrompt = `You are a product visualization scene generator. Output valid XML and nothing else. Do not wrap the output in markdown code blocks. Do not include any explanation or commentary.

The XML must cover these scene slots:
- Subject: identity, object class, pose, expression
- Setting: environment, geography, era, background
- Camera: lens, angle, distance, depth-of-field, aspect ratio
- Lighting: source, direction, color temperature, contrast
- Style / Medium: art form, rendering method
- Color / Grade: palette, saturation, tonal curve

XML format rules:
- Be hierarchical and efficient. Add details when asked by user.
- Avoid nesting too much. Prefer simple, obvious tag names.
- Use arbitrary xml tags and attributes. Prefer tags over attributes.
  - Use tags to describe subjects, objects, environments, and entities.
  - Use attributes to describe un-materialized properties such as style, material, lighting.
- Use concise natural language where description is needed.
- Spatial relationships must be explicitly described.
- Include human-readable descriptions throughout.
- Use Studio keyshot on white Infinity cove for rendering style.

For picked materials: infer the most appropriate surface options and color options based on the other picked items (colors, shapes, mechanisms). When there are multiple colors and multiple surface materials, pick the most straightforward assignment.
For picked surface options: use the specified surface finishes in the scene. If surface options conflict with chosen materials, prefer the user-specified surface options.
For picked mechanisms: describe what the mechanism is, but do NOT render it in action.`;

const getStudioSystemPrompt = (brandGuide: string) => {
  const trimmedBrandGuide = brandGuide.trim();
  return trimmedBrandGuide
    ? `${studioSystemPrompt}\n\nFollow this brand guide when making design, styling, material, color, and scene decisions:\n${trimmedBrandGuide}`
    : studioSystemPrompt;
};

const photoStagePrompt =
  "Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.";

const getPhotoStageSystemPrompt = (brandGuide: string) => {
  const trimmedBrandGuide = brandGuide.trim();
  return trimmedBrandGuide
    ? `You stage product photo scenes as XML. Follow the provided brand guide when choosing styling, materials, atmosphere, prop language, and visual tone. Output only XML, nothing else.\n\nBrand guide:\n${trimmedBrandGuide}`
    : undefined;
};

const getInteractionText = (outputs: Interactions.Step[] | undefined) =>
  (outputs || [])
    .filter((output): output is Interactions.ModelOutputStep => output.type === "model_output")
    .flatMap((output) => output.content || [])
    .filter((content): content is Interactions.TextContent => content.type === "text")
    .map((content) => content.text)
    .join("");

const toInteractionStep = (turn: StudioTurn): Interactions.Step =>
  turn.role === "user"
    ? { type: "user_input", content: turn.content }
    : { type: "model_output", content: turn.content };

export async function runScanAI(
  photo: ScannedPhoto,
  scannedPhotos$: BehaviorSubject<ScannedPhoto[]>,
): Promise<ScanResult | null> {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) return null;

  const shapeIds = shapes.map((s) => s.id);
  const materialIds = materials.map((m) => m.id);
  const mechanismIds = mechanisms.map((m) => m.id);
  const colorNames = colors.map((c) => c.name);

  const schema = {
    type: "object",
    properties: {
      shapes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: shapeIds },
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["id", "name", "description"],
        },
      },
      materials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: materialIds },
            name: { type: "string" },
            visual: { type: "string" },
          },
          required: ["id", "name", "visual"],
        },
      },
      mechanisms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: mechanismIds },
            name: { type: "string" },
            interaction: { type: "string" },
          },
          required: ["id", "name", "interaction"],
        },
      },
      colors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: colorNames },
            hex: { type: "string" },
          },
          required: ["name", "hex"],
        },
      },
    },
    required: ["shapes", "materials", "mechanisms", "colors"],
  };

  const base64Data = photo.fullDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = photo.fullDataUrl.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";

  const ai = new GoogleGenAI({ apiKey });

  const promptText = `Analyze this photo of a product. Ignore any text labels, background elements, hands, and other non-product objects. Focus only on the product itself. Identify the following features from the provided library options ONLY. Pick the closest matches.

Available shapes: ${shapes.map((s) => `${s.id} (${s.name})`).join(", ")}
Available materials: ${materials.map((m) => `${m.id} (${m.name})`).join(", ")}
Available mechanisms: ${mechanisms.map((m) => `${m.id} (${m.name})`).join(", ")}
Available colors: ${colors.map((c) => `${c.name}`).join(", ")}

For each identified feature, return:
- Shape: id, name, and description from library
- Material: id, name, and visual from library
- Mechanism: id, name, and interaction from library
- Color: name and hex from library

Pick only items that are visibly present on the product in the photo. Return empty arrays for categories not found.`;

  try {
    const response = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: [
        {
          type: "user_input",
          content: [
            { type: "image", data: base64Data, mime_type: mimeType },
            { type: "text", text: promptText },
          ],
        },
      ],
      response_format: { type: "text", mime_type: "application/json", schema },
      generation_config: { thinking_level: "low" },
      store: false,
      stream: true,
    });

    const parser = new JSONParser();
    let currentCategory = "";
    const result: ScanResult = { photoId: photo.id, shapes: [], materials: [], mechanisms: [], colors: [] };

    parser.onValue = ({ value, key, stack }) => {
      if (stack.length === 1 && typeof key === "string") {
        currentCategory = key;
      }
      if (stack.length === 2 && typeof key === "number" && value && typeof value === "object") {
        const item = value as Record<string, string>;
        if (currentCategory === "shapes" && item.id) result.shapes.push(item.id);
        else if (currentCategory === "materials" && item.id) result.materials.push(item.id);
        else if (currentCategory === "mechanisms" && item.id) result.mechanisms.push(item.id);
        else if (currentCategory === "colors" && item.name) result.colors.push(item.name);
      }
    };

    for await (const event of response) {
      if (event.event_type === "step.delta" && event.delta.type === "text") parser.write(event.delta.text);
    }

    return result;
  } catch (e) {
    scannedPhotos$.next(
      scannedPhotos$.value.map((p) => (p.id === photo.id ? { ...p, label: "Scan failed", isScanning: false } : p)),
    );
    console.error("Scan failed:", e);
    return null;
  }
}

export interface SynthesizeParams {
  pickedColors: string[];
  pickedMaterials: string[];
  pickedSurfaceOptions: string[];
  pickedMechanisms: string[];
  pickedShapes: string[];
  customInstructions: string;
  brandGuide: string;
  scannedPhotos: ScannedPhoto[];
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  conversationHistory$: BehaviorSubject<StudioTurn[]>;
}

export async function synthesize(params: SynthesizeParams) {
  const {
    pickedColors,
    pickedMaterials,
    pickedSurfaceOptions,
    pickedMechanisms,
    pickedShapes,
    customInstructions,
    brandGuide,
    scannedPhotos,
    synthesisOutput$,
    isSynthesizing$,
    conversationHistory$,
  } = params;

  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const pickedColorData = pickedColors.map((name) => {
    const c = colorsByName.get(name);
    return c ? { name: c.name, hex: c.hex } : { name, hex: "unknown" };
  });
  const pickedMaterialData = pickedMaterials.map((id) => {
    const m = materialsById.get(id);
    return m
      ? { name: m.name, visual: m.visual, surfaceOptions: m.surfaceOptions, colorOptions: m.colorOptions }
      : { name: id };
  });
  const pickedMechanismData = pickedMechanisms.map((id) => {
    const m = mechanismsById.get(id);
    return m ? { name: m.name, interaction: m.interaction } : { name: id };
  });
  const pickedShapeData = pickedShapes.map((id) => {
    const s = shapesById.get(id);
    return s ? { name: s.name, description: s.description } : { name: id };
  });
  const pickedSurfaceOptionData = pickedSurfaceOptions;

  const data = {
    colors: pickedColorData,
    materials: pickedMaterialData,
    surfaceOptions: pickedSurfaceOptionData,
    mechanisms: pickedMechanismData,
    shapes: pickedShapeData,
  };

  const hasSelection =
    pickedColorData.length +
      pickedMaterialData.length +
      pickedSurfaceOptionData.length +
      pickedMechanismData.length +
      pickedShapeData.length >
    0;
  if (!hasSelection) {
    synthesisOutput$.next("Please scan or select components before synthesizing.");
    return;
  }

  const inputJson = JSON.stringify(data, null, 2);
  const custom = customInstructions.trim();
  const photos = scannedPhotos.filter((p) => !p.isScanning);
  const photoNote =
    photos.length > 0
      ? `\n\nNote: The user has scanned ${photos.length} conceptual prototype photo(s). These photos show a rough reference for the product shape, proportion, geometry, and potential interactions. Use the photos only as general visual inspiration. The picked features from the library above are the source of truth for XML generation.`
      : "";
  const userText = `Given the following design selections, generate the scene XML.\n\n${inputJson}${photoNote}${custom ? `\n\nAdditional instructions:\n${custom}` : ""}`;

  const userParts: StudioContent[] = [];
  for (const photo of photos) {
    const base64Data = photo.fullDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = photo.fullDataUrl.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
    userParts.push({ type: "image", data: base64Data, mime_type: mimeType });
  }
  userParts.push({ type: "text", text: userText });

  const userMessage: StudioTurn = { role: "user", content: userParts };

  isSynthesizing$.next(true);
  synthesisOutput$.next("");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: [toInteractionStep(userMessage)],
      system_instruction: getStudioSystemPrompt(brandGuide),
      generation_config: { thinking_level: "minimal" },
      store: false,
      stream: true,
    });

    let accumulated = "";
    for await (const event of response) {
      if (event.event_type === "step.delta" && event.delta.type === "text") {
        accumulated += event.delta.text;
        synthesisOutput$.next(accumulated);
      }
    }

    conversationHistory$.next([userMessage, { role: "model", content: [{ type: "text", text: accumulated }] }]);
  } catch (e) {
    synthesisOutput$.next(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isSynthesizing$.next(false);
  }
}

export interface ReviseParams {
  editInstructions: string;
  brandGuide: string;
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  conversationHistory$: BehaviorSubject<StudioTurn[]>;
  editInstructions$: BehaviorSubject<string>;
}

export async function revise(params: ReviseParams) {
  const { editInstructions, brandGuide, synthesisOutput$, isSynthesizing$, conversationHistory$, editInstructions$ } =
    params;

  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const editText = editInstructions.trim();
  if (!editText) return;

  const history = conversationHistory$.value;
  if (history.length === 0) return;

  const reviseMessage: StudioTurn = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Revise the XML based on these instructions. Output only the updated XML, nothing else.\n\n${editText}`,
      },
    ],
  };
  const contents = [...history, reviseMessage];

  isSynthesizing$.next(true);
  synthesisOutput$.next("");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: contents.map(toInteractionStep),
      system_instruction: getStudioSystemPrompt(brandGuide),
      generation_config: { thinking_level: "minimal" },
      store: false,
      stream: true,
    });

    let accumulated = "";
    for await (const event of response) {
      if (event.event_type === "step.delta" && event.delta.type === "text") {
        accumulated += event.delta.text;
        synthesisOutput$.next(accumulated);
      }
    }

    conversationHistory$.next([...contents, { role: "model", content: [{ type: "text", text: accumulated }] }]);
    editInstructions$.next("");
  } catch (e) {
    synthesisOutput$.next(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isSynthesizing$.next(false);
  }
}

export interface TakePhotoParams {
  synthesisOutput: string;
  photoScene: string;
  brandGuide: string;
  photoGallery$: BehaviorSubject<PhotoCard[]>;
}

export async function takePhoto(params: TakePhotoParams) {
  const { synthesisOutput, photoScene, brandGuide, photoGallery$ } = params;

  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    alert("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const currentXml = synthesisOutput.trim();
  if (!currentXml) {
    alert("Please synthesize XML first before taking a photo.");
    return;
  }

  const scene = photoScene.trim();
  if (!scene) {
    alert("Please specify a photo scene.");
    return;
  }

  const animationPrompt = scene;
  const outputId = `photo-${crypto.randomUUID()}`;
  const currentGallery = photoGallery$.value;
  photoGallery$.next([
    {
      id: outputId,
      scene,
      prompt: "",
      animationPrompt,
      soundDescription: "",
      sourceXml: currentXml,
      isGenerating: true,
    },
    ...currentGallery,
  ]);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const promptText = `${photoStagePrompt}

Current XML:
${currentXml}

Photo scene: ${scene}`;

    const response = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: [{ type: "user_input", content: [{ type: "text", text: promptText }] }],
      system_instruction: getPhotoStageSystemPrompt(brandGuide),
      generation_config: { thinking_level: "minimal" },
      store: false,
    });

    const sceneXml = getInteractionText(response.steps).trim();

    const updatedGallery = photoGallery$.value.map((item) =>
      item.id === outputId ? { ...item, prompt: sceneXml, isGenerating: false } : item,
    );
    photoGallery$.next(updatedGallery);

    generateSoundDescription(ai, sceneXml, animationPrompt, outputId, photoGallery$);
  } catch (e) {
    const updatedGallery = photoGallery$.value.filter((item) => item.id !== outputId);
    photoGallery$.next(updatedGallery);
    alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function generateSoundDescription(
  ai: GoogleGenAI,
  photoXml: string,
  animationPrompt: string,
  photoId: string,
  photoGallery$: BehaviorSubject<PhotoCard[]>,
) {
  try {
    const response = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: `Given the following product scene XML and an animation prompt, generate a short sound description that would accompany this animation. Describe the sounds naturally (e.g., mechanical clicks, liquid pouring, material textures). Output ONLY the sound description text, nothing else.

Scene XML:
${photoXml}

Animation prompt: ${animationPrompt}`,
            },
          ],
        },
      ],
      generation_config: { thinking_level: "minimal" },
      store: false,
    });

    const soundDescription = getInteractionText(response.steps).trim();
    const gallery = photoGallery$.value;
    photoGallery$.next(gallery.map((p) => (p.id === photoId ? { ...p, soundDescription } : p)));
  } catch (e) {
    console.error("Failed to generate sound description:", e);
  }
}

export function deletePhoto(id: string, photoGallery$: BehaviorSubject<PhotoCard[]>) {
  const updatedGallery = photoGallery$.value.filter((item) => item.id !== id);
  photoGallery$.next(updatedGallery);
}

export async function generateAnimation(
  photoId: string,
  instructions: string,
  soundDescription: string,
  photoGallery$: BehaviorSubject<PhotoCard[]>,
) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  photoGallery$.next(
    photoGallery$.value.map((item) =>
      item.id === photoId ? { ...item, animationPrompt: instructions, soundDescription } : item,
    ),
  );

  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    alert("Error: Gemini API key not configured.");
    return;
  }

  const photoElement = document.querySelector(`[data-photo-id="${photoId}"] generative-image`);
  let startFrameUrl = "";

  if (photoElement) {
    const imgElement = photoElement.querySelector("img");
    if (imgElement?.src) {
      startFrameUrl = imgElement.src;
    }
  }

  if (!startFrameUrl) {
    alert(
      "Could not retrieve the source image for animation. Please ensure the image has been generated successfully.",
    );
    return;
  }

  const videoPrompt = soundDescription ? `${instructions} Sound: ${soundDescription}` : instructions;

  const animationId = `animation-${crypto.randomUUID()}`;
  const currentGallery = photoGallery$.value;
  const photoIndex = currentGallery.findIndex((p) => p.id === photoId);

  const animationCard: PhotoCard = {
    id: animationId,
    scene: `Animation: ${photo.scene}`,
    prompt: videoPrompt,
    animationPrompt: instructions,
    soundDescription,
    sourceXml: photo.sourceXml,
    isGenerating: false,
    isVideo: true,
    startFrameUrl,
  };

  const updatedGallery = [...currentGallery.slice(0, photoIndex), animationCard, ...currentGallery.slice(photoIndex)];
  photoGallery$.next(updatedGallery);
}

export async function generateEdit(photoId: string, editedXml: string, photoGallery$: BehaviorSubject<PhotoCard[]>) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const editId = `edit-${crypto.randomUUID()}`;
  const currentGallery = photoGallery$.value;
  const photoIndex = currentGallery.findIndex((p) => p.id === photoId);

  const editCard: PhotoCard = {
    id: editId,
    scene: `Edit: ${photo.scene}`,
    prompt: editedXml,
    animationPrompt: photo.animationPrompt,
    soundDescription: photo.soundDescription,
    sourceXml: editedXml,
    isGenerating: false,
  };

  const updatedGallery = [...currentGallery.slice(0, photoIndex), editCard, ...currentGallery.slice(photoIndex)];
  photoGallery$.next(updatedGallery);
}
