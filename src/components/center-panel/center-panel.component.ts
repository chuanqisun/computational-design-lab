import type { Content } from "@google/genai";
import { html } from "lit-html";
import type { BehaviorSubject } from "rxjs";
import { combineLatest, map } from "rxjs";
import { revise, synthesize, takePhoto } from "../../lib/studio-ai";
import type { PhotoCard, ScannedPhoto } from "../../lib/studio-types";
import { materialsById, mechanismsById, shapesById } from "../../lib/studio-utils";
import { createComponent } from "../../sdk/create-component";
import { xmlEditor } from "../../sdk/xml-editor";
import { renderPhotoGallery } from "../photo-gallery/photo-gallery.component";
import "./center-panel.component.css";

export interface CenterPanelProps {
  pickedColors$: BehaviorSubject<string[]>;
  pickedMaterials$: BehaviorSubject<string[]>;
  pickedSurfaceOptions$: BehaviorSubject<string[]>;
  pickedMechanisms$: BehaviorSubject<string[]>;
  pickedShapes$: BehaviorSubject<string[]>;
  customInstructions$: BehaviorSubject<string>;
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  editInstructions$: BehaviorSubject<string>;
  conversationHistory$: BehaviorSubject<Content[]>;
  photoScene$: BehaviorSubject<string>;
  photoGallery$: BehaviorSubject<PhotoCard[]>;
  scannedPhotos$: BehaviorSubject<ScannedPhoto[]>;
}

const removePill = (type: string, id: string, props: CenterPanelProps) => {
  if (type === "color") props.pickedColors$.next(props.pickedColors$.value.filter((i) => i !== id));
  if (type === "material") props.pickedMaterials$.next(props.pickedMaterials$.value.filter((i) => i !== id));
  if (type === "surfaceOption")
    props.pickedSurfaceOptions$.next(props.pickedSurfaceOptions$.value.filter((i) => i !== id));
  if (type === "mechanism") props.pickedMechanisms$.next(props.pickedMechanisms$.value.filter((i) => i !== id));
  if (type === "shape") props.pickedShapes$.next(props.pickedShapes$.value.filter((i) => i !== id));
  if (type === "scan") props.scannedPhotos$.next(props.scannedPhotos$.value.filter((p) => p.id !== id));
};

export const CenterPanelComponent = createComponent((props: CenterPanelProps) => {
  const {
    pickedColors$,
    pickedMaterials$,
    pickedSurfaceOptions$,
    pickedMechanisms$,
    pickedShapes$,
    customInstructions$,
    synthesisOutput$,
    isSynthesizing$,
    editInstructions$,
    conversationHistory$,
    photoScene$,
    photoGallery$,
    scannedPhotos$,
  } = props;

  const output$ = combineLatest([
    pickedColors$,
    pickedMaterials$,
    pickedSurfaceOptions$,
    pickedMechanisms$,
    pickedShapes$,
  ]).pipe(
    map(([colors, materials, surfaceOptions, mechanisms, shapes]) => ({
      colors,
      materials,
      surfaceOptions,
      mechanisms,
      shapes,
    })),
  );

  const allPills$ = combineLatest([
    pickedColors$,
    pickedMaterials$,
    pickedSurfaceOptions$,
    pickedMechanisms$,
    pickedShapes$,
    scannedPhotos$,
  ]).pipe(
    map(([colorIds, materialIds, surfaceOptionIds, mechanismIds, shapeIds, photos]) => [
      ...photos.map((p) => ({
        label: p.isScanning ? "scanning..." : p.label,
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
      ...surfaceOptionIds.map((name) => ({
        label: name,
        type: "surfaceOption" as const,
        id: name,
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

  const suggestedScenes$ = pickedMechanisms$.pipe(
    map((mechanismIds) => {
      const scenes: string[] = [];
      mechanismIds.forEach((id) => {
        const mechanism = mechanismsById.get(id);
        if (mechanism?.interactionOptions) {
          scenes.push(...mechanism.interactionOptions);
        }
      });
      return Array.from(new Set(scenes));
    }),
  );

  const handleSynthesize = () =>
    synthesize({
      pickedColors: pickedColors$.value,
      pickedMaterials: pickedMaterials$.value,
      pickedSurfaceOptions: pickedSurfaceOptions$.value,
      pickedMechanisms: pickedMechanisms$.value,
      pickedShapes: pickedShapes$.value,
      customInstructions: customInstructions$.value,
      scannedPhotos: scannedPhotos$.value,
      synthesisOutput$,
      isSynthesizing$,
      conversationHistory$,
    });

  const handleRevise = () =>
    revise({
      editInstructions: editInstructions$.value,
      synthesisOutput$,
      isSynthesizing$,
      conversationHistory$,
      editInstructions$,
    });

  const handleTakePhoto = () =>
    takePhoto({
      synthesisOutput: synthesisOutput$.value,
      photoScene: photoScene$.value,
      photoGallery$,
    });

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
        _data,
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
                  html`<button class="pill" @click=${() => removePill(p.type, p.id, props)}>
                    ${p.thumbnailUrl
                      ? html`<img class="pill-thumbnail" src=${p.thumbnailUrl} alt="" />`
                      : null}${p.label}<span class="pill-remove">×</span>
                  </button>`,
              )}
            </div>`
          : null}
        <section>
          <textarea
            placeholder="Custom instructions (optional)..."
            .value=${customInstr}
            @input=${(e: Event) => customInstructions$.next((e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <menu>
            <button @click=${handleSynthesize} ?disabled=${isSynthesizing}>
              ${isSynthesizing ? "Synthesizing..." : "Synthesize"}
            </button>
          </menu>
        </section>
        ${synthesis
          ? html`
              <section>${xmlEditor(synthesis, (value: string) => synthesisOutput$.next(value))}</section>
              <section>
                <textarea
                  placeholder="Edit instructions..."
                  .value=${editInstr}
                  @input=${(e: Event) => editInstructions$.next((e.target as HTMLTextAreaElement).value)}
                ></textarea>
                <menu>
                  <button
                    @click=${handleRevise}
                    ?disabled=${isSynthesizing || !editInstr.trim() || history.length === 0}
                  >
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
                          <button class="scene-button" @click=${() => photoScene$.next("Product stand by itself")}>
                            Product stand by itself
                          </button>
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
                  <button @click=${handleTakePhoto}>Take photo</button>
                </menu>
              </section>
              ${renderPhotoGallery(gallery, photoGallery$)}
            `
          : null}
      `,
    ),
  );
  return template$;
});
