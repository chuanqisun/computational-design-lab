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
  const template$ = pickedColors$.pipe(
    map((picked) => {
      const toggleColor = (name: string) => {
        const current = pickedColors$.value;
        if (current.includes(name)) {
          pickedColors$.next(current.filter((c) => c !== name));
        } else {
          pickedColors$.next([...current, name]);
        }
      };

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
  const template$ = pickedMaterials$.pipe(
    map((picked) => {
      const toggleMaterial = (id: string) => {
        const current = pickedMaterials$.value;
        if (current.includes(id)) {
          pickedMaterials$.next(current.filter((m) => m !== id));
        } else {
          pickedMaterials$.next([...current, id]);
        }
      };

      return html`
        <div class="picker-section">
          <h3>Materials</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const material = materials.find((m) => m.id === id);
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
  const template$ = pickedMechanisms$.pipe(
    map((picked) => {
      const toggleMechanism = (id: string) => {
        const current = pickedMechanisms$.value;
        if (current.includes(id)) {
          pickedMechanisms$.next(current.filter((m) => m !== id));
        } else {
          pickedMechanisms$.next([...current, id]);
        }
      };

      return html`
        <div class="picker-section">
          <h3>Mechanisms</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const mechanism = mechanisms.find((m) => m.id === id);
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
  const template$ = pickedShapes$.pipe(
    map((picked) => {
      const toggleShape = (id: string) => {
        const current = pickedShapes$.value;
        if (current.includes(id)) {
          pickedShapes$.next(current.filter((s) => s !== id));
        } else {
          pickedShapes$.next([...current, id]);
        }
      };

      return html`
        <div class="picker-section">
          <h3>Shapes</h3>
          ${picked.length > 0
            ? html`
                <div class="pills">
                  ${picked.map((id) => {
                    const shape = shapes.find((s) => s.id === id);
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
