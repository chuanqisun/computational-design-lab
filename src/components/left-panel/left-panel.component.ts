import { html } from "lit-html";
import type { BehaviorSubject } from "rxjs";
import { combineLatest, map } from "rxjs";
import { colors } from "../material-library/colors";
import { materials } from "../material-library/materials";
import { mechanisms } from "../material-library/mechanisms";
import { shapes } from "../material-library/shapes";
import { createComponent } from "../../sdk/create-component";
import { allSurfaceOptions, materialsById, toggleItem } from "../../lib/studio-utils";
import { openScanDialog, type ScanDialogProps } from "../scan-dialog/scan-dialog.component";
import "./left-panel.component.css";

export interface LeftPanelProps {
  pickedColors$: BehaviorSubject<string[]>;
  pickedMaterials$: BehaviorSubject<string[]>;
  pickedSurfaceOptions$: BehaviorSubject<string[]>;
  pickedMechanisms$: BehaviorSubject<string[]>;
  pickedShapes$: BehaviorSubject<string[]>;
  filterText$: BehaviorSubject<string>;
  scanDialogProps: ScanDialogProps;
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

export const LeftPanelComponent = createComponent((props: LeftPanelProps) => {
  const {
    filterText$, pickedColors$, pickedMaterials$, pickedSurfaceOptions$,
    pickedMechanisms$, pickedShapes$, scanDialogProps,
  } = props;

  const template$ = combineLatest([
    filterText$,
    pickedColors$,
    pickedMaterials$,
    pickedSurfaceOptions$,
    pickedMechanisms$,
    pickedShapes$,
  ]).pipe(
    map(([filter, pickedColorIds, pickedMaterialIds, pickedSurfaceOptionIds, pickedMechanismIds, pickedShapeIds]) => {
      const lowerFilter = filter.toLowerCase();
      const filteredShapes = shapes.filter((s) => s.name.toLowerCase().includes(lowerFilter));
      const filteredMaterials = materials
        .map((m) => ({ id: m.id, name: m.name, description: m.visual }))
        .filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredMechanisms = mechanisms
        .map((m) => ({ id: m.id, name: m.name, description: m.interaction }))
        .filter((m) => m.name.toLowerCase().includes(lowerFilter));
      const filteredColors = colors.filter((c) => c.name.toLowerCase().includes(lowerFilter));
      const filteredSurfaceOptions = allSurfaceOptions.filter((s) => s.toLowerCase().includes(lowerFilter));

      const compatibleSurfaces =
        pickedMaterialIds.length > 0
          ? new Set(pickedMaterialIds.flatMap((id) => materialsById.get(id)?.surfaceOptions ?? []))
          : null;

      return html`
        <div class="filter-box">
          <input
            type="search"
            placeholder="Filter..."
            .value=${filter}
            @input=${(e: Event) => filterText$.next((e.target as HTMLInputElement).value)}
          />
          <button class="scan-btn" @click=${() => openScanDialog(scanDialogProps)}>Scan</button>
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
            <h2>Surface Options</h2>
            <div class="accordion-body">
              ${filteredSurfaceOptions.map(
                (name) => html`
                  <button
                    class="option-item ${pickedSurfaceOptionIds.includes(name) ? "picked" : ""} ${compatibleSurfaces &&
                    !compatibleSurfaces.has(name)
                      ? "dimmed"
                      : ""}"
                    @click=${() => pickedSurfaceOptions$.next(toggleItem(pickedSurfaceOptionIds, name))}
                  >
                    <span class="option-name">${name}</span>
                  </button>
                `,
              )}
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
