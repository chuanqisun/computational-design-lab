import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { colors } from "./components/material-library/colors";
import { materials } from "./components/material-library/materials";
import { mechanisms } from "./components/material-library/mechanisms";
import { shapes } from "./components/material-library/shapes";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";
import "./studio-page.css";

// Shared state for picked items
const pickedColors$ = new BehaviorSubject<string[]>([]);
const pickedMaterials$ = new BehaviorSubject<string[]>([]);
const pickedMechanisms$ = new BehaviorSubject<string[]>([]);
const pickedShapes$ = new BehaviorSubject<string[]>([]);

// Helper function to toggle item in array
const toggleItem = (items: string[], item: string): string[] => {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
};

// Create lookup maps for efficient access
const materialsById = new Map(materials.map((m) => [m.id, m]));
const mechanismsById = new Map(mechanisms.map((m) => [m.id, m]));
const shapesById = new Map(shapes.map((s) => [s.id, s]));

// Combine all picked IDs for output
const output$ = combineLatest([pickedColors$, pickedMaterials$, pickedMechanisms$, pickedShapes$]).pipe(
  map(([colors, materials, mechanisms, shapes]) => ({
    colors,
    materials,
    mechanisms,
    shapes,
  })),
);

// Color picker component
const ColorPicker = createComponent(() => {
  const toggleColor = (name: string) => {
    pickedColors$.next(toggleItem(pickedColors$.value, name));
  };

  const template$ = pickedColors$.pipe(
    map((picked) => {

      return html`
        <div class="picker-section">
          <h3>Colors</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map(
                    (name) => html`
                      <button class="pill" @click=${() => toggleColor(name)}>
                        ${name}
                        <span class="pill-remove">×</span>
                      </button>
                    `,
                  )}
                </div>
              `
            : html`<p class="empty-state">No colors selected</p>`}
          <div class="color-grid">
            ${colors.map((color) => {
              const isPicked = picked.includes(color.name);
              return html`
                <button
                  class="color-swatch ${isPicked ? "picked" : ""}"
                  @click=${() => toggleColor(color.name)}
                  title=${color.description}
                >
                  <span class="swatch-color" style="background-color: ${color.hex}"></span>
                  <span class="swatch-name">${color.name}</span>
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }),
  );
  return template$;
});

// Materials picker component
const MaterialsPicker = createComponent(() => {
  const toggleMaterial = (id: string) => {
    pickedMaterials$.next(toggleItem(pickedMaterials$.value, id));
  };

  const template$ = pickedMaterials$.pipe(
    map((picked) => {

      return html`
        <div class="picker-section">
          <h3>Materials</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const material = materialsById.get(id);
                    return html`
                      <button class="pill" @click=${() => toggleMaterial(id)}>
                        ${material?.name || id}
                        <span class="pill-remove">×</span>
                      </button>
                    `;
                  })}
                </div>
              `
            : html`<p class="empty-state">No materials selected</p>`}
          <div class="option-list">
            ${materials.map((material) => {
              const isPicked = picked.includes(material.id);
              return html`
                <button class="option-item ${isPicked ? "picked" : ""}" @click=${() => toggleMaterial(material.id)}>
                  <div class="option-name">${material.name}</div>
                  <div class="option-description">${material.visual}</div>
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }),
  );
  return template$;
});

// Mechanisms picker component
const MechanismsPicker = createComponent(() => {
  const toggleMechanism = (id: string) => {
    pickedMechanisms$.next(toggleItem(pickedMechanisms$.value, id));
  };

  const template$ = pickedMechanisms$.pipe(
    map((picked) => {

      return html`
        <div class="picker-section">
          <h3>Mechanisms</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const mechanism = mechanismsById.get(id);
                    return html`
                      <button class="pill" @click=${() => toggleMechanism(id)}>
                        ${mechanism?.name || id}
                        <span class="pill-remove">×</span>
                      </button>
                    `;
                  })}
                </div>
              `
            : html`<p class="empty-state">No mechanisms selected</p>`}
          <div class="option-list">
            ${mechanisms.map((mechanism) => {
              const isPicked = picked.includes(mechanism.id);
              return html`
                <button class="option-item ${isPicked ? "picked" : ""}" @click=${() => toggleMechanism(mechanism.id)}>
                  <div class="option-name">${mechanism.name}</div>
                  <div class="option-description">${mechanism.interaction}</div>
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }),
  );
  return template$;
});

// Shapes picker component
const ShapesPicker = createComponent(() => {
  const toggleShape = (id: string) => {
    pickedShapes$.next(toggleItem(pickedShapes$.value, id));
  };

  const template$ = pickedShapes$.pipe(
    map((picked) => {

      return html`
        <div class="picker-section">
          <h3>Shapes</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const shape = shapesById.get(id);
                    return html`
                      <button class="pill" @click=${() => toggleShape(id)}>
                        ${shape?.name || id}
                        <span class="pill-remove">×</span>
                      </button>
                    `;
                  })}
                </div>
              `
            : html`<p class="empty-state">No shapes selected</p>`}
          <div class="option-list">
            ${shapes.map((shape) => {
              const isPicked = picked.includes(shape.id);
              return html`
                <button class="option-item ${isPicked ? "picked" : ""}" @click=${() => toggleShape(shape.id)}>
                  <div class="option-name">${shape.name}</div>
                  <div class="option-description">${shape.description}</div>
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }),
  );
  return template$;
});

// Main component
const Main = createComponent(() => {
  return html`
    <section class="section">${ColorPicker()}</section>
    <section class="section">${MaterialsPicker()}</section>
    <section class="section">${MechanismsPicker()}</section>
    <section class="section">${ShapesPicker()}</section>
    <section class="section">
      <h3>Output</h3>
      <pre class="output">${observe(output$.pipe(map((data) => JSON.stringify(data, null, 2))))}</pre>
    </section>
  `;
});

// Wire up reset button
const resetButton = document.getElementById("reset-components-button");
if (resetButton) {
  resetButton.addEventListener("click", () => {
    pickedColors$.next([]);
    pickedMaterials$.next([]);
    pickedMechanisms$.next([]);
    pickedShapes$.next([]);
  });
}

// Render the app
render(Main(), document.getElementById("app")!);
