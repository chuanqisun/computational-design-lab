import { GoogleGenAI, Type, type Content } from "@google/genai";
import { JSONParser } from "@streamparser/json";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { loadApiKeys } from "./components/connections/storage";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { colors } from "./components/material-library/colors";
import { materials } from "./components/material-library/materials";
import { mechanisms } from "./components/material-library/mechanisms";
import { shapes } from "./components/material-library/shapes";
import { clearAllPersistence, persistSubject } from "./lib/persistence";
import { createComponent } from "./sdk/create-component";
import "./studio-page.css";

interface PhotoCard {
  id: string;
  scene: string;
  prompt: string;
  animationPrompt: string;
  soundDescription: string;
  sourceXml: string;
  isGenerating: boolean;
  imageReady?: boolean;
  isVideo?: boolean;
  startFrameUrl?: string;
}

interface ScannedPhoto {
  id: string;
  thumbnailUrl: string;
  fullDataUrl: string;
  label: string;
  isScanning: boolean;
}

// Shared state
const pickedColors$ = new BehaviorSubject<string[]>([]);
const pickedMaterials$ = new BehaviorSubject<string[]>([]);
const pickedMechanisms$ = new BehaviorSubject<string[]>([]);
const pickedShapes$ = new BehaviorSubject<string[]>([]);
const filterText$ = new BehaviorSubject<string>("");
const customInstructions$ = new BehaviorSubject<string>("");
const synthesisOutput$ = new BehaviorSubject<string>("");
const isSynthesizing$ = new BehaviorSubject<boolean>(false);
const editInstructions$ = new BehaviorSubject<string>("");
const conversationHistory$ = new BehaviorSubject<Content[]>([]);
const photoScene$ = new BehaviorSubject<string>("Product stand by itself");
const photoGallery$ = new BehaviorSubject<PhotoCard[]>([]);
const scannedPhotos$ = new BehaviorSubject<ScannedPhoto[]>([]);

// Persist state
persistSubject(pickedColors$, "studio:pickedColors");
persistSubject(pickedMaterials$, "studio:pickedMaterials");
persistSubject(pickedMechanisms$, "studio:pickedMechanisms");
persistSubject(pickedShapes$, "studio:pickedShapes");
persistSubject(customInstructions$, "studio:customInstructions");
persistSubject(synthesisOutput$, "studio:synthesisOutput");
persistSubject(editInstructions$, "studio:editInstructions");
persistSubject(photoScene$, "studio:photoScene");
persistSubject(photoGallery$, "studio:photoGallery");

// Register GenerativeImageElement
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

// Register GenerativeVideoElement
GenerativeVideoElement.define(() => ({
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

const toggleItem = (items: string[], item: string): string[] =>
  items.includes(item) ? items.filter((i) => i !== item) : [...items, item];

const colorsByName = new Map(colors.map((c) => [c.name, c]));
const materialsById = new Map(materials.map((m) => [m.id, m]));
const mechanismsById = new Map(mechanisms.map((m) => [m.id, m]));
const shapesById = new Map(shapes.map((s) => [s.id, s]));

const output$ = combineLatest([pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$]).pipe(
  map(([colors, materials, mechanisms, shapes]) => ({ colors, materials, mechanisms, shapes })),
);

const allPills$ = combineLatest([pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$, scannedPhotos$]).pipe(
  map(([colorIds, materialIds, mechanismIds, shapeIds, photos]) => [
    ...photos.map((p) => ({
      label: p.isScanning ? "(scanning...)" : p.label,
      type: "scan" as const,
      id: p.id,
      thumbnailUrl: p.thumbnailUrl,
    })),
    ...colorIds.map((name) => ({ label: name, type: "color" as const, id: name, thumbnailUrl: undefined })),
    ...materialIds.map((id) => ({
      label: materialsById.get(id)?.name || id,
      type: "material" as const,
      id,
      thumbnailUrl: undefined,
    })),
    ...mechanismIds.map((id) => ({
      label: mechanismsById.get(id)?.name || id,
      type: "mechanism" as const,
      id,
      thumbnailUrl: undefined,
    })),
    ...shapeIds.map((id) => ({
      label: shapesById.get(id)?.name || id,
      type: "shape" as const,
      id,
      thumbnailUrl: undefined,
    })),
  ]),
);

const removePill = (type: string, id: string) => {
  if (type === "color") pickedColors$.next(pickedColors$.value.filter((i) => i !== id));
  if (type === "material") pickedMaterials$.next(pickedMaterials$.value.filter((i) => i !== id));
  if (type === "mechanism") pickedMechanisms$.next(pickedMechanisms$.value.filter((i) => i !== id));
  if (type === "shape") pickedShapes$.next(pickedShapes$.value.filter((i) => i !== id));
  if (type === "scan") scannedPhotos$.next(scannedPhotos$.value.filter((p) => p.id !== id));
};

async function captureWebcamPhoto(): Promise<{ thumbnailUrl: string; fullDataUrl: string } | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", "");
    await video.play();
    await new Promise((r) => setTimeout(r, 500));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const fullDataUrl = canvas.toDataURL("image/jpeg", 0.8);

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 32;
    thumbCanvas.height = 32;
    const ctx = thumbCanvas.getContext("2d")!;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 32, 32);
    const thumbnailUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);

    stream.getTracks().forEach((t) => t.stop());
    return { thumbnailUrl, fullDataUrl };
  } catch {
    alert("Could not access webcam.");
    return null;
  }
}

function scanPhotoWithAI(photo: ScannedPhoto) {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) return;

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

  const promptText = `Analyze this photo of a bottle/container product. Identify the following features from the provided library options ONLY. Pick the closest matches.

Available shapes: ${shapes.map((s) => `${s.id} (${s.name})`).join(", ")}
Available materials: ${materials.map((m) => `${m.id} (${m.name})`).join(", ")}
Available mechanisms: ${mechanisms.map((m) => `${m.id} (${m.name})`).join(", ")}
Available colors: ${colors.map((c) => `${c.name}`).join(", ")}

For each identified feature, return:
- Shape: id, name, and description from library
- Material: id, name, and visual from library
- Mechanism: id, name, and interaction from library
- Color: name and hex from library

Pick only items that are visibly present in the photo. Return empty arrays for categories not found.`;

  (async () => {
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
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: promptText },
            ],
          },
        ],
      });

      const parser = new JSONParser();
      let currentCategory = "";

      parser.onValue = ({ value, key, stack }) => {
        // Track which top-level array we're in
        if (stack.length === 1 && typeof key === "string") {
          currentCategory = key;
        }
        // Items inside top-level arrays
        if (stack.length === 2 && typeof key === "number" && value && typeof value === "object") {
          const item = value as Record<string, string>;
          if (currentCategory === "shapes" && item.id) {
            if (!pickedShapes$.value.includes(item.id)) {
              pickedShapes$.next([...pickedShapes$.value, item.id]);
            }
          } else if (currentCategory === "materials" && item.id) {
            if (!pickedMaterials$.value.includes(item.id)) {
              pickedMaterials$.next([...pickedMaterials$.value, item.id]);
            }
          } else if (currentCategory === "mechanisms" && item.id) {
            if (!pickedMechanisms$.value.includes(item.id)) {
              pickedMechanisms$.next([...pickedMechanisms$.value, item.id]);
            }
          } else if (currentCategory === "colors" && item.name) {
            if (!pickedColors$.value.includes(item.name)) {
              pickedColors$.next([...pickedColors$.value, item.name]);
            }
          }
        }
      };

      for await (const chunk of response) {
        const textPart = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textPart) parser.write(textPart);
      }

      // Mark scan complete
      scannedPhotos$.next(
        scannedPhotos$.value.map((p) => (p.id === photo.id ? { ...p, label: "Photo", isScanning: false } : p)),
      );
    } catch (e) {
      scannedPhotos$.next(
        scannedPhotos$.value.map((p) =>
          p.id === photo.id ? { ...p, label: "Scan failed", isScanning: false } : p,
        ),
      );
      console.error("Scan failed:", e);
    }
  })();
}

async function scanFromWebcam() {
  const result = await captureWebcamPhoto();
  if (!result) return;

  const photo: ScannedPhoto = {
    id: `scan-${crypto.randomUUID()}`,
    thumbnailUrl: result.thumbnailUrl,
    fullDataUrl: result.fullDataUrl,
    label: "(scanning...)",
    isScanning: true,
  };

  scannedPhotos$.next([...scannedPhotos$.value, photo]);
  scanPhotoWithAI(photo);
}

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
For picked mechanisms: describe what the mechanism is, but do NOT render it in action.`;

async function synthesize() {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const pickedColorData = pickedColors$.value.map((name) => {
    const c = colorsByName.get(name);
    return c ? { name: c.name, hex: c.hex } : { name, hex: "unknown" };
  });
  const pickedMaterialData = pickedMaterials$.value.map((id) => {
    const m = materialsById.get(id);
    return m
      ? { name: m.name, visual: m.visual, surfaceOptions: m.surfaceOptions, colorOptions: m.colorOptions }
      : { name: id };
  });
  const pickedMechanismData = pickedMechanisms$.value.map((id) => {
    const m = mechanismsById.get(id);
    return m ? { name: m.name, interaction: m.interaction } : { name: id };
  });
  const pickedShapeData = pickedShapes$.value.map((id) => {
    const s = shapesById.get(id);
    return s ? { name: s.name, description: s.description } : { name: id };
  });

  const data = {
    colors: pickedColorData,
    materials: pickedMaterialData,
    mechanisms: pickedMechanismData,
    shapes: pickedShapeData,
  };

  const hasSelection =
    pickedColorData.length + pickedMaterialData.length + pickedMechanismData.length + pickedShapeData.length > 0;
  if (!hasSelection) {
    synthesisOutput$.next("Please select at least one item before synthesizing.");
    return;
  }

  const inputJson = JSON.stringify(data, null, 2);
  const custom = customInstructions$.value.trim();
  const photos = scannedPhotos$.value.filter((p) => !p.isScanning);
  const photoNote = photos.length > 0
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

async function revise() {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const editText = editInstructions$.value.trim();
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

async function takePhoto() {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    alert("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const currentXml = synthesisOutput$.value.trim();
  if (!currentXml) {
    alert("Please synthesize XML first before taking a photo.");
    return;
  }

  const scene = photoScene$.value.trim();
  if (!scene) {
    alert("Please specify a photo scene.");
    return;
  }

  // Use photo booth scene instruction as the animation prompt
  const animationPrompt = scene;

  // Create output card immediately with placeholder
  const outputId = `photo-${crypto.randomUUID()}`;
  const currentGallery = photoGallery$.value;
  photoGallery$.next([
    {
      id: outputId,
      scene,
      prompt: "", // Will be filled in after generation
      animationPrompt,
      soundDescription: "",
      sourceXml: currentXml,
      isGenerating: true,
    },
    ...currentGallery,
  ]);

  // Generate prompt asynchronously
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

    // Update the output card with the generated prompt
    const updatedGallery = photoGallery$.value.map((item) =>
      item.id === outputId ? { ...item, prompt: sceneXml, isGenerating: false } : item,
    );
    photoGallery$.next(updatedGallery);

    // Generate sound description from photo XML + animation prompt
    generateSoundDescription(ai, sceneXml, animationPrompt, outputId);
  } catch (e) {
    // Remove the failed item from gallery
    const updatedGallery = photoGallery$.value.filter((item) => item.id !== outputId);
    photoGallery$.next(updatedGallery);
    alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function deletePhoto(id: string) {
  const updatedGallery = photoGallery$.value.filter((item) => item.id !== id);
  photoGallery$.next(updatedGallery);
}

async function generateSoundDescription(ai: GoogleGenAI, photoXml: string, animationPrompt: string, photoId: string) {
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

function openAnimationDialog(photoId: string) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const dialog = document.getElementById("animation-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  const template = html`
    <div class="dialog-header">
      <h2>Animation Instructions</h2>
      <button commandfor="animation-dialog" command="close">Close</button>
    </div>
    <textarea
      id="animation-instructions"
      placeholder="Enter animation instructions..."
      .value=${photo.animationPrompt}
    ></textarea>
    <textarea
      id="sound-description"
      placeholder="Sound description (generating...)"
      .value=${photo.soundDescription}
    ></textarea>
    <menu>
      <button @click=${() => generateAnimation(photoId, dialog)}>Generate Animation</button>
    </menu>
  `;

  render(template, dialogContent);
  dialog.showModal();
}

async function generateAnimation(photoId: string, dialog: HTMLDialogElement) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const textarea = dialog.querySelector("#animation-instructions") as HTMLTextAreaElement;
  const instructions = textarea?.value.trim() || photo.animationPrompt;

  const soundTextarea = dialog.querySelector("#sound-description") as HTMLTextAreaElement;
  const soundDescription = soundTextarea?.value.trim() || photo.soundDescription;

  if (!instructions) {
    alert("Please provide animation instructions.");
    return;
  }

  dialog.close();

  // Save edited animation prompt and sound description back to the source image
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

  // Get the generated image element to extract its src for the start frame
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

  // Combine animation instructions with sound description for the video prompt
  const videoPrompt = soundDescription ? `${instructions} Sound: ${soundDescription}` : instructions;

  // Create animation video card immediately
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

  // Insert animation card right before the source photo
  const updatedGallery = [...currentGallery.slice(0, photoIndex), animationCard, ...currentGallery.slice(photoIndex)];
  photoGallery$.next(updatedGallery);
}

function openEditDialog(photoId: string) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const dialog = document.getElementById("edit-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  const template = html`
    <div class="dialog-header">
      <h2>Edit XML</h2>
      <button commandfor="edit-dialog" command="close">Close</button>
    </div>
    <textarea
      id="edit-xml-code"
      placeholder="Edit the XML code..."
      .value=${photo.prompt || photo.sourceXml}
    ></textarea>
    <menu>
      <button @click=${() => generateEdit(photoId, dialog)}>Apply Edit</button>
    </menu>
  `;

  render(template, dialogContent);
  dialog.showModal();
}

async function generateEdit(photoId: string, dialog: HTMLDialogElement) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const xmlTextarea = dialog.querySelector("#edit-xml-code") as HTMLTextAreaElement;
  const editedXml = xmlTextarea?.value.trim() || "";

  if (!editedXml) {
    alert("Please provide XML code.");
    return;
  }

  dialog.close();

  // Create edit output card immediately
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

  // Insert edit card right before the source photo
  const updatedGallery = [...currentGallery.slice(0, photoIndex), editCard, ...currentGallery.slice(photoIndex)];
  photoGallery$.next(updatedGallery);
}

const renderOptionList = (
  items: { id: string; name: string; description: string }[],
  pickedIds: string[],
  picked$: BehaviorSubject<string[]>,
) =>
  items.map(
    (item) => html`
      <button
        class="option-item ${pickedIds.includes(item.id) ? "picked" : ""}"
        @click=${() => picked$.next(toggleItem(pickedIds, item.id))}
        title=${item.description}
      >
        <span class="option-name">${item.name}</span>
        <span class="option-description line-clamp-2">${item.description}</span>
      </button>
    `,
  );

// Left panel: filter + accordion categories
const LeftPanel = createComponent(() => {
  const template$ = combineLatest([
    filterText$,
    pickedColors$,
    pickedMaterials$,
    pickedMechanisms$,
    pickedShapes$,
  ]).pipe(
    map(([filter, pickedColorIds, pickedMaterialIds, pickedMechanismIds, pickedShapeIds]) => {
      const lowerFilter = filter.toLowerCase();
      const filteredShapes = shapes.filter((s) => s.name.toLowerCase().includes(lowerFilter));
      const filteredMaterials = materials
        .map((m) => ({ id: m.id, name: m.name, description: m.visual }))
        .filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredMechanisms = mechanisms
        .map((m) => ({ id: m.id, name: m.name, description: m.interaction }))
        .filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredColors = colors.filter((c) => c.name.toLowerCase().includes(lowerFilter));

      return html`
        <div class="filter-box">
          <input
            type="search"
            placeholder="Filter..."
            .value=${filter}
            @input=${(e: Event) => filterText$.next((e.target as HTMLInputElement).value)}
          />
          <button class="scan-btn" @click=${scanFromWebcam}>Scan</button>
        </div>
        <div class="accordion">
          <section class="accordion-section">
            <h2>Shapes</h2>
            <div class="accordion-body">${renderOptionList(filteredShapes, pickedShapeIds, pickedShapes$)}</div>
          </section>
          <section class="accordion-section">
            <h2>Materials</h2>
            <div class="accordion-body">
              ${renderOptionList(filteredMaterials, pickedMaterialIds, pickedMaterials$)}
            </div>
          </section>
          <section class="accordion-section">
            <h2>Mechanisms</h2>
            <div class="accordion-body">
              ${renderOptionList(filteredMechanisms, pickedMechanismIds, pickedMechanisms$)}
            </div>
          </section>
          <section class="accordion-section">
            <h2>Colors</h2>
            <div class="accordion-body color-grid">
              ${filteredColors.map(
                (color) => html`
                  <button
                    class="color-swatch ${pickedColorIds.includes(color.name) ? "picked" : ""}"
                    @click=${() => pickedColors$.next(toggleItem(pickedColorIds, color.name))}
                    title=${color.description}
                  >
                    <span class="swatch-color" style="background-color: ${color.hex}"></span>
                    <span class="swatch-name">${color.name}</span>
                  </button>
                `,
              )}
            </div>
          </section>
        </div>
      `;
    }),
  );
  return template$;
});

// Center panel: pills + JSON + synthesize + revise + photo booth
const CenterPanel = createComponent(() => {
  // Get suggested scenes from picked mechanisms
  const suggestedScenes$ = pickedMechanisms$.pipe(
    map((mechanismIds) => {
      const scenes: string[] = [];
      mechanismIds.forEach((id) => {
        const mechanism = mechanismsById.get(id);
        if (mechanism?.interactionOptions) {
          scenes.push(...mechanism.interactionOptions);
        }
      });
      return Array.from(new Set(scenes)); // Remove duplicates
    }),
  );

  const template$ = combineLatest([
    output$,
    allPills$,
    synthesisOutput$,
    isSynthesizing$,
    customInstructions$,
    editInstructions$,
    conversationHistory$,
    photoScene$,
    suggestedScenes$,
    photoGallery$,
  ]).pipe(
    map(
      ([
        data,
        pills,
        synthesis,
        isSynthesizing,
        customInstr,
        editInstr,
        history,
        photoScene,
        suggestedScenes,
        gallery,
      ]) => html`
        ${pills.length > 0
          ? html`<div class="pills">
              ${pills.map(
                (p) =>
                  html`<button class="pill" @click=${() => removePill(p.type, p.id)}>
                    ${p.thumbnailUrl
                      ? html`<img class="pill-thumbnail" src=${p.thumbnailUrl} alt="" />`
                      : null}${p.label}<span class="pill-remove">×</span>
                  </button>`,
              )}
            </div>`
          : null}
        <section>
          <h2>Selection</h2>
          <pre class="output">${JSON.stringify(data, null, 2)}</pre>
        </section>
        <section>
          <textarea
            placeholder="Custom instructions (optional)..."
            .value=${customInstr}
            @input=${(e: Event) => customInstructions$.next((e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <menu>
            <button @click=${synthesize} ?disabled=${isSynthesizing}>
              ${isSynthesizing ? "Synthesizing..." : "Synthesize"}
            </button>
          </menu>
        </section>
        ${synthesis
          ? html`
              <section>
                <pre class="output">${synthesis}</pre>
              </section>
              <section>
                <textarea
                  placeholder="Edit instructions..."
                  .value=${editInstr}
                  @input=${(e: Event) => editInstructions$.next((e.target as HTMLTextAreaElement).value)}
                ></textarea>
                <menu>
                  <button @click=${revise} ?disabled=${isSynthesizing || !editInstr.trim() || history.length === 0}>
                    ${isSynthesizing ? "Revising..." : "Revise"}
                  </button>
                </menu>
              </section>
              <section>
                <h2>Photo booth</h2>
                <textarea
                  placeholder="Specify photo shoot scene..."
                  .value=${photoScene}
                  @input=${(e: Event) => photoScene$.next((e.target as HTMLTextAreaElement).value)}
                ></textarea>
                ${suggestedScenes.length > 0
                  ? html`
                      <div class="suggested-scenes">
                        <p>Suggested scenes:</p>
                        <div class="scene-buttons">
                          ${suggestedScenes.map(
                            (scene) =>
                              html`<button class="scene-button" @click=${() => photoScene$.next(scene)}>
                                ${scene}
                              </button>`,
                          )}
                        </div>
                      </div>
                    `
                  : null}
                <menu>
                  <button @click=${takePhoto}>Take photo</button>
                </menu>
              </section>
              ${gallery.length > 0
                ? html`
                    <section>
                      <h2>Photo gallery</h2>
                      <div class="output-cards">
                        ${gallery.map(
                          (photo) => html`
                            <div class="output-card" data-photo-id="${photo.id}">
                              <div class="output-card-image">
                                ${photo.isGenerating || !photo.prompt
                                  ? html`<div class="output-placeholder">Generating prompt...</div>`
                                  : photo.isVideo
                                    ? html`
                                        <generative-video
                                          prompt=${photo.prompt}
                                          aspect-ratio="9:16"
                                          model="veo-3.1-generate-preview"
                                          start-frame=${photo.startFrameUrl || ""}
                                        ></generative-video>
                                      `
                                    : html`
                                        <generative-image
                                          prompt=${photo.prompt}
                                          width="540"
                                          height="960"
                                          aspect-ratio="9:16"
                                          model="gemini-2.5-flash-image"
                                        ></generative-image>
                                      `}
                              </div>
                              <div class="output-card-meta">
                                <div class="output-card-caption">${photo.scene}</div>
                                <div class="output-card-actions">
                                  <button class="action-btn" @click=${() => deletePhoto(photo.id)}>Delete</button>
                                  ${!photo.isGenerating && photo.prompt && !photo.isVideo && photo.imageReady
                                    ? html`
                                        <button class="action-btn" @click=${() => openAnimationDialog(photo.id)}>
                                          Animate
                                        </button>
                                        <button class="action-btn" @click=${() => openEditDialog(photo.id)}>
                                          Edit
                                        </button>
                                      `
                                    : null}
                                </div>
                              </div>
                            </div>
                          `,
                        )}
                      </div>
                    </section>
                  `
                : null}
            `
          : null}
      `,
    ),
  );
  return template$;
});

// Main
const Main = createComponent(() => {
  return html`
    <aside class="panel-left">${LeftPanel()}</aside>
    <main class="panel-center">${CenterPanel()}</main>
  `;
});

// Wire up reset button
const resetButton = document.getElementById("reset-button");
if (resetButton) {
  resetButton.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset? All data will be lost.")) return;
    await clearAllPersistence();
    window.location.reload();
  });
}

// Observe generative-image status changes to update imageReady
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "attributes" && mutation.attributeName === "status") {
      const el = mutation.target as HTMLElement;
      if (el.tagName.toLowerCase() !== "generative-image") continue;
      const card = el.closest("[data-photo-id]") as HTMLElement;
      if (!card) continue;
      const photoId = card.dataset.photoId;
      if (!photoId) continue;
      const status = el.getAttribute("status");
      if (status === "success") {
        const gallery = photoGallery$.value;
        const item = gallery.find((p) => p.id === photoId);
        if (item && !item.imageReady) {
          photoGallery$.next(gallery.map((p) => (p.id === photoId ? { ...p, imageReady: true } : p)));
        }
      }
    }
  }
});
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["status"] });

render(Main(), document.getElementById("app")!);
