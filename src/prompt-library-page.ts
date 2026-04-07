import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import "./prompt-library-page.css";
import canvasBlendImagesTemplate from "./prompt-templates/canvas-blend-images";
import canvasCaptionFromImageTemplate from "./prompt-templates/canvas-caption-from-image";
import canvasDesignConceptsTemplate from "./prompt-templates/canvas-design-concepts";
import canvasEnhanceImagePromptTemplate from "./prompt-templates/canvas-enhance-image-prompt";
import canvasFillCardTemplate from "./prompt-templates/canvas-fill-card";
import canvasGenerateImagePromptTemplate from "./prompt-templates/canvas-generate-image-prompt";
import canvasGeneratePersonasTemplate from "./prompt-templates/canvas-generate-personas";
import canvasRankDesignsTemplate from "./prompt-templates/canvas-rank-designs";
import canvasScanConceptsTemplate from "./prompt-templates/canvas-scan-concepts";
import canvasScanMoodsTemplate from "./prompt-templates/canvas-scan-moods";
import canvasScanMoodsSupervisedTemplate from "./prompt-templates/canvas-scan-moods-supervised";
import canvasVisualizeConceptTemplate from "./prompt-templates/canvas-visualize-concept";
import type {
  PromptSlotMetadata,
  PromptTemplateModule,
  PromptTemplatePreset,
} from "./prompt-templates/prompt-template.types";
import studioGenerateSoundDescriptionTemplate from "./prompt-templates/studio-generate-sound-description";
import studioImportCanvasInstructionsTemplate from "./prompt-templates/studio-import-canvas-instructions";
import studioReviseSceneXmlTemplate from "./prompt-templates/studio-revise-scene-xml";
import studioScanProductFeaturesTemplate from "./prompt-templates/studio-scan-product-features";
import studioStagePhotoSceneTemplate from "./prompt-templates/studio-stage-photo-scene";
import studioSynthesizeSceneXmlTemplate from "./prompt-templates/studio-synthesize-scene-xml";

type TemplateRecord = PromptTemplateModule<Record<string, unknown>, string>;
type SlotValue = string | string[] | number | boolean;

interface TemplateItem {
  id: string;
  module: TemplateRecord;
}

const templates: TemplateItem[] = [
  { id: "canvas-generate-image-prompt", module: canvasGenerateImagePromptTemplate as TemplateRecord },
  { id: "canvas-enhance-image-prompt", module: canvasEnhanceImagePromptTemplate as TemplateRecord },
  { id: "canvas-blend-images", module: canvasBlendImagesTemplate as TemplateRecord },
  { id: "canvas-caption-from-image", module: canvasCaptionFromImageTemplate as TemplateRecord },
  { id: "canvas-design-concepts", module: canvasDesignConceptsTemplate as TemplateRecord },
  { id: "canvas-fill-card", module: canvasFillCardTemplate as TemplateRecord },
  { id: "canvas-generate-personas", module: canvasGeneratePersonasTemplate as TemplateRecord },
  { id: "canvas-rank-designs", module: canvasRankDesignsTemplate as TemplateRecord },
  { id: "canvas-scan-concepts", module: canvasScanConceptsTemplate as TemplateRecord },
  { id: "canvas-scan-moods-supervised", module: canvasScanMoodsSupervisedTemplate as TemplateRecord },
  { id: "canvas-scan-moods", module: canvasScanMoodsTemplate as TemplateRecord },
  { id: "canvas-visualize-concept", module: canvasVisualizeConceptTemplate as TemplateRecord },
  { id: "canvas-to-studio-conversion", module: studioImportCanvasInstructionsTemplate as TemplateRecord },
  { id: "studio-scan-product-features", module: studioScanProductFeaturesTemplate as TemplateRecord },
  { id: "studio-synthesize-scene-xml", module: studioSynthesizeSceneXmlTemplate as TemplateRecord },
  { id: "studio-revise-scene-xml", module: studioReviseSceneXmlTemplate as TemplateRecord },
  { id: "studio-generate-sound-description", module: studioGenerateSoundDescriptionTemplate as TemplateRecord },
  { id: "studio-stage-photo-scene", module: studioStagePhotoSceneTemplate as TemplateRecord },
];

const selectedTemplateId$ = new BehaviorSubject<string>(templates[0]?.id ?? "");
const templateValues$ = new BehaviorSubject<Record<string, SlotValue>>({});
const copiedButtons$ = new BehaviorSubject<Record<string, boolean>>({});

const copyResetTimeouts = new Map<string, number>();

function createInitialValues(template: TemplateRecord): Record<string, SlotValue> {
  return buildTemplateValues(template);
}

function buildTemplateValues(
  template: TemplateRecord,
  presetValues: Partial<Record<string, unknown>> = {},
): Record<string, SlotValue> {
  return Object.fromEntries(
    Object.entries(template.metadata.slots).map(([slotName, slot]) => [
      slotName,
      presetValues[slotName] === undefined ? defaultSlotValue(slot) : (presetValues[slotName] as SlotValue),
    ]),
  );
}

function defaultSlotValue(slot: PromptSlotMetadata): SlotValue {
  if (slot.multiple) return [];
  if (slot.type === "number") return 0;
  if (slot.type === "boolean") return false;
  return "";
}

function parseSlotValue(slot: PromptSlotMetadata, rawValue: string | boolean): SlotValue {
  if (slot.type === "boolean") return Boolean(rawValue);
  if (slot.type === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (slot.multiple) {
    return String(rawValue)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(rawValue);
}

function formatSlotValue(value: SlotValue): string {
  if (Array.isArray(value)) return value.join("\n");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
}

function formatOutputSchema(template: TemplateRecord): string {
  if (template.metadata.outputType !== "json" || !template.metadata.outputSchema) return "";
  return JSON.stringify(template.metadata.outputSchema, null, 2);
}

function isTextArea(slot: PromptSlotMetadata): boolean {
  return slot.multiple || slot.type === "xml" || slot.type === "json" || slot.type === "mixed" || slot.type === "text";
}

function isStructuredTextArea(slot: PromptSlotMetadata): boolean {
  return slot.type === "xml" || slot.type === "json" || slot.type === "mixed" || slot.type === "text";
}

function itemInputLabel(slot: PromptSlotMetadata): string {
  if (slot.type === "image") return "Image note";
  if (slot.type === "audio") return "Audio note";
  if (slot.type === "video") return "Video note";
  return "Item";
}

function updateListSlotItem(slotName: string, index: number, nextValue: string) {
  const currentValue = templateValues$.value[slotName];
  const nextItems = Array.isArray(currentValue) ? [...currentValue] : [];
  nextItems[index] = nextValue;
  templateValues$.next({
    ...templateValues$.value,
    [slotName]: nextItems,
  });
}

function addListSlotItem(slotName: string) {
  const currentValue = templateValues$.value[slotName];
  const nextItems = Array.isArray(currentValue) ? [...currentValue, ""] : [""];
  templateValues$.next({
    ...templateValues$.value,
    [slotName]: nextItems,
  });
}

function removeListSlotItem(slotName: string, index: number) {
  const currentValue = templateValues$.value[slotName];
  const nextItems = Array.isArray(currentValue) ? currentValue.filter((_, itemIndex) => itemIndex !== index) : [];
  templateValues$.next({
    ...templateValues$.value,
    [slotName]: nextItems,
  });
}

function updateSelectedTemplate(templateId: string) {
  const template = templates.find((item) => item.id === templateId);
  if (!template) return;
  selectedTemplateId$.next(templateId);
  templateValues$.next(createInitialValues(template.module));
  copiedButtons$.next({});
}

function applyPreset(templateId: string, preset: PromptTemplatePreset<Record<string, unknown>>) {
  const template = templates.find((item) => item.id === templateId);
  if (!template) return;
  selectedTemplateId$.next(templateId);
  templateValues$.next(buildTemplateValues(template.module, preset.values));
  copiedButtons$.next({});
}

function updateSlotValue(slotName: string, slot: PromptSlotMetadata, rawValue: string | boolean) {
  templateValues$.next({
    ...templateValues$.value,
    [slotName]: parseSlotValue(slot, rawValue),
  });
}

function setCopyButtonState(buttonId: string, isCopied: boolean) {
  copiedButtons$.next({
    ...copiedButtons$.value,
    [buttonId]: isCopied,
  });
}

function resetCopyButton(buttonId: string) {
  const timeout = copyResetTimeouts.get(buttonId);
  if (timeout !== undefined) {
    window.clearTimeout(timeout);
    copyResetTimeouts.delete(buttonId);
  }
  setCopyButtonState(buttonId, false);
}

async function copyPreview(buttonId: string, previewText: string) {
  try {
    await navigator.clipboard.writeText(previewText);
    resetCopyButton(buttonId);
    setCopyButtonState(buttonId, true);
    const timeout = window.setTimeout(() => {
      setCopyButtonState(buttonId, false);
      copyResetTimeouts.delete(buttonId);
    }, 2000);
    copyResetTimeouts.set(buttonId, timeout);
  } catch {
    resetCopyButton(buttonId);
  }
}

selectedTemplateId$.subscribe((templateId) => {
  if (Object.keys(templateValues$.value).length > 0) return;
  const template = templates.find((item) => item.id === templateId);
  if (!template) return;
  templateValues$.next(createInitialValues(template.module));
});

const app$ = combineLatest([selectedTemplateId$, templateValues$, copiedButtons$]).pipe(
  map(([selectedTemplateId, templateValues, copiedButtons]) => {
    const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? templates[0];
    if (!selectedTemplate) {
      return html`<main class="empty-state"><p>No prompt templates found.</p></main>`;
    }

    const renderedPrompt = selectedTemplate.module.template(templateValues);
    const outputSchema = formatOutputSchema(selectedTemplate.module);
    const slotEntries = Object.entries(selectedTemplate.module.metadata.slots);
    const presets = selectedTemplate.module.presets ?? [];

    return html`
      <main class="prompt-library-page">
        <aside class="panel panel-list">
          <header class="section-header">
            <h1>Prompt Library</h1>
          </header>
          <div class="template-list" role="list">
            ${repeat(
              templates,
              (template) => template.id,
              (template) => {
                const isActive = template.id === selectedTemplateId;
                return html`
                  <button
                    class="template-item ${isActive ? "is-active" : ""}"
                    @click=${() => updateSelectedTemplate(template.id)}
                  >
                    <span class="template-item__title">${template.module.metadata.title}</span>
                  </button>
                `;
              },
            )}
          </div>
        </aside>

        <section class="panel panel-form">
          <section class="section-block section-block--presets">
            <header class="section-block__header">
              <h3>Purpose</h3>
            </header>
            <p class="section-copy">${selectedTemplate.module.metadata.purpose}</p>
          </section>

          <section class="section-block section-block--presets">
            <header class="section-block__header">
              <h3>Presets</h3>
            </header>
            <div class="preset-row" role="list">
              ${repeat(
                presets,
                (preset) => preset.title,
                (preset) => html`
                  <button class="preset-item" @click=${() => applyPreset(selectedTemplate.id, preset)}>
                    <span class="preset-item__title">${preset.title}</span>
                    <span class="preset-item__description">${preset.description || ""}</span>
                  </button>
                `,
              )}
            </div>
          </section>

          <section class="section-block section-block--input">
            <div class="field-list">
              ${repeat(
                slotEntries,
                ([slotName]) => slotName,
                ([slotName, slot]) => html`
                  <label class="field">
                    <span class="field__label-row">
                      <span class="field__name">${slotName}</span>
                      <span class="field__meta"
                        >${slot.multiple ? "LIST" : ""}${slot.required ? " · REQUIRED" : ""}</span
                      >
                    </span>
                    <span class="field__description">${slot.description}</span>
                    ${slot.type === "image"
                      ? html`
                          <div class="attachment-note" role="note">
                            <p>This prompt expects an image attachment outside this form.</p>
                            <p>Add the image separately in the chat or tool where you use the prompt.</p>
                          </div>
                          ${slot.multiple
                            ? html`
                                <div class="list-field">
                                  <div class="list-field__items">
                                    ${repeat(
                                      Array.isArray(templateValues[slotName])
                                        ? (templateValues[slotName] as string[])
                                        : [],
                                      (_, index) => `${slotName}-${index}`,
                                      (item, index) => html`
                                        <div class="list-field__item">
                                          <input
                                            type="text"
                                            placeholder="Describe the image you will attach separately"
                                            .value=${item}
                                            @input=${(event: Event) =>
                                              updateListSlotItem(
                                                slotName,
                                                index,
                                                (event.currentTarget as HTMLInputElement).value,
                                              )}
                                          />
                                          <button type="button" @click=${() => removeListSlotItem(slotName, index)}>
                                            Remove
                                          </button>
                                        </div>
                                      `,
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    class="list-field__add"
                                    @click=${() => addListSlotItem(slotName)}
                                  >
                                    Add image reference
                                  </button>
                                </div>
                              `
                            : html`<input
                                type="text"
                                placeholder="Optional note about the image you will attach separately"
                                .value=${formatSlotValue(templateValues[slotName] ?? defaultSlotValue(slot))}
                                @input=${(event: Event) =>
                                  updateSlotValue(slotName, slot, (event.currentTarget as HTMLInputElement).value)}
                              />`}
                        `
                      : slot.type === "boolean"
                        ? html`<input
                            type="checkbox"
                            .checked=${Boolean(templateValues[slotName])}
                            @change=${(event: Event) =>
                              updateSlotValue(slotName, slot, (event.currentTarget as HTMLInputElement).checked)}
                          />`
                        : slot.multiple
                          ? html`
                              <div class="list-field">
                                <div class="list-field__items">
                                  ${repeat(
                                    Array.isArray(templateValues[slotName])
                                      ? (templateValues[slotName] as string[])
                                      : [],
                                    (_, index) => `${slotName}-${index}`,
                                    (item, index) => html`
                                      <div class="list-field__item">
                                        ${isStructuredTextArea(slot)
                                          ? html`<textarea
                                              rows=${Math.max(2, slot.type === "xml" || slot.type === "json" ? 8 : 4)}
                                              placeholder=${`${itemInputLabel(slot)} ${index + 1}`}
                                              .value=${item}
                                              @input=${(event: Event) =>
                                                updateListSlotItem(
                                                  slotName,
                                                  index,
                                                  (event.currentTarget as HTMLTextAreaElement).value,
                                                )}
                                            ></textarea>`
                                          : html`<input
                                              type=${slot.type === "number" ? "number" : "text"}
                                              placeholder=${`${itemInputLabel(slot)} ${index + 1}`}
                                              .value=${item}
                                              @input=${(event: Event) =>
                                                updateListSlotItem(
                                                  slotName,
                                                  index,
                                                  (event.currentTarget as HTMLInputElement).value,
                                                )}
                                            />`}
                                        <button type="button" @click=${() => removeListSlotItem(slotName, index)}>
                                          Remove
                                        </button>
                                      </div>
                                    `,
                                  )}
                                </div>
                                <button type="button" class="list-field__add" @click=${() => addListSlotItem(slotName)}>
                                  Add item
                                </button>
                              </div>
                            `
                          : isTextArea(slot)
                            ? html`<textarea
                                rows=${Math.max(
                                  2,
                                  slot.multiple || slot.type === "xml" || slot.type === "json" ? 8 : 4,
                                )}
                                .value=${formatSlotValue(templateValues[slotName] ?? defaultSlotValue(slot))}
                                @input=${(event: Event) =>
                                  updateSlotValue(slotName, slot, (event.currentTarget as HTMLTextAreaElement).value)}
                              ></textarea>`
                            : html`<input
                                type=${slot.type === "number" ? "number" : "text"}
                                .value=${formatSlotValue(templateValues[slotName] ?? defaultSlotValue(slot))}
                                @input=${(event: Event) =>
                                  updateSlotValue(slotName, slot, (event.currentTarget as HTMLInputElement).value)}
                              />`}
                  </label>
                `,
              )}
            </div>
          </section>
        </section>

        <section class="panel panel-output">
          <section class="section-block section-block--output">
            <div class="prompt-preview">
              ${renderedPrompt.system
                ? html`
                    <section class="prompt-block">
                      <header class="prompt-block__header">
                        <span>System</span>
                        <button
                          @mousedown=${() => resetCopyButton("system")}
                          @click=${() => copyPreview("system", renderedPrompt.system || "")}
                        >
                          ${copiedButtons.system ? "Copied" : "Copy"}
                        </button>
                      </header>
                      <pre>${renderedPrompt.system}</pre>
                    </section>
                  `
                : ""}
              ${renderedPrompt.developer
                ? html`
                    <section class="prompt-block">
                      <header class="prompt-block__header">
                        <span>Developer</span>
                        <button
                          @mousedown=${() => resetCopyButton("developer")}
                          @click=${() => copyPreview("developer", renderedPrompt.developer || "")}
                        >
                          ${copiedButtons.developer ? "Copied" : "Copy"}
                        </button>
                      </header>
                      <pre>${renderedPrompt.developer}</pre>
                    </section>
                  `
                : ""}
              <section class="prompt-block">
                <header class="prompt-block__header">
                  <span>User</span>
                  <button
                    @mousedown=${() => resetCopyButton("user")}
                    @click=${() => copyPreview("user", renderedPrompt.user)}
                  >
                    ${copiedButtons.user ? "Copied" : "Copy"}
                  </button>
                </header>
                <pre>${renderedPrompt.user}</pre>
              </section>
              ${outputSchema
                ? html`
                    <section class="prompt-block">
                      <header class="prompt-block__header">
                        <span>Output schema</span>
                      </header>
                      <pre>${outputSchema}</pre>
                    </section>
                  `
                : ""}
            </div>
          </section>
        </section>
      </main>
    `;
  }),
);

app$.subscribe((template) => {
  render(template, document.getElementById("app")!);
});
