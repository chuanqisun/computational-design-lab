import { GoogleGenAI, type Content } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { loadApiKeys } from "./components/connections/storage";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { colors } from "./components/material-library/colors";
import { materials } from "./components/material-library/materials";
import { mechanisms } from "./components/material-library/mechanisms";
import { shapes } from "./components/material-library/shapes";
import { createComponent } from "./sdk/create-component";
import "./studio-page.css";

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
const isGeneratingPhoto$ = new BehaviorSubject<boolean>(false);
const photoGallery$ = new BehaviorSubject<Array<{ imageUrl: string; scene: string; prompt: string }>>([]);

// Register GenerativeImageElement
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
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

const allPills$ = combineLatest([pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$]).pipe(
  map(([colorIds, materialIds, mechanismIds, shapeIds]) => [
    ...colorIds.map((name) => ({ label: name, type: "color" as const, id: name })),
    ...materialIds.map((id) => ({ label: materialsById.get(id)?.name || id, type: "material" as const, id })),
    ...mechanismIds.map((id) => ({ label: mechanismsById.get(id)?.name || id, type: "mechanism" as const, id })),
    ...shapeIds.map((id) => ({ label: shapesById.get(id)?.name || id, type: "shape" as const, id })),
  ]),
);

const removePill = (type: string, id: string) => {
  if (type === "color") pickedColors$.next(pickedColors$.value.filter((i) => i !== id));
  if (type === "material") pickedMaterials$.next(pickedMaterials$.value.filter((i) => i !== id));
  if (type === "mechanism") pickedMechanisms$.next(pickedMechanisms$.value.filter((i) => i !== id));
  if (type === "shape") pickedShapes$.next(pickedShapes$.value.filter((i) => i !== id));
};

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
    return m ? { name: m.name, visual: m.visual, surfaceOptions: m.surfaceOptions, colorOptions: m.colorOptions } : { name: id };
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

  const hasSelection = pickedColorData.length + pickedMaterialData.length + pickedMechanismData.length + pickedShapeData.length > 0;
  if (!hasSelection) {
    synthesisOutput$.next("Please select at least one item before synthesizing.");
    return;
  }

  const inputJson = JSON.stringify(data, null, 2);
  const custom = customInstructions$.value.trim();
  const userText = `Given the following design selections, generate the scene XML.\n\n${inputJson}${custom ? `\n\nAdditional instructions:\n${custom}` : ""}`;

  const userMessage: Content = { role: "user", parts: [{ text: userText }] };

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

    conversationHistory$.next([
      userMessage,
      { role: "model", parts: [{ text: accumulated }] },
    ]);
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

  const reviseMessage: Content = { role: "user", parts: [{ text: `Revise the XML based on these instructions. Output only the updated XML, nothing else.\n\n${editText}` }] };
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

    conversationHistory$.next([
      ...contents,
      { role: "model", parts: [{ text: accumulated }] },
    ]);
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

  isGeneratingPhoto$.next(true);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const promptText = `Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. Output only the updated XML, nothing else.

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
    
    // Create a unique key for this generation
    const timestamp = Date.now();
    const genImage = document.createElement("generative-image");
    genImage.setAttribute("prompt", sceneXml);
    genImage.setAttribute("width", "720");
    genImage.setAttribute("height", "1280");
    genImage.setAttribute("aspect-ratio", "9:16");
    genImage.setAttribute("model", "gemini-2.5-flash-image");
    genImage.setAttribute("data-scene", scene);
    genImage.setAttribute("data-timestamp", timestamp.toString());
    
    // Add to gallery (prepend to show newest first)
    const currentGallery = photoGallery$.value;
    photoGallery$.next([{ imageUrl: "", scene, prompt: sceneXml }, ...currentGallery]);
    
  } catch (e) {
    alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isGeneratingPhoto$.next(false);
  }
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
  const template$ = combineLatest([filterText$, pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$]).pipe(
    map(([filter, pickedColorIds, pickedMaterialIds, pickedMechanismIds, pickedShapeIds]) => {
      const lowerFilter = filter.toLowerCase();
      const filteredShapes = shapes.filter((s) => s.name.toLowerCase().includes(lowerFilter));
      const filteredMaterials = materials.map((m) => ({ id: m.id, name: m.name, description: m.visual })).filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredMechanisms = mechanisms.map((m) => ({ id: m.id, name: m.name, description: m.interaction })).filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredColors = colors.filter((c) => c.name.toLowerCase().includes(lowerFilter));

      return html`
        <div class="filter-box">
          <input
            type="search"
            placeholder="Filter..."
            .value=${filter}
            @input=${(e: Event) => filterText$.next((e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="accordion">
          <section class="accordion-section">
            <h2>Shapes</h2>
            <div class="accordion-body">
              ${renderOptionList(filteredShapes, pickedShapeIds, pickedShapes$)}
            </div>
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
    isGeneratingPhoto$,
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
        isGeneratingPhoto,
        suggestedScenes,
        gallery,
      ]) => html`
        ${pills.length > 0
          ? html`<div class="pills">
              ${pills.map(
                (p) => html`<button class="pill" @click=${() => removePill(p.type, p.id)}>
                  ${p.label}<span class="pill-remove">×</span>
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
                              html`<button class="scene-button" @click=${() => photoScene$.next(scene)}>${scene}</button>`,
                          )}
                        </div>
                      </div>
                    `
                  : null}
                <menu>
                  <button @click=${takePhoto} ?disabled=${isGeneratingPhoto}>
                    ${isGeneratingPhoto ? "Taking photo..." : "Take photo"}
                  </button>
                </menu>
              </section>
              ${gallery.length > 0
                ? html`
                    <section>
                      <h2>Photo gallery</h2>
                      <div class="photo-gallery">
                        ${gallery.map(
                          (photo, index) => html`
                            <div class="photo-item">
                              <generative-image
                                prompt=${photo.prompt}
                                width="720"
                                height="1280"
                                aspect-ratio="9:16"
                                model="gemini-2.5-flash-image"
                              ></generative-image>
                              <div class="photo-caption">${photo.scene}</div>
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
  resetButton.addEventListener("click", () => {
    pickedColors$.next([]);
    pickedMaterials$.next([]);
    pickedMechanisms$.next([]);
    pickedShapes$.next([]);
    filterText$.next("");
    customInstructions$.next("");
    synthesisOutput$.next("");
    editInstructions$.next("");
    conversationHistory$.next([]);
    photoScene$.next("Product stand by itself");
    photoGallery$.next([]);
  });
}

render(Main(), document.getElementById("app")!);
