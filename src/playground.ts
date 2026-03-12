import { GoogleGenAI, type Content } from "@google/genai";
import { html, nothing, render } from "lit-html";
import { BehaviorSubject, combineLatest } from "rxjs";
import { map } from "rxjs/operators";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { generateImage } from "./components/design/generate-image-gemini";
import { colors } from "./components/material-library/colors";
import { materials } from "./components/material-library/materials";
import { genericInteractionOptions, mechanisms } from "./components/material-library/mechanisms";
import { shapes } from "./components/material-library/shapes";
import {
  addCards,
  buildTaskStatus,
  clearSelection,
  cloneCardsForTask,
  createAttributeCard,
  createImageCard,
  createPlaygroundSession,
  createPromptCard,
  createReferenceCard,
  createTask,
  createTextCard,
  deleteSelectedCards,
  ensureSession,
  getInspectableCard,
  getSelectedCards,
  getTaskDefinition,
  handoffSelectedCards,
  moveCard,
  taskDefinitions,
  updateTask,
  withSelection,
  type AttributeGroup,
  type PendingImport,
  type PlaygroundCard,
  type PlaygroundSession,
  type PlaygroundTask,
  type SerializableContent,
  type TaskTypeId,
} from "./lib/playground-model";
import { persistSubject } from "./lib/persistence";
import { revise, runScanAI, synthesize } from "./lib/studio-ai";
import { allSurfaceOptions, materialsById, mechanismsById, shapesById } from "./lib/studio-utils";
import type { ScannedPhoto } from "./lib/studio-types";
import "./components/connections/connections.component.css";
import "./playground.css";

const PLAYGROUND_STORAGE_KEY = "playground:session";
const appRoot = document.getElementById("app") as HTMLElement;
const taskHubDialog = document.getElementById("task-hub-dialog") as HTMLDialogElement;
const taskHubDialogContent = taskHubDialog.querySelector(".dialog-content") as HTMLElement;
const setupDialog = document.getElementById("setup-dialog") as HTMLDialogElement;
const setupDialogContent = setupDialog.querySelector(".dialog-content") as HTMLElement;

interface ToastState {
  message: string;
  tone: "info" | "error";
}

interface UiState {
  taskHubOpen: boolean;
  hubSeedSourceTaskId?: string;
  toast?: ToastState;
  dragCardId?: string;
}

const session$ = new BehaviorSubject<PlaygroundSession>(createPlaygroundSession());
const ui$ = new BehaviorSubject<UiState>({ taskHubOpen: false });
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

let toastTimer: number | undefined;

const now = () => new Date().toISOString();
const createId = () => crypto.randomUUID();
const formatTime = (value: string) => new Date(value).toLocaleString();
const colorByName = new Map(colors.map((color) => [color.name, color]));

persistSubject(session$, PLAYGROUND_STORAGE_KEY).then(() => {
  session$.next(ensureSession(session$.value));
  if (!session$.value.tasks.length) {
    openTaskHub();
  }
});

setupDialogContent.classList.add("setup-form");
render(ConnectionsComponent({ apiKeys$ }), setupDialogContent);

const view$ = combineLatest([session$, ui$]).pipe(
  map(([session, ui]) => {
    const activeTask = session.tasks.find((task) => task.id === session.activeTaskId);
    return html`
      <div class="playground">
        <header class="playground-shell-header">
          <div>
            <h1>Computational Design Lab Playground</h1>
            <p>Task-centric packaging prompt builder and runner.</p>
          </div>
          <div class="shell-actions">
            <button @click=${() => openTaskHub()}>Tasks</button>
            <button @click=${() => openTaskHub()}>New task</button>
            <button @click=${() => setupDialog.showModal()}>Setup</button>
          </div>
        </header>

        ${ui.toast ? html`<div class="toast ${ui.toast.tone}">${ui.toast.message}</div>` : nothing}

        ${activeTask ? renderTaskView(activeTask) : renderEmptyState()}
      </div>
    `;
  }),
);

view$.subscribe((template) => {
  render(template, appRoot);
  renderTaskHub();
  syncDialogs();
});

window.addEventListener("paste", (event) => {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  event.preventDefault();
  void appendPendingImports(activeTask.id, files, "clipboard");
});

taskHubDialog.addEventListener("close", () => {
  ui$.next({ ...ui$.value, taskHubOpen: false, hubSeedSourceTaskId: undefined });
});

function renderEmptyState() {
  return html`
    <main class="task-empty-state">
      <p>No task is active yet.</p>
      <button @click=${() => openTaskHub()}>Choose a task</button>
    </main>
  `;
}

function renderTaskView(task: PlaygroundTask) {
  const definition = getTaskDefinition(task.taskTypeId);
  const inspectableCard = getInspectableCard(task);
  const selectedCards = getSelectedCards(task);
  const generatedCards = task.cards.filter((card) => ["prompt", "scene", "image"].includes(card.category));
  const suggestedScenes = getSuggestedScenes(task);
  const compatibleSurfaceOptions = getCompatibleSurfaceOptions(task);

  return html`
    <main class="task-page">
      <section class="task-section task-header-section">
        <div class="task-header-row">
          <div>
            <div class="eyebrow">${definition.taskClass} task</div>
            <input
              class="task-title-input"
              .value=${task.title}
              @input=${(event: Event) => {
                const value = (event.target as HTMLInputElement).value;
                patchTask(task.id, (current) => ({ ...current, title: value }));
              }}
            />
            <p>${definition.description}</p>
          </div>
          <div class="task-meta">
            <div><strong>Type</strong><span>${definition.title}</span></div>
            <div><strong>Status</strong><span>${buildTaskStatus(task)}</span></div>
            <div><strong>Updated</strong><span>${formatTime(task.updatedAt)}</span></div>
          </div>
        </div>
      </section>

      <section class="task-section">
        <div class="section-header">
          <h2>Input area</h2>
        </div>
        ${renderInputArea(task, compatibleSurfaceOptions, suggestedScenes)}
      </section>

      <section class="task-section">
        <div class="section-header">
          <h2>Card collection</h2>
          <div class="section-actions">
            <button @click=${() => patchTask(task.id, clearSelection)} ?disabled=${task.selectedCardIds.length === 0}>
              Clear selection
            </button>
            <button @click=${() => patchTask(task.id, deleteSelectedCards)} ?disabled=${task.selectedCardIds.length === 0}>
              Delete selected
            </button>
          </div>
        </div>
        <div class="selection-summary">
          ${task.selectedCardIds.length > 0
            ? `${task.selectedCardIds.length} card${task.selectedCardIds.length === 1 ? "" : "s"} selected`
            : "Click a card to inspect it. Use Ctrl/Cmd-click to multi-select. Drag cards to reorder."}
        </div>
        <div class="card-board" @click=${(event: Event) => event.target === event.currentTarget && patchTask(task.id, clearSelection)}>
          ${task.cards.length > 0
            ? task.cards.map((card) => renderBoardCard(task, card))
            : html`<p class="empty-state">No cards in this task yet.</p>`}
        </div>
      </section>

      <section class="task-section">
        <div class="section-header">
          <h2>Generated outputs</h2>
        </div>
        ${generatedCards.length > 0
          ? html`<div class="generated-output-list">${generatedCards.map((card) => renderGeneratedOutputCard(task, card))}</div>`
          : html`<p class="empty-state">Prompt cards, scene cards, and image cards will appear here.</p>`}
      </section>

      <section class="task-section">
        <div class="section-header">
          <h2>Prompt and artifact inspection</h2>
          ${inspectableCard?.artifact || inspectableCard?.imagePrompt
            ? html`<button @click=${() => copyText((inspectableCard?.artifact || inspectableCard?.imagePrompt) ?? "")}>Copy</button>`
            : nothing}
        </div>
        ${inspectableCard ? renderInspectableCard(inspectableCard) : html`<p class="empty-state">Select a card to inspect it.</p>`}
      </section>

      <section class="task-section">
        <div class="section-header">
          <h2>Reusable actions</h2>
        </div>
        <div class="action-group">
          <button @click=${() => openTaskHub()}>Open task hub</button>
          <button
            @click=${() => {
              if (!selectedCards.length) {
                showToast("Select one or more cards before handing them off.", "error");
                return;
              }
              openTaskHub(task.id);
            }}
          >
            Hand off selected cards
          </button>
          <button @click=${() => setupDialog.showModal()}>Manage API connections</button>
        </div>
      </section>
    </main>
  `;
}

function renderInputArea(task: PlaygroundTask, compatibleSurfaceOptions: Set<string> | null, suggestedScenes: string[]) {
  switch (task.taskTypeId) {
    case "capture-reference":
    case "scan-photos":
      return renderImportArea(task, task.taskTypeId === "scan-photos");
    case "write-text":
      return renderTextArea(task);
    case "attribute-library":
      return renderAttributeLibrary(task, compatibleSurfaceOptions);
    case "synthesize-prompt":
      return renderSynthesisArea(task);
    case "revise-prompt":
      return renderRevisionArea(task);
    case "stage-scenes":
      return renderSceneArea(task, suggestedScenes);
    case "generate-images":
      return renderImageGenerationArea(task);
    case "organize-curate":
      return html`<p class="section-note">Use this task to select, inspect, reorder, delete, and hand off cards.</p>`;
    default:
      return nothing;
  }
}

function renderImportArea(task: PlaygroundTask, includeScanAction: boolean) {
  return html`
    <div class="import-actions">
      <label>
        <span>Upload files</span>
        <input
          type="file"
          accept="image/*"
          multiple
          @change=${(event: Event) => {
            const input = event.target as HTMLInputElement;
            const files = Array.from(input.files ?? []);
            if (files.length > 0) {
              void appendPendingImports(task.id, files, "upload");
            }
            input.value = "";
          }}
        />
      </label>
      <label>
        <span>Camera capture</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          @change=${(event: Event) => {
            const input = event.target as HTMLInputElement;
            const files = Array.from(input.files ?? []);
            if (files.length > 0) {
              void appendPendingImports(task.id, files, "camera");
            }
            input.value = "";
          }}
        />
      </label>
      <div class="paste-hint">Paste images from the clipboard anywhere on the page.</div>
    </div>

    ${task.ui.pendingImports.length > 0
      ? html`
          <div class="pending-grid">
            ${task.ui.pendingImports.map(
              (item) => html`
                <article class="pending-card">
                  <img src=${item.image} alt=${item.title} />
                  <div>
                    <strong>${item.title}</strong>
                    <small>${item.source}</small>
                  </div>
                  <button @click=${() => removePendingImport(task.id, item.id)}>Remove</button>
                </article>
              `,
            )}
          </div>
        `
      : html`<p class="section-note">Imported images stay pending until you commit them into the task.</p>`}

    <div class="action-group">
      <button @click=${() => commitPendingImports(task.id)} ?disabled=${task.ui.pendingImports.length === 0}>Commit imports</button>
      ${includeScanAction
        ? html`
            <button @click=${() => void scanReferenceCards(task.id)}>
              Scan selected references
            </button>
          `
        : nothing}
    </div>
  `;
}

function renderTextArea(task: PlaygroundTask) {
  return html`
    <textarea
      placeholder="Write inspiration, intent, or product notes in English..."
      .value=${task.ui.draftText}
      @input=${(event: Event) => {
        const value = (event.target as HTMLTextAreaElement).value;
        patchTask(task.id, (current) => ({ ...current, ui: { ...current.ui, draftText: value } }));
      }}
    ></textarea>
    <div class="action-group">
      <button @click=${() => addTextCard(task.id)} ?disabled=${!task.ui.draftText.trim()}>Add text card</button>
    </div>
  `;
}

function renderAttributeLibrary(task: PlaygroundTask, compatibleSurfaceOptions: Set<string> | null) {
  const filter = task.ui.libraryFilter.trim().toLowerCase();
  const selectedMaterials = getAttributeValues(task, "material");
  const shapeItems = shapes.filter((item) => includesFilter([item.name, item.description], filter));
  const materialItems = materials.filter((item) => includesFilter([item.name, item.visual], filter));
  const mechanismItems = mechanisms.filter((item) => includesFilter([item.name, item.interaction], filter));
  const colorItems = colors.filter((item) => includesFilter([item.name, item.description], filter));
  const surfaceItems = allSurfaceOptions.filter((item) => includesFilter([item], filter));

  return html`
    <input
      type="search"
      placeholder="Filter the attribute library"
      .value=${task.ui.libraryFilter}
      @input=${(event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        patchTask(task.id, (current) => ({ ...current, ui: { ...current.ui, libraryFilter: value } }));
      }}
    />
    <p class="section-note">
      Material selections currently imply ${compatibleSurfaceOptions ? compatibleSurfaceOptions.size : allSurfaceOptions.length} visible
      surface option${compatibleSurfaceOptions && compatibleSurfaceOptions.size === 1 ? "" : "s"}.
      ${selectedMaterials.length > 0 ? "Incompatible surfaces are dimmed rather than hidden." : "Select a material to see compatibility hints."}
    </p>
    <div class="library-group-list">
      ${renderAttributeGroup(task, "shape", shapeItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      })))}
      ${renderAttributeGroup(task, "material", materialItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.visual,
      })))}
      ${renderAttributeGroup(
        task,
        "surface-option",
        surfaceItems.map((item) => ({ id: item, name: item, description: "Surface option" })),
        compatibleSurfaceOptions,
      )}
      ${renderAttributeGroup(task, "mechanism", mechanismItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.interaction,
      })))}
      ${renderAttributeGroup(task, "color", colorItems.map((item) => ({
        id: item.name,
        name: item.name,
        description: `${item.hex} · ${item.description}`,
      })))}
    </div>
  `;
}

function renderAttributeGroup(
  task: PlaygroundTask,
  group: AttributeGroup,
  items: Array<{ id: string; name: string; description: string }>,
  compatibleValues?: Set<string> | null,
) {
  const label =
    group === "surface-option"
      ? "Surface options"
      : group === "shape"
        ? "Shapes"
        : group === "material"
          ? "Materials"
          : group === "mechanism"
            ? "Mechanisms"
            : "Colors";

  return html`
    <section class="library-group">
      <h3>${label}</h3>
      <div class="library-option-list">
        ${items.map((item) => {
          const active = hasLibraryCard(task, group, item.id);
          const dimmed = compatibleValues && group === "surface-option" && !compatibleValues.has(item.id);
          return html`
            <button
              class="library-option ${active ? "active" : ""} ${dimmed ? "dimmed" : ""}"
              title=${item.description}
              @click=${() => toggleAttributeCard(task.id, group, item)}
            >
              <strong>${item.name}</strong>
              <span>${item.description}</span>
            </button>
          `;
        })}
      </div>
    </section>
  `;
}

function renderSynthesisArea(task: PlaygroundTask) {
  return html`
    <textarea
      placeholder="Optional custom instructions to add to the prompt synthesis..."
      .value=${task.ui.customInstructions}
      @input=${(event: Event) => {
        const value = (event.target as HTMLTextAreaElement).value;
        patchTask(task.id, (current) => ({ ...current, ui: { ...current.ui, customInstructions: value } }));
      }}
    ></textarea>
    <div class="action-group">
      <button @click=${() => void synthesizePromptCard(task.id)}>Synthesize prompt card</button>
    </div>
  `;
}

function renderRevisionArea(task: PlaygroundTask) {
  return html`
    <p class="section-note">Select a prompt card first, then enter revision instructions in plain English.</p>
    <textarea
      placeholder="Revise the prompt to feel more premium, clinical, minimal, or specific..."
      .value=${task.ui.revisionInstructions}
      @input=${(event: Event) => {
        const value = (event.target as HTMLTextAreaElement).value;
        patchTask(task.id, (current) => ({ ...current, ui: { ...current.ui, revisionInstructions: value } }));
      }}
    ></textarea>
    <div class="action-group">
      <button @click=${() => void revisePromptCard(task.id)} ?disabled=${!task.ui.revisionInstructions.trim()}>
        Revise prompt card
      </button>
    </div>
  `;
}

function renderSceneArea(task: PlaygroundTask, suggestedScenes: string[]) {
  return html`
    <textarea
      placeholder="Describe the scene you want to stage for the current prompt..."
      .value=${task.ui.sceneInstructions}
      @input=${(event: Event) => {
        const value = (event.target as HTMLTextAreaElement).value;
        patchTask(task.id, (current) => ({ ...current, ui: { ...current.ui, sceneInstructions: value } }));
      }}
    ></textarea>
    <div class="suggestion-list">
      ${suggestedScenes.map(
        (scene) => html`<button @click=${() => patchTask(task.id, (current) => ({
          ...current,
          ui: { ...current.ui, sceneInstructions: scene },
        }))}>${scene}</button>`,
      )}
    </div>
    <div class="action-group">
      <button @click=${() => void stageSceneCards(task.id)} ?disabled=${!task.ui.sceneInstructions.trim()}>
        Stage scene cards
      </button>
    </div>
  `;
}

function renderImageGenerationArea(task: PlaygroundTask) {
  return html`
    <p class="section-note">
      Select one or more prompt or scene cards, then generate additive image cards. Each run stays in the task gallery.
    </p>
    <div class="action-group">
      <button @click=${() => generateImages(task.id)}>Generate images</button>
    </div>
  `;
}

function renderBoardCard(task: PlaygroundTask, card: PlaygroundCard) {
  const selected = task.selectedCardIds.includes(card.id);
  const hasArtifact = Boolean(card.artifact || card.imagePrompt);

  return html`
    <article
      class="board-card ${selected ? "selected" : ""}"
      draggable="true"
      data-card-id=${card.id}
      @click=${(event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest("button")) return;
        patchTask(task.id, (current) => withSelection(current, card.id, event.metaKey || event.ctrlKey ? "toggle" : "replace"));
      }}
      @dragstart=${() => ui$.next({ ...ui$.value, dragCardId: card.id })}
      @dragend=${() => ui$.next({ ...ui$.value, dragCardId: undefined })}
      @dragover=${(event: DragEvent) => event.preventDefault()}
      @drop=${(event: DragEvent) => {
        event.preventDefault();
        const draggedCardId = ui$.value.dragCardId;
        if (!draggedCardId) return;
        patchTask(task.id, (current) => moveCard(current, draggedCardId, card.id));
        ui$.next({ ...ui$.value, dragCardId: undefined });
      }}
    >
      <div class="card-header-row">
        <div>
          <div class="card-category">${card.category}</div>
          <h3>${card.title}</h3>
        </div>
        <button
          @click=${(event: Event) => {
            event.stopPropagation();
            patchTask(task.id, (current) => ({
              ...current,
              cards: current.cards.filter((entry) => entry.id !== card.id),
              selectedCardIds: current.selectedCardIds.filter((entry) => entry !== card.id),
              ui: {
                ...current.ui,
                inspectCardId: current.ui.inspectCardId === card.id ? undefined : current.ui.inspectCardId,
              },
            }));
          }}
        >
          Delete
        </button>
      </div>
      ${card.image ? html`<img class="card-image" src=${card.image} alt=${card.title} />` : nothing}
      <p>${card.description || "No description"}</p>
      ${card.metadata.generationStatus === "running"
        ? html`<small>Running…</small>`
        : card.metadata.generationStatus === "error"
          ? html`<small>Error</small>`
          : nothing}
      ${hasArtifact ? html`<small>Inspectable artifact available</small>` : nothing}
    </article>
  `;
}

function renderGeneratedOutputCard(task: PlaygroundTask, card: PlaygroundCard) {
  return html`
    <article class="generated-card ${card.category}">
      <div class="card-header-row">
        <div>
          <div class="card-category">${card.category}</div>
          <h3>${card.title}</h3>
        </div>
        <button @click=${() => patchTask(task.id, (current) => withSelection(current, card.id, "replace"))}>Inspect</button>
      </div>
      ${card.image ? html`<img class="generated-image" src=${card.image} alt=${card.title} />` : nothing}
      ${card.artifact || card.imagePrompt
        ? html`<pre>${(card.artifact || card.imagePrompt).slice(0, 360)}</pre>`
        : html`<p>${card.description}</p>`}
      ${card.category === "image" && card.imagePrompt
        ? html`<button @click=${() => generateImages(task.id, [card.metadata.sourceCardIds?.[0]].filter(Boolean) as string[])}>Generate another variation</button>`
        : nothing}
    </article>
  `;
}

function renderInspectableCard(card: PlaygroundCard) {
  return html`
    <div class="inspect-stack">
      <div class="inspect-metadata">
        <div><strong>Title</strong><span>${card.title}</span></div>
        <div><strong>Category</strong><span>${card.category}</span></div>
        <div><strong>Source</strong><span>${card.metadata.source}</span></div>
        <div><strong>Updated</strong><span>${formatTime(card.metadata.updatedAt)}</span></div>
      </div>
      ${card.image ? html`<img class="inspect-image" src=${card.image} alt=${card.title} />` : nothing}
      <textarea readonly .value=${card.artifact || card.imagePrompt || card.description}></textarea>
    </div>
  `;
}

function renderTaskHub() {
  const session = session$.value;
  const ui = ui$.value;
  const seedSourceTask = ui.hubSeedSourceTaskId ? session.tasks.find((task) => task.id === ui.hubSeedSourceTaskId) : undefined;
  const seedCards = seedSourceTask ? getSelectedCards(seedSourceTask) : [];

  render(
    html`
      <div class="dialog-header">
        <div>
          <h2>Task hub</h2>
          <p>${seedCards.length > 0 ? `Seed ${seedCards.length} selected card${seedCards.length === 1 ? "" : "s"} into another task.` : "Create or resume any task."}</p>
        </div>
        <button @click=${() => taskHubDialog.close()}>Close</button>
      </div>

      <section class="hub-section">
        <h3>Create a task</h3>
        <div class="hub-task-list">
          ${taskDefinitions.map(
            (definition) => html`
              <button class="hub-task-button" @click=${() => createTaskFromHub(definition.id, ui.hubSeedSourceTaskId)}>
                <strong>${definition.title}</strong>
                <span>${definition.taskClass}</span>
                <small>${definition.description}</small>
              </button>
            `,
          )}
        </div>
      </section>

      <section class="hub-section">
        <h3>Resume existing work</h3>
        ${session.tasks.length > 0
          ? html`
              <div class="hub-existing-list">
                ${session.tasks.map((task) => {
                  const definition = getTaskDefinition(task.taskTypeId);
                  const isActive = task.id === session.activeTaskId;
                  const canReceiveSeed = task.id !== ui.hubSeedSourceTaskId && seedCards.length > 0;
                  return html`
                    <article class="hub-existing-card ${isActive ? "active" : ""}">
                      <div>
                        <strong>${task.title}</strong>
                        <div class="hub-meta-line">${definition.title} · ${buildTaskStatus(task)} · ${formatTime(task.updatedAt)}</div>
                      </div>
                      <div class="hub-card-actions">
                        <button @click=${() => switchTask(task.id)}>Open</button>
                        ${canReceiveSeed
                          ? html`<button @click=${() => handoffSelectionToTask(task.id, ui.hubSeedSourceTaskId!)}>Send selected cards here</button>`
                          : nothing}
                      </div>
                    </article>
                  `;
                })}
              </div>
            `
          : html`<p class="empty-state">No stored tasks yet.</p>`}
      </section>
    `,
    taskHubDialogContent,
  );
}

function syncDialogs() {
  const ui = ui$.value;
  if (ui.taskHubOpen && !taskHubDialog.open) {
    taskHubDialog.showModal();
  }
  if (!ui.taskHubOpen && taskHubDialog.open) {
    taskHubDialog.close();
  }
}

function openTaskHub(seedSourceTaskId?: string) {
  ui$.next({ ...ui$.value, taskHubOpen: true, hubSeedSourceTaskId: seedSourceTaskId });
}

function showToast(message: string, tone: ToastState["tone"] = "info") {
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  ui$.next({ ...ui$.value, toast: { message, tone } });
  toastTimer = window.setTimeout(() => {
    ui$.next({ ...ui$.value, toast: undefined });
  }, 4000);
}

function getActiveTask() {
  return session$.value.tasks.find((task) => task.id === session$.value.activeTaskId);
}

function setSession(updater: (session: PlaygroundSession) => PlaygroundSession) {
  session$.next(ensureSession(updater(session$.value)));
}

function patchTask(taskId: string, updater: (task: PlaygroundTask) => PlaygroundTask) {
  const timestamp = now();
  setSession((session) => ({
    ...session,
    tasks: session.tasks.map((task) => (task.id === taskId ? updateTask(task, timestamp, updater) : task)),
  }));
}

function switchTask(taskId: string) {
  setSession((session) => ({ ...session, activeTaskId: taskId }));
  ui$.next({ ...ui$.value, taskHubOpen: false, hubSeedSourceTaskId: undefined });
}

function createTaskFromHub(taskTypeId: TaskTypeId, seedSourceTaskId?: string) {
  const timestamp = now();
  const sourceTask = seedSourceTaskId ? session$.value.tasks.find((task) => task.id === seedSourceTaskId) : undefined;
  const task = createTask(taskTypeId, timestamp, createId);
  const seededCards = sourceTask
    ? cloneCardsForTask(getSelectedCards(sourceTask), task.id, timestamp, createId, sourceTask.id)
    : [];

  setSession((session) => ({
    tasks: [{ ...task, cards: seededCards }, ...session.tasks],
    activeTaskId: task.id,
  }));
  ui$.next({ ...ui$.value, taskHubOpen: false, hubSeedSourceTaskId: undefined });
  showToast(seedSourceTaskId && seededCards.length > 0 ? `Created a task seeded with ${seededCards.length} card(s).` : "Created a new task.");
}

function handoffSelectionToTask(targetTaskId: string, sourceTaskId: string) {
  const timestamp = now();
  const session = session$.value;
  const sourceTask = session.tasks.find((task) => task.id === sourceTaskId);
  const destinationTask = session.tasks.find((task) => task.id === targetTaskId);
  if (!sourceTask || !destinationTask) return;

  const { destinationTask: updatedDestination, transferred } = handoffSelectedCards(sourceTask, destinationTask, timestamp, createId);
  if (!transferred.length) {
    showToast("Select one or more cards before handing them off.", "error");
    return;
  }

  setSession((current) => ({
    ...current,
    activeTaskId: updatedDestination.id,
    tasks: current.tasks.map((task) => (task.id === updatedDestination.id ? updateTask(updatedDestination, timestamp, (value) => value) : task)),
  }));
  ui$.next({ ...ui$.value, taskHubOpen: false, hubSeedSourceTaskId: undefined });
  showToast(`Sent ${transferred.length} card(s) to ${updatedDestination.title}.`);
}

async function appendPendingImports(taskId: string, files: File[], source: string) {
  const pendingImports = await Promise.all(files.map((file) => readPendingImport(file, source)));
  patchTask(taskId, (task) => ({
    ...task,
    ui: { ...task.ui, pendingImports: [...task.ui.pendingImports, ...pendingImports] },
  }));
  showToast(`Added ${pendingImports.length} pending image import${pendingImports.length === 1 ? "" : "s"}.`);
}

function removePendingImport(taskId: string, pendingImportId: string) {
  patchTask(taskId, (task) => ({
    ...task,
    ui: { ...task.ui, pendingImports: task.ui.pendingImports.filter((item) => item.id !== pendingImportId) },
  }));
}

function commitPendingImports(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task || task.ui.pendingImports.length === 0) return;

  const timestamp = now();
  const cards = task.ui.pendingImports.map((item) => createReferenceCard(item, taskId, timestamp, createId));
  patchTask(taskId, (current) => ({
    ...addCards(current, cards),
    ui: { ...current.ui, pendingImports: [] },
  }));
  showToast(`Committed ${cards.length} reference card${cards.length === 1 ? "" : "s"}.`);
}

function addTextCard(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task || !task.ui.draftText.trim()) return;

  const card = createTextCard(task.ui.draftText, taskId, now(), createId);
  patchTask(taskId, (current) => ({
    ...addCards(current, [card]),
    ui: { ...current.ui, draftText: "", inspectCardId: card.id },
    selectedCardIds: [card.id],
  }));
}

function toggleAttributeCard(taskId: string, group: AttributeGroup, item: { id: string; name: string; description: string }) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const match = task.cards.find(
    (card) =>
      card.category === "attribute" &&
      card.metadata.source === group &&
      card.metadata.libraryReferences?.includes(item.id),
  );

  if (match) {
    patchTask(taskId, (current) => ({
      ...current,
      cards: current.cards.filter((card) => card.id !== match.id),
      selectedCardIds: current.selectedCardIds.filter((cardId) => cardId !== match.id),
    }));
    return;
  }

  const card = createAttributeCard(group, item, taskId, now(), createId);
  patchTask(taskId, (current) => ({
    ...addCards(current, [card]),
    selectedCardIds: [card.id],
    ui: { ...current.ui, inspectCardId: card.id },
  }));
}

async function scanReferenceCards(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) return;

  const selected = getSelectedCards(task).filter((card) => card.category === "reference" && card.image);
  const candidates = selected.length > 0 ? selected : task.cards.filter((card) => card.category === "reference" && card.image);
  if (candidates.length === 0) {
    showToast("Add or select at least one reference card before scanning.", "error");
    return;
  }

  const updates = candidates.map(async (card) => {
    patchTask(taskId, (current) => ({
      ...current,
      cards: current.cards.map((entry) =>
        entry.id === card.id
          ? {
              ...entry,
              metadata: { ...entry.metadata, generationStatus: "running", updatedAt: now() },
              description: "Scanning reference with Gemini structured output.",
            }
          : entry,
      ),
    }));

    const photo: ScannedPhoto = {
      id: card.id,
      thumbnailUrl: card.image ?? "",
      fullDataUrl: card.image ?? "",
      label: card.title,
      isScanning: true,
    };

    const result = await runScanAI(photo, new BehaviorSubject<ScannedPhoto[]>([photo]));
    if (!result) {
      patchTask(taskId, (current) => ({
        ...current,
        cards: current.cards.map((entry) =>
          entry.id === card.id
            ? {
                ...entry,
                metadata: { ...entry.metadata, generationStatus: "error", updatedAt: now() },
                description: "Scan did not return any attributes.",
              }
            : entry,
        ),
      }));
      return 0;
    }

    const timestamp = now();
    const inferredCards = [
      ...result.shapes.flatMap((shapeId) => {
        const shape = shapesById.get(shapeId);
        return shape ? [createAttributeCard("shape", shape, taskId, timestamp, createId, card.id)] : [];
      }),
      ...result.materials.flatMap((materialId) => {
        const material = materialsById.get(materialId);
        return material
          ? [
              createAttributeCard(
                "material",
                { id: material.id, name: material.name, description: material.visual },
                taskId,
                timestamp,
                createId,
                card.id,
              ),
            ]
          : [];
      }),
      ...result.mechanisms.flatMap((mechanismId) => {
        const mechanism = mechanismsById.get(mechanismId);
        return mechanism
          ? [
              createAttributeCard(
                "mechanism",
                { id: mechanism.id, name: mechanism.name, description: mechanism.interaction },
                taskId,
                timestamp,
                createId,
                card.id,
              ),
            ]
          : [];
      }),
      ...result.colors.flatMap((colorName) => {
        const color = colorByName.get(colorName);
        return color
          ? [
              createAttributeCard(
                "color",
                { id: color.name, name: color.name, description: `${color.hex} · ${color.description}` },
                taskId,
                timestamp,
                createId,
                card.id,
              ),
            ]
          : [];
      }),
    ];

    patchTask(taskId, (current) => ({
      ...addCards(current, inferredCards),
      cards: addCards(current, inferredCards).cards.map((entry) =>
        entry.id === card.id
          ? {
              ...entry,
              metadata: { ...entry.metadata, generationStatus: "success", updatedAt: timestamp },
              description: `Scanned into ${inferredCards.length} attribute card${inferredCards.length === 1 ? "" : "s"}.`,
            }
          : entry,
      ),
    }));

    return inferredCards.length;
  });

  const results = await Promise.all(updates);
  const total = results.reduce((sum, count) => sum + count, 0);
  showToast(total > 0 ? `Created ${total} inferred attribute card${total === 1 ? "" : "s"}.` : "No inferred attributes were added.", total > 0 ? "info" : "error");
}

async function synthesizePromptCard(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const promptInputs = getPromptInputs(task);
  const output$ = new BehaviorSubject(task.ui.promptArtifact);
  const isSynthesizing$ = new BehaviorSubject(false);
  const history$ = new BehaviorSubject<Content[]>(task.ui.conversationHistory as Content[]);
  const subscriptions = [
    output$.subscribe((value) => {
      patchTask(taskId, (current) => ({ ...current, ui: { ...current.ui, promptArtifact: value } }));
    }),
    history$.subscribe((value) => {
      patchTask(taskId, (current) => ({ ...current, ui: { ...current.ui, conversationHistory: value as SerializableContent[] } }));
    }),
  ];

  try {
    await synthesize({
      ...promptInputs,
      customInstructions: task.ui.customInstructions,
      synthesisOutput$: output$,
      isSynthesizing$,
      conversationHistory$: history$,
    });
  } finally {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  const artifact = output$.value.trim();
  if (!artifact || artifact.startsWith("Error:")) {
    showToast(artifact || "Prompt synthesis did not produce an artifact.", "error");
    return;
  }

  const card = createPromptCard({
    taskId,
    title: `Prompt ${countCards(task, "prompt") + 1}`,
    artifact,
    category: "prompt",
    now: now(),
    createId,
    sourceCardIds: promptInputs.sourceCardIds,
  });

  patchTask(taskId, (current) => ({
    ...addCards(current, [card]),
    selectedCardIds: [card.id],
    ui: { ...current.ui, inspectCardId: card.id },
  }));
  showToast("Created a new prompt card.");
}

async function revisePromptCard(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const promptCard = getSelectedPromptCard(task);
  if (!promptCard || task.ui.conversationHistory.length === 0) {
    showToast("Synthesize a prompt in this task before revising it.", "error");
    return;
  }

  const output$ = new BehaviorSubject(task.ui.promptArtifact || promptCard.artifact || promptCard.imagePrompt);
  const isSynthesizing$ = new BehaviorSubject(false);
  const history$ = new BehaviorSubject<Content[]>(task.ui.conversationHistory as Content[]);
  const editInstructions$ = new BehaviorSubject(task.ui.revisionInstructions);
  const subscriptions = [
    output$.subscribe((value) => {
      patchTask(taskId, (current) => ({ ...current, ui: { ...current.ui, promptArtifact: value } }));
    }),
    history$.subscribe((value) => {
      patchTask(taskId, (current) => ({ ...current, ui: { ...current.ui, conversationHistory: value as SerializableContent[] } }));
    }),
    editInstructions$.subscribe((value) => {
      patchTask(taskId, (current) => ({ ...current, ui: { ...current.ui, revisionInstructions: value } }));
    }),
  ];

  try {
    await revise({
      editInstructions: task.ui.revisionInstructions,
      synthesisOutput$: output$,
      isSynthesizing$,
      conversationHistory$: history$,
      editInstructions$,
    });
  } finally {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  const artifact = output$.value.trim();
  if (!artifact || artifact.startsWith("Error:")) {
    showToast(artifact || "Prompt revision did not produce an artifact.", "error");
    return;
  }

  const card = createPromptCard({
    taskId,
    title: `Prompt revision ${countCards(task, "prompt") + 1}`,
    artifact,
    category: "prompt",
    now: now(),
    createId,
    sourceCardIds: [promptCard.id],
    promptRevisionHistory: [promptCard.artifact || promptCard.imagePrompt, ...promptCard.metadata.promptRevisionHistory],
  });

  patchTask(taskId, (current) => ({
    ...addCards(current, [card]),
    selectedCardIds: [card.id],
    ui: { ...current.ui, inspectCardId: card.id, revisionInstructions: "" },
  }));
  showToast("Added a revised prompt card.");
}

async function stageSceneCards(taskId: string) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) return;

  const sourceCards = getSelectedPromptCards(task);
  if (sourceCards.length === 0) {
    showToast("Select at least one prompt or scene card before staging scenes.", "error");
    return;
  }

  const scene = task.ui.sceneInstructions.trim();
  if (!scene) {
    showToast("Enter a scene description before staging.", "error");
    return;
  }

  await Promise.all(
    sourceCards.map(async (sourceCard, index) => {
      const timestamp = now();
      const pendingCard = createPromptCard({
        taskId,
        title: `Scene ${countCards(task, "scene") + index + 1}`,
        artifact: "",
        category: "scene",
        now: timestamp,
        createId,
        sourceCardIds: [sourceCard.id],
        promptRevisionHistory: [sourceCard.artifact || sourceCard.imagePrompt, ...sourceCard.metadata.promptRevisionHistory],
      });

      const pendingCardId = pendingCard.id;
      patchTask(taskId, (current) => ({
        ...addCards(current, [
          {
            ...pendingCard,
            description: scene,
            metadata: { ...pendingCard.metadata, generationStatus: "running" },
          },
        ]),
        selectedCardIds: [pendingCardId],
        ui: { ...current.ui, inspectCardId: pendingCardId },
      }));

      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          config: { thinkingConfig: { thinkingBudget: 0 } },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.\n\nCurrent XML:\n${sourceCard.artifact || sourceCard.imagePrompt}\n\nPhoto scene: ${scene}`,
                },
              ],
            },
          ],
        });

        const artifact = response.text?.trim() ?? "";
        if (!artifact) {
          throw new Error("No scene XML returned");
        }

        patchTask(taskId, (current) => ({
          ...current,
          cards: current.cards.map((card) =>
            card.id === pendingCardId
              ? {
                  ...card,
                  imagePrompt: artifact,
                  artifact,
                  description: scene,
                  metadata: { ...card.metadata, generationStatus: "success", updatedAt: now() },
                }
              : card,
          ),
        }));
      } catch (error) {
        patchTask(taskId, (current) => ({
          ...current,
          cards: current.cards.map((card) =>
            card.id === pendingCardId
              ? {
                  ...card,
                  description: error instanceof Error ? error.message : String(error),
                  metadata: { ...card.metadata, generationStatus: "error", updatedAt: now() },
                }
              : card,
          ),
        }));
        showToast(error instanceof Error ? error.message : String(error), "error");
      }
    }),
  );
}

function generateImages(taskId: string, sourceCardIds?: string[]) {
  const task = session$.value.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) return;

  const selectedCards = sourceCardIds?.length
    ? task.cards.filter((card) => sourceCardIds.includes(card.id))
    : getSelectedPromptCards(task);
  const promptCards = selectedCards.length > 0 ? selectedCards : [];
  if (promptCards.length === 0) {
    showToast("Select one or more prompt or scene cards before generating images.", "error");
    return;
  }

  promptCards.forEach((sourceCard, index) => {
    const imageCard = createImageCard({
      taskId,
      title: `Render ${countCards(task, "image") + index + 1}`,
      prompt: sourceCard.artifact || sourceCard.imagePrompt,
      now: now(),
      createId,
      sourceCardIds: [sourceCard.id],
    });
    const imageCardId = imageCard.id;

    patchTask(taskId, (current) => ({
      ...addCards(current, [imageCard]),
      selectedCardIds: [imageCardId],
      ui: { ...current.ui, inspectCardId: imageCardId },
    }));

    generateImage(
      { apiKey },
      {
        prompt: imageCard.imagePrompt,
        width: 540,
        height: 960,
        aspectRatio: "9:16",
      },
    ).subscribe({
      next: (result) => {
        patchTask(taskId, (current) => ({
          ...current,
          cards: current.cards.map((card) =>
            card.id === imageCardId
              ? {
                  ...card,
                  image: result.url,
                  metadata: { ...card.metadata, generationStatus: "success", updatedAt: now() },
                }
              : card,
          ),
        }));
      },
      error: (error: Error) => {
        patchTask(taskId, (current) => ({
          ...current,
          cards: current.cards.map((card) =>
            card.id === imageCardId
              ? {
                  ...card,
                  description: error.message,
                  metadata: { ...card.metadata, generationStatus: "error", updatedAt: now() },
                }
              : card,
          ),
        }));
        showToast(error.message, "error");
      },
    });
  });
}

function getPromptInputs(task: PlaygroundTask) {
  const selectedCards = getSelectedCards(task);
  const cards = selectedCards.length > 0 ? selectedCards : task.cards;
  const attributeCards = cards.filter((card) => card.category === "attribute");
  const referenceCards = cards.filter((card) => card.category === "reference" && card.image);

  const shapes = new Set<string>();
  const materials = new Set<string>();
  const surfaceOptions = new Set<string>();
  const mechanisms = new Set<string>();
  const colors = new Set<string>();

  attributeCards.forEach((card) => {
    Object.entries(card.metadata.structuredAttributes ?? {}).forEach(([group, values]) => {
      values?.forEach((value) => {
        if (group === "shape") shapes.add(value);
        if (group === "material") materials.add(value);
        if (group === "surface-option") surfaceOptions.add(value);
        if (group === "mechanism") mechanisms.add(value);
        if (group === "color") colors.add(value);
      });
    });
  });

  const scannedPhotos: ScannedPhoto[] = referenceCards.map((card) => ({
    id: card.id,
    thumbnailUrl: card.image ?? "",
    fullDataUrl: card.image ?? "",
    label: card.title,
    isScanning: false,
  }));

  return {
    pickedColors: [...colors],
    pickedMaterials: [...materials],
    pickedSurfaceOptions: [...surfaceOptions],
    pickedMechanisms: [...mechanisms],
    pickedShapes: [...shapes],
    scannedPhotos,
    sourceCardIds: cards.map((card) => card.id),
  };
}

function getSelectedPromptCard(task: PlaygroundTask) {
  return getSelectedPromptCards(task)[0] ?? task.cards.find((card) => card.category === "prompt" || card.category === "scene");
}

function getSelectedPromptCards(task: PlaygroundTask) {
  const selectedCards = getSelectedCards(task).filter((card) => card.category === "prompt" || card.category === "scene");
  return selectedCards.length > 0 ? selectedCards : [];
}

function getSuggestedScenes(task: PlaygroundTask) {
  const mechanismIds = getAttributeValues(task, "mechanism");
  return Array.from(
    new Set([
      ...genericInteractionOptions,
      ...mechanismIds.flatMap((mechanismId) => mechanismsById.get(mechanismId)?.interactionOptions ?? []),
    ]),
  );
}

function getCompatibleSurfaceOptions(task: PlaygroundTask) {
  const materialIds = getAttributeValues(task, "material");
  if (materialIds.length === 0) return null;
  return new Set(materialIds.flatMap((materialId) => materialsById.get(materialId)?.surfaceOptions ?? []));
}

function getAttributeValues(task: PlaygroundTask, group: AttributeGroup) {
  return task.cards
    .filter((card) => card.category === "attribute")
    .flatMap((card) => card.metadata.structuredAttributes?.[group] ?? []);
}

function hasLibraryCard(task: PlaygroundTask, group: AttributeGroup, id: string) {
  return task.cards.some(
    (card) =>
      card.category === "attribute" &&
      card.metadata.source === group &&
      card.metadata.libraryReferences?.includes(id),
  );
}

function getGeminiApiKey() {
  const apiKey = loadApiKeys().gemini?.trim();
  if (!apiKey) {
    showToast("Gemini API key not configured. Use Setup to add it.", "error");
    return null;
  }
  return apiKey;
}

function includesFilter(parts: string[], filter: string) {
  if (!filter) return true;
  return parts.some((part) => part.toLowerCase().includes(filter));
}

function countCards(task: PlaygroundTask, category: PlaygroundCard["category"]) {
  return task.cards.filter((card) => card.category === category).length;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Copied to clipboard.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), "error");
  }
}

async function readPendingImport(file: File, source: string): Promise<PendingImport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const image = String(reader.result ?? "");
      resolve({
        id: `pending-${createId()}`,
        title: file.name || `${source} image`,
        image,
        source,
      });
    };
    reader.readAsDataURL(file);
  });
}
