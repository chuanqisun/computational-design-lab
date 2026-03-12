import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest } from "rxjs";
import { persistSubject } from "./lib/persistence";
import {
  buildRenderContext,
  createDefaultSlotValues,
  normalizeSlotValues,
  parseEditableValues,
  playgroundTemplates,
  renderPrompt,
  serializeEditableValues,
} from "./playground-model";
import type {
  PlaygroundImageValue,
  PlaygroundSlotDefinition,
  PlaygroundSlotValue,
  PlaygroundSlotValues,
  PlaygroundTemplateDefinition,
} from "./playground-model";
import { textEditor } from "./sdk/text-editor";
import "./playground-page.css";

interface PlaygroundDraftState {
  selectedTemplateId: string;
  promptTemplatesById: Record<string, string>;
  slotValuesByTemplateId: Record<string, PlaygroundSlotValues>;
  editableValuesById: Record<string, string>;
}

const appElement = document.getElementById("app");

if (!appElement) {
  throw new Error("Playground app root not found.");
}

const cloneSlotValue = (slot: PlaygroundSlotDefinition, value: PlaygroundSlotValue): PlaygroundSlotValue =>
  slot.type === "image" ? { ...(value as PlaygroundImageValue) } : value;

const emptySlotItem = (slot: PlaygroundSlotDefinition): PlaygroundSlotValue =>
  slot.type === "image" ? { dataUrl: "", fileName: "", imageName: "" } : "";

const getTemplateById = (templateId: string) =>
  playgroundTemplates.find((template) => template.id === templateId) ?? playgroundTemplates[0];

const ensureTemplateDraft = (state: PlaygroundDraftState, template: PlaygroundTemplateDefinition): PlaygroundDraftState => {
  const existingSlotValues = state.slotValuesByTemplateId[template.id];
  const slotValues = normalizeSlotValues(template, existingSlotValues ?? createDefaultSlotValues(template));
  const promptTemplate = state.promptTemplatesById[template.id] ?? template.promptTemplate;
  const editableValues = state.editableValuesById[template.id] ?? serializeEditableValues(template, slotValues);
  const slotValuesChanged = JSON.stringify(existingSlotValues) !== JSON.stringify(slotValues);

  if (!slotValuesChanged && state.promptTemplatesById[template.id] === promptTemplate && state.editableValuesById[template.id] === editableValues) {
    return state;
  }

  return {
    ...state,
    promptTemplatesById: { ...state.promptTemplatesById, [template.id]: promptTemplate },
    slotValuesByTemplateId: { ...state.slotValuesByTemplateId, [template.id]: slotValues },
    editableValuesById: { ...state.editableValuesById, [template.id]: editableValues },
  };
};

const reconcileState = (state: PlaygroundDraftState): PlaygroundDraftState => {
  const selectedTemplate = getTemplateById(state.selectedTemplateId);
  return playgroundTemplates.reduce(
    (nextState, template) => ensureTemplateDraft(nextState, template),
    {
      ...state,
      selectedTemplateId: selectedTemplate.id,
    },
  );
};

const createInitialState = (): PlaygroundDraftState =>
  reconcileState({
    selectedTemplateId: playgroundTemplates[0]?.id ?? "",
    promptTemplatesById: {},
    slotValuesByTemplateId: {},
    editableValuesById: {},
  });

const state$ = new BehaviorSubject<PlaygroundDraftState>(createInitialState());
const valuesEditorError$ = new BehaviorSubject<string>("");
const copyStatus$ = new BehaviorSubject<string>("");

persistSubject(state$, "playground:draft").then(() => {
  state$.next(reconcileState(state$.value));
});

const updateState = (updater: (state: PlaygroundDraftState) => PlaygroundDraftState) => {
  state$.next(reconcileState(updater(state$.value)));
};

const updateActiveTemplate = (
  templateStateUpdater: (
    template: PlaygroundTemplateDefinition,
    slotValues: PlaygroundSlotValues,
    state: PlaygroundDraftState,
  ) => PlaygroundDraftState,
) => {
  const currentState = state$.value;
  const template = getTemplateById(currentState.selectedTemplateId);
  const nextState = ensureTemplateDraft(currentState, template);
  const slotValues = nextState.slotValuesByTemplateId[template.id];
  state$.next(reconcileState(templateStateUpdater(template, slotValues, nextState)));
};

const syncSlotValues = (template: PlaygroundTemplateDefinition, slotValues: PlaygroundSlotValues, state: PlaygroundDraftState) => ({
  ...state,
  slotValuesByTemplateId: { ...state.slotValuesByTemplateId, [template.id]: slotValues },
  editableValuesById: {
    ...state.editableValuesById,
    [template.id]: serializeEditableValues(template, slotValues),
  },
});

const moveItem = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
};

const updateSlotItems = (slot: PlaygroundSlotDefinition, updater: (items: PlaygroundSlotValue[]) => PlaygroundSlotValue[]) => {
  updateActiveTemplate((template, slotValues, state) => {
    const nextItems = updater((slotValues[slot.id] ?? [emptySlotItem(slot)]).map((value) => cloneSlotValue(slot, value)));
    const normalizedItems = nextItems.length > 0 ? nextItems : [emptySlotItem(slot)];
    return syncSlotValues(template, { ...slotValues, [slot.id]: normalizedItems }, state);
  });
};

const updateTextSlotValue = (slot: PlaygroundSlotDefinition, index: number, value: string) => {
  updateSlotItems(slot, (items) => items.map((item, itemIndex) => (itemIndex === index ? value : item)));
};

const updateImageSlotValue = (
  slot: PlaygroundSlotDefinition,
  index: number,
  updater: (value: PlaygroundImageValue) => PlaygroundImageValue,
) => {
  updateSlotItems(slot, (items) =>
    items.map((item, itemIndex) =>
      itemIndex === index ? updater({ ...(item as PlaygroundImageValue) }) : item,
    ),
  );
};

const handleEditableValuesChange = (value: string) => {
  updateActiveTemplate((template, slotValues, state) => {
    const parsed = parseEditableValues(template, value);
    if (parsed.error) {
      valuesEditorError$.next(parsed.error);
      return {
        ...state,
        editableValuesById: { ...state.editableValuesById, [template.id]: value },
      };
    }

    valuesEditorError$.next("");
    return {
      ...state,
      editableValuesById: { ...state.editableValuesById, [template.id]: value },
      slotValuesByTemplateId: {
        ...state.slotValuesByTemplateId,
        [template.id]: parsed.values ?? slotValues,
      },
    };
  });
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

const copyPrompt = async (prompt: string) => {
  try {
    await navigator.clipboard.writeText(prompt);
    copyStatus$.next("Prompt copied.");
  } catch {
    copyStatus$.next("Clipboard copy failed.");
  }
};

const getSlotValues = (state: PlaygroundDraftState, template: PlaygroundTemplateDefinition) =>
  state.slotValuesByTemplateId[template.id] ?? createDefaultSlotValues(template);

const getPromptTemplate = (state: PlaygroundDraftState, template: PlaygroundTemplateDefinition) =>
  state.promptTemplatesById[template.id] ?? template.promptTemplate;

const getEditableValues = (state: PlaygroundDraftState, template: PlaygroundTemplateDefinition, slotValues: PlaygroundSlotValues) =>
  state.editableValuesById[template.id] ?? serializeEditableValues(template, slotValues);

const sectionHeader = (title: string, description: string) => html`
  <header class="section-header">
    <h2>${title}</h2>
    <p>${description}</p>
  </header>
`;

const renderSlotControls = (slot: PlaygroundSlotDefinition, values: PlaygroundSlotValue[]) => html`
  <div class="slot-field">
    <div class="slot-label-row">
      <label for=${`slot-${slot.id}-0`}>
        <span>${slot.label}</span>
        ${slot.required ? html`<span class="required-marker">required</span>` : ""}
      </label>
      <small>${slot.helpText}</small>
    </div>

    <div class="slot-items">
      ${values.map((value, index) => {
        const imageValue = value as PlaygroundImageValue;
        return slot.type === "image"
          ? html`
              <div class="slot-item slot-item-image">
                <div class="slot-item-controls">
                  <button type="button" class="small" ?disabled=${index === 0} @click=${() => updateSlotItems(slot, (items) => moveItem(items, index, -1))}>
                    ↑
                  </button>
                  <button
                    type="button"
                    class="small"
                    ?disabled=${index === values.length - 1}
                    @click=${() => updateSlotItems(slot, (items) => moveItem(items, index, 1))}
                  >
                    ↓
                  </button>
                  <button type="button" class="small" @click=${() => updateSlotItems(slot, (items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                    Remove
                  </button>
                </div>

                <label class="slot-subfield">
                  <span>Image file</span>
                  <input
                    id=${`slot-${slot.id}-${index}`}
                    type="file"
                    accept="image/*"
                    @change=${async (event: Event) => {
                      const input = event.currentTarget as HTMLInputElement;
                      const file = input.files?.[0];
                      if (!file) {
                        updateImageSlotValue(slot, index, (item) => ({ ...item, dataUrl: "", fileName: "" }));
                        return;
                      }

                      const dataUrl = await readFileAsDataUrl(file);
                      updateImageSlotValue(slot, index, (item) => ({ ...item, dataUrl, fileName: file.name }));
                    }}
                  />
                </label>

                <label class="slot-subfield">
                  <span>Image name</span>
                  <input
                    type="text"
                    .value=${imageValue.imageName}
                    placeholder=${slot.placeholder}
                    @input=${(event: Event) =>
                      updateImageSlotValue(slot, index, (item) => ({
                        ...item,
                        imageName: (event.currentTarget as HTMLInputElement).value,
                      }))}
                  />
                </label>

                ${(imageValue.fileName || imageValue.dataUrl) &&
                html`
                  <div class="image-meta">
                    <span>${imageValue.fileName || "Stored image"}</span>
                    ${imageValue.dataUrl
                      ? html`<img src=${imageValue.dataUrl} alt=${imageValue.imageName || "Selected reference"} />`
                      : ""}
                  </div>
                `}
              </div>
            `
          : html`
              <div class="slot-item">
                <div class="slot-item-controls">
                  <button type="button" class="small" ?disabled=${index === 0} @click=${() => updateSlotItems(slot, (items) => moveItem(items, index, -1))}>
                    ↑
                  </button>
                  <button
                    type="button"
                    class="small"
                    ?disabled=${index === values.length - 1}
                    @click=${() => updateSlotItems(slot, (items) => moveItem(items, index, 1))}
                  >
                    ↓
                  </button>
                  <button type="button" class="small" @click=${() => updateSlotItems(slot, (items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                    Remove
                  </button>
                </div>

                ${slot.type === "longText"
                  ? html`
                      <textarea
                        id=${`slot-${slot.id}-${index}`}
                        rows="2"
                        .value=${value as string}
                        placeholder=${slot.placeholder}
                        @input=${(event: Event) =>
                          updateTextSlotValue(slot, index, (event.currentTarget as HTMLTextAreaElement).value)}
                      ></textarea>
                    `
                  : html`
                      <input
                        id=${`slot-${slot.id}-${index}`}
                        type="text"
                        .value=${value as string}
                        placeholder=${slot.placeholder}
                        @input=${(event: Event) =>
                          updateTextSlotValue(slot, index, (event.currentTarget as HTMLInputElement).value)}
                      />
                    `}
              </div>
            `;
      })}
    </div>

    ${slot.cardinality === "multiple"
      ? html`
          <button type="button" class="small" @click=${() => updateSlotItems(slot, (items) => [...items, emptySlotItem(slot)])}>
            Add ${slot.type === "image" ? "image" : "item"}
          </button>
        `
      : ""}
  </div>
`;

const view = (state: PlaygroundDraftState, valuesEditorError: string, copyStatus: string) => {
  const template = getTemplateById(state.selectedTemplateId);
  const slotValues = getSlotValues(state, template);
  const promptTemplate = getPromptTemplate(state, template);
  const editableValues = getEditableValues(state, template, slotValues);
  const renderContext = buildRenderContext(template, slotValues);
  const promptOutput = renderPrompt(template, promptTemplate, slotValues);

  return html`
    <main class="playground-page">
      <section class="section">
        ${sectionHeader(
          "Template picker",
          "Choose a starter prompt template, then refine both the template text and the structured values.",
        )}

        <div class="section-body">
          <label class="stacked-field">
            <span>Prompt template</span>
            <select
              .value=${template.id}
              @change=${(event: Event) => {
                valuesEditorError$.next("");
                copyStatus$.next("");
                updateState((currentState) => ({
                  ...currentState,
                  selectedTemplateId: (event.currentTarget as HTMLSelectElement).value,
                }));
              }}
            >
              ${playgroundTemplates.map(
                (item) => html`
                  <option value=${item.id}>${item.title} — ${item.category}</option>
                `,
              )}
            </select>
          </label>

          <div class="template-summary">
            <h3>${template.title}</h3>
            <p>${template.description}</p>
          </div>

          <div class="editor-pane">
            <div class="editor-header">
              <h3>Prompt template editor</h3>
              <p>Uses Mustache syntax such as {{slotName}} with optional sections like {{#slotName}}...{{/slotName}}.</p>
            </div>
            ${textEditor(promptTemplate, (value) =>
              updateActiveTemplate((activeTemplate, slotState, currentState) => ({
                ...currentState,
                promptTemplatesById: { ...currentState.promptTemplatesById, [activeTemplate.id]: value },
                slotValuesByTemplateId: { ...currentState.slotValuesByTemplateId, [activeTemplate.id]: slotState },
              })))}
          </div>
        </div>
      </section>

      <section class="section">
        ${sectionHeader(
          "Slot form",
          "Edit variables in the form or directly in the JSON editor. Both stay synchronized while you work.",
        )}

        <div class="section-body section-grid">
          <div class="slot-form">
            ${template.slots.map((slot) => renderSlotControls(slot, slotValues[slot.id] ?? [emptySlotItem(slot)]))}
          </div>

          <div class="editor-pane">
            <div class="editor-header">
              <h3>Variables editor</h3>
              <p>Mustache reads these values as its rendering context. Single slots accept scalars; multiple slots accept arrays.</p>
            </div>
            ${textEditor(editableValues, handleEditableValuesChange)}
            ${valuesEditorError ? html`<p class="status error">${valuesEditorError}</p>` : ""}
            <details>
              <summary>Current resolved values</summary>
              <pre>${JSON.stringify(renderContext, null, 2)}</pre>
            </details>
          </div>
        </div>
      </section>

      <section class="section">
        ${sectionHeader("Final prompt output", "Copy the generated prompt text into your model of choice.")}

        <div class="section-body output-pane">
          <div class="output-actions">
            <button type="button" @click=${() => copyPrompt(promptOutput)}>Copy prompt</button>
            <button
              type="button"
              @click=${() =>
                updateActiveTemplate((activeTemplate, _slotValues, currentState) => {
                  const resetSlotValues = createDefaultSlotValues(activeTemplate);
                  valuesEditorError$.next("");
                  copyStatus$.next("");
                  return {
                    ...currentState,
                    promptTemplatesById: {
                      ...currentState.promptTemplatesById,
                      [activeTemplate.id]: activeTemplate.promptTemplate,
                    },
                    slotValuesByTemplateId: {
                      ...currentState.slotValuesByTemplateId,
                      [activeTemplate.id]: resetSlotValues,
                    },
                    editableValuesById: {
                      ...currentState.editableValuesById,
                      [activeTemplate.id]: serializeEditableValues(activeTemplate, resetSlotValues),
                    },
                  };
                })}
            >
              Clear current draft
            </button>
          </div>

          ${copyStatus ? html`<p class="status">${copyStatus}</p>` : ""}
          <pre class="prompt-output">${promptOutput}</pre>
        </div>
      </section>
    </main>
  `;
};

combineLatest([state$, valuesEditorError$, copyStatus$]).subscribe(([state, valuesEditorError, copyStatus]) => {
  render(view(state, valuesEditorError, copyStatus), appElement);
});
