import { GoogleGenAI } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { loadApiKeys } from "./components/connections/storage";
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
const synthesisOutput$ = new BehaviorSubject<string>("");
const isSynthesizing$ = new BehaviorSubject<boolean>(false);

const toggleItem = (items: string[], item: string): string[] =>
  items.includes(item) ? items.filter((i) => i !== item) : [...items, item];

const materialsById = new Map(materials.map((m) => [m.id, m]));
const mechanismsById = new Map(mechanisms.map((m) => [m.id, m]));
const shapesById = new Map(shapes.map((s) => [s.id, s]));

const output$ = combineLatest([pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$]).pipe(
  map(([colors, materials, mechanisms, shapes]) => ({ colors, materials, mechanisms, shapes })),
);

// All picked pills combined
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

// Synthesize using Gemini
async function synthesize() {
  const apiKey = loadApiKeys().gemini;
  if (!apiKey) {
    synthesisOutput$.next("Error: Gemini API key not configured. Use Setup to add it.");
    return;
  }

  const data = {
    colors: pickedColors$.value,
    materials: pickedMaterials$.value,
    mechanisms: pickedMechanisms$.value,
    shapes: pickedShapes$.value,
  };

  const hasSelection = data.colors.length + data.materials.length + data.mechanisms.length + data.shapes.length > 0;
  if (!hasSelection) {
    synthesisOutput$.next("Please select at least one item before synthesizing.");
    return;
  }

  const inputJson = JSON.stringify(data, null, 2);

  isSynthesizing$.next(true);
  synthesisOutput$.next("");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-preview",
      config: { thinkingConfig: { thinkingBudget: 0 } },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Given the following design selections, generate a detailed scene description in XML format that describes a product visualization scene. Include elements for lighting, camera, materials, and the product itself.\n\n${inputJson}`,
            },
          ],
        },
      ],
    });

    let accumulated = "";
    for await (const chunk of response) {
      accumulated += chunk.text ?? "";
      synthesisOutput$.next(accumulated);
    }
  } catch (e) {
    synthesisOutput$.next(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isSynthesizing$.next(false);
  }
}

// Left panel component
const LeftPanel = createComponent(() => {
  const template$ = combineLatest([filterText$, pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$, allPills$]).pipe(
    map(([filter, pickedColorIds, pickedMaterialIds, pickedMechanismIds, pickedShapeIds, pills]) => {
      const lowerFilter = filter.toLowerCase();
      const filteredColors = colors.filter((c) => c.name.toLowerCase().includes(lowerFilter));
      const filteredMaterials = materials.filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredMechanisms = mechanisms.filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredShapes = shapes.filter((s) => s.name.toLowerCase().includes(lowerFilter));

      return html`
        <div class="left-panel">
          <div class="filter-box">
            <input type="text" placeholder="Filter items..." .value=${filter} @input=${(e: Event) => filterText$.next((e.target as HTMLInputElement).value)} />
          </div>

          ${pills.length > 0
            ? html`<div class="pills">${pills.map((p) => html`<button class="pill" @click=${() => removePill(p.type, p.id)}>${p.label}<span class="pill-remove">×</span></button>`)}</div>`
            : null}

          ${filteredColors.length > 0
            ? html`
                <div class="picker-section">
                  <h2>Colors</h2>
                  <div class="color-grid">
                    ${filteredColors.map((color) => {
                      const isPicked = pickedColorIds.includes(color.name);
                      return html`<button class="color-swatch ${isPicked ? "picked" : ""}" @click=${() => pickedColors$.next(toggleItem(pickedColorIds, color.name))} title=${color.description}><span class="swatch-color" style="background-color: ${color.hex}"></span><span class="swatch-name">${color.name}</span></button>`;
                    })}
                  </div>
                </div>
              `
            : null}

          ${filteredMaterials.length > 0
            ? html`
                <div class="picker-section">
                  <h2>Materials</h2>
                  <div class="option-list">
                    ${filteredMaterials.map((material) => {
                      const isPicked = pickedMaterialIds.includes(material.id);
                      return html`<button class="option-item ${isPicked ? "picked" : ""}" @click=${() => pickedMaterials$.next(toggleItem(pickedMaterialIds, material.id))}><div class="option-name">${material.name}</div><div class="option-description">${material.visual}</div></button>`;
                    })}
                  </div>
                </div>
              `
            : null}

          ${filteredMechanisms.length > 0
            ? html`
                <div class="picker-section">
                  <h2>Mechanisms</h2>
                  <div class="option-list">
                    ${filteredMechanisms.map((mechanism) => {
                      const isPicked = pickedMechanismIds.includes(mechanism.id);
                      return html`<button class="option-item ${isPicked ? "picked" : ""}" @click=${() => pickedMechanisms$.next(toggleItem(pickedMechanismIds, mechanism.id))}><div class="option-name">${mechanism.name}</div><div class="option-description">${mechanism.interaction}</div></button>`;
                    })}
                  </div>
                </div>
              `
            : null}

          ${filteredShapes.length > 0
            ? html`
                <div class="picker-section">
                  <h2>Shapes</h2>
                  <div class="option-list">
                    ${filteredShapes.map((shape) => {
                      const isPicked = pickedShapeIds.includes(shape.id);
                      return html`<button class="option-item ${isPicked ? "picked" : ""}" @click=${() => pickedShapes$.next(toggleItem(pickedShapeIds, shape.id))}><div class="option-name">${shape.name}</div><div class="option-description">${shape.description}</div></button>`;
                    })}
                  </div>
                </div>
              `
            : null}
        </div>
      `;
    }),
  );
  return template$;
});

// Center panel component
const CenterPanel = createComponent(() => {
  const template$ = combineLatest([output$, synthesisOutput$, isSynthesizing$]).pipe(
    map(([data, synthesis, isSynthesizing]) => html`
      <div class="center-panel">
        <div class="center-section">
          <h2>Selection</h2>
          <pre class="output">${JSON.stringify(data, null, 2)}</pre>
        </div>
        <div class="center-section">
          <menu>
            <button @click=${synthesize} ?disabled=${isSynthesizing}>
              ${isSynthesizing ? "Synthesizing..." : "Synthesize"}
            </button>
          </menu>
          ${synthesis ? html`<pre class="output synthesis-output">${synthesis}</pre>` : null}
        </div>
      </div>
    `),
  );
  return template$;
});

// Right panel component
const RightPanel = createComponent(() => {
  return html`
    <div class="right-panel">
      <h2>Saved</h2>
      <p class="empty-state">No saved items yet</p>
    </div>
  `;
});

// Main component
const Main = createComponent(() => {
  return html`
    <div class="panel panel-left">${LeftPanel()}</div>
    <div class="panel panel-center">${CenterPanel()}</div>
    <div class="panel panel-right">${RightPanel()}</div>
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
    synthesisOutput$.next("");
  });
}

render(Main(), document.getElementById("app")!);
