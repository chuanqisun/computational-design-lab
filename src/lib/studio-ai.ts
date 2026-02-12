import { GoogleGenAI, Type, type Content } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import type { BehaviorSubject } from "rxjs";
import { loadApiKeys } from "../components/connections/storage";
import { colors } from "../components/material-library/colors";
import { materials } from "../components/material-library/materials";
import { mechanisms } from "../components/material-library/mechanisms";
import { shapes } from "../components/material-library/shapes";
import type { PhotoCard, ScannedPhoto, ScanResult } from "./studio-types";
import { colorsByName, materialsById, mechanismsById, shapesById } from "./studio-utils";

const systemPrompt = `You are a product visualization scene generator. Output valid XML and nothing else. Do not wrap the output in markdown code blocks. Do not include any explanation or commentary.

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
    type: Type.OBJECT,
    properties: {
      shapes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, enum: shapeIds },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["id", "name", "description"],
        },
      },
      materials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, enum: materialIds },
            name: { type: Type.STRING },
            visual: { type: Type.STRING },
          },
          required: ["id", "name", "visual"],
        },
      },
      mechanisms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, enum: mechanismIds },
            name: { type: Type.STRING },
            interaction: { type: Type.STRING },
          },
          required: ["id", "name", "interaction"],
        },
      },
      colors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, enum: colorNames },
            hex: { type: Type.STRING },
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
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 1024 },
      },
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { data: base64Data, mimeType } }, { text: promptText }],
        },
      ],
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

    for await (const chunk of response) {
      const textPart = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textPart) parser.write(textPart);
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
  scannedPhotos: ScannedPhoto[];
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  conversationHistory$: BehaviorSubject<Content[]>;
}

export async function synthesize(params: SynthesizeParams) {
  const {
    pickedColors,
    pickedMaterials,
    pickedSurfaceOptions,
    pickedMechanisms,
    pickedShapes,
    customInstructions,
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

  const userParts: Content["parts"] = [];
  for (const photo of photos) {
    const base64Data = photo.fullDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = photo.fullDataUrl.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
    userParts.push({ inlineData: { data: base64Data, mimeType } });
  }
  userParts.push({ text: userText });

  const userMessage: Content = { role: "user", parts: userParts };

  isSynthesizing$.next(true);
  synthesisOutput$.next("");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: systemPrompt,
      },
      contents: [userMessage],
    });

    let accumulated = "";
    for await (const chunk of response) {
      accumulated += chunk.text ?? "";
      synthesisOutput$.next(accumulated);
    }

    conversationHistory$.next([userMessage, { role: "model", parts: [{ text: accumulated }] }]);
  } catch (e) {
    synthesisOutput$.next(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isSynthesizing$.next(false);
  }
}

export interface ReviseParams {
  editInstructions: string;
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  conversationHistory$: BehaviorSubject<Content[]>;
  editInstructions$: BehaviorSubject<string>;
}

export async function revise(params: ReviseParams) {
  const { editInstructions, synthesisOutput$, isSynthesizing$, conversationHistory$, editInstructions$ } = params;

  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const editText = editInstructions.trim();
  if (!editText) return;

  const history = conversationHistory$.value;
  if (history.length === 0) return;

  const reviseMessage: Content = {
    role: "user",
    parts: [
      { text: `Revise the XML based on these instructions. Output only the updated XML, nothing else.\n\n${editText}` },
    ],
  };
  const contents = [...history, reviseMessage];

  isSynthesizing$.next(true);
  synthesisOutput$.next("");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: systemPrompt,
      },
      contents,
    });

    let accumulated = "";
    for await (const chunk of response) {
      accumulated += chunk.text ?? "";
      synthesisOutput$.next(accumulated);
    }

    conversationHistory$.next([...contents, { role: "model", parts: [{ text: accumulated }] }]);
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
  photoGallery$: BehaviorSubject<PhotoCard[]>;
}

export async function takePhoto(params: TakePhotoParams) {
  const { synthesisOutput, photoScene, photoGallery$ } = params;

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
    const promptText = `Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.

Current XML:
${currentXml}

Photo scene: ${scene}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: "user", parts: [{ text: promptText }] }],
    });

    const sceneXml = response.text?.trim() || "";

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { thinkingConfig: { thinkingBudget: 0 } },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Given the following product scene XML and an animation prompt, generate a short sound description that would accompany this animation. Describe the sounds naturally (e.g., mechanical clicks, liquid pouring, material textures). Output ONLY the sound description text, nothing else.

Scene XML:
${photoXml}

Animation prompt: ${animationPrompt}`,
            },
          ],
        },
      ],
    });

    const soundDescription = response.text?.trim() || "";
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
