import type { Content } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, EMPTY, from, merge, mergeMap, scan, Subject } from "rxjs";
import { debounceTime, skip, tap } from "rxjs/operators";
import { CenterPanelComponent } from "./components/center-panel/center-panel.component";
import { loadApiKeys } from "./components/connections/storage";
import { useSetupDialog } from "./components/connections/use-setup-dialog";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { LeftPanelComponent } from "./components/left-panel/left-panel.component";
import { get, set } from "./lib/persistence";
import { runScanAI } from "./lib/studio-ai";
import type { PhotoCard, ScannedPhoto } from "./lib/studio-types";
import "./playground.css";

// --- Types ---

interface TaskSummary {
  id: string;
  type: "design" | "capture";
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface DesignTaskData {
  pickedColors: string[];
  pickedMaterials: string[];
  pickedSurfaceOptions: string[];
  pickedMechanisms: string[];
  pickedShapes: string[];
  filterText: string;
  customInstructions: string;
  synthesisOutput: string;
  editInstructions: string;
  conversationHistory: Content[];
  photoScene: string;
  photoGallery: PhotoCard[];
  scannedPhotos: ScannedPhoto[];
}

interface PlaygroundCard {
  id: string;
  type: "reference" | "text";
  title: string;
  description: string;
  image: string;
  metadata: Record<string, unknown>;
}

interface CaptureTaskData {
  cards: PlaygroundCard[];
  selectedCardIds: string[];
}

interface Toast {
  id: string;
  message: string;
  type: "error" | "info";
}

const TASK_TYPE_LABELS: Record<string, string> = {
  design: "Packaging Design",
  capture: "Capture References",
};

// --- Shell state ---

const taskList$ = new BehaviorSubject<TaskSummary[]>([]);
const activeTaskId$ = new BehaviorSubject<string | null>(null);
const apiKeys$ = new BehaviorSubject(loadApiKeys());
const toasts$ = new BehaviorSubject<Toast[]>([]);

// --- Design task subjects (active task) ---

const pickedColors$ = new BehaviorSubject<string[]>([]);
const pickedMaterials$ = new BehaviorSubject<string[]>([]);
const pickedSurfaceOptions$ = new BehaviorSubject<string[]>([]);
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

// --- Capture task subjects (active task) ---

const captureCards$ = new BehaviorSubject<PlaygroundCard[]>([]);
const captureSelectedIds$ = new BehaviorSubject<string[]>([]);

// --- Scan pipeline ---

const scanTrigger$ = new Subject<ScannedPhoto>();

scanTrigger$
  .pipe(
    mergeMap((photo) =>
      from(
        runScanAI(photo, scannedPhotos$).then((result) => {
          scannedPhotos$.next(
            scannedPhotos$.value.map((p) => (p.id === photo.id ? { ...p, label: "photo", isScanning: false } : p)),
          );
          return result;
        }),
      ).pipe(mergeMap((result) => (result ? from([result]) : EMPTY))),
    ),
    scan(
      (acc, result) => ({
        shapes: [...new Set([...acc.shapes, ...result.shapes])],
        materials: [...new Set([...acc.materials, ...result.materials])],
        mechanisms: [...new Set([...acc.mechanisms, ...result.mechanisms])],
        colors: [...new Set([...acc.colors, ...result.colors])],
      }),
      { shapes: [] as string[], materials: [] as string[], mechanisms: [] as string[], colors: [] as string[] },
    ),
  )
  .subscribe((accumulated) => {
    const mergeUnique = (current: string[], additions: string[]) => [...new Set([...current, ...additions])];
    pickedShapes$.next(mergeUnique(pickedShapes$.value, accumulated.shapes));
    pickedMaterials$.next(mergeUnique(pickedMaterials$.value, accumulated.materials));
    pickedMechanisms$.next(mergeUnique(pickedMechanisms$.value, accumulated.mechanisms));
    pickedColors$.next(mergeUnique(pickedColors$.value, accumulated.colors));
  });

// --- Persistence ---

const DB_PREFIX = "playground:";

async function loadShellState() {
  const tasks = await get<TaskSummary[]>(`${DB_PREFIX}tasks`);
  if (tasks) taskList$.next(tasks);
  const activeId = await get<string>(`${DB_PREFIX}activeTaskId`);
  if (activeId) activeTaskId$.next(activeId);
}

function persistShellState() {
  taskList$.pipe(skip(1)).subscribe((tasks) => set(`${DB_PREFIX}tasks`, tasks));
  activeTaskId$.pipe(skip(1)).subscribe((id) => set(`${DB_PREFIX}activeTaskId`, id));
}

function snapshotDesignState(): DesignTaskData {
  return {
    pickedColors: pickedColors$.value,
    pickedMaterials: pickedMaterials$.value,
    pickedSurfaceOptions: pickedSurfaceOptions$.value,
    pickedMechanisms: pickedMechanisms$.value,
    pickedShapes: pickedShapes$.value,
    filterText: filterText$.value,
    customInstructions: customInstructions$.value,
    synthesisOutput: synthesisOutput$.value,
    editInstructions: editInstructions$.value,
    conversationHistory: conversationHistory$.value,
    photoScene: photoScene$.value,
    photoGallery: photoGallery$.value,
    scannedPhotos: scannedPhotos$.value,
  };
}

function restoreDesignState(data: DesignTaskData) {
  pickedColors$.next(data.pickedColors ?? []);
  pickedMaterials$.next(data.pickedMaterials ?? []);
  pickedSurfaceOptions$.next(data.pickedSurfaceOptions ?? []);
  pickedMechanisms$.next(data.pickedMechanisms ?? []);
  pickedShapes$.next(data.pickedShapes ?? []);
  filterText$.next(data.filterText ?? "");
  customInstructions$.next(data.customInstructions ?? "");
  synthesisOutput$.next(data.synthesisOutput ?? "");
  isSynthesizing$.next(false);
  editInstructions$.next(data.editInstructions ?? "");
  conversationHistory$.next(data.conversationHistory ?? []);
  photoScene$.next(data.photoScene ?? "Product stand by itself");
  photoGallery$.next(data.photoGallery ?? []);
  scannedPhotos$.next(data.scannedPhotos ?? []);
}

function clearDesignState() {
  restoreDesignState({
    pickedColors: [],
    pickedMaterials: [],
    pickedSurfaceOptions: [],
    pickedMechanisms: [],
    pickedShapes: [],
    filterText: "",
    customInstructions: "",
    synthesisOutput: "",
    editInstructions: "",
    conversationHistory: [],
    photoScene: "Product stand by itself",
    photoGallery: [],
    scannedPhotos: [],
  });
}

function snapshotCaptureState(): CaptureTaskData {
  return {
    cards: captureCards$.value,
    selectedCardIds: captureSelectedIds$.value,
  };
}

function restoreCaptureState(data: CaptureTaskData) {
  captureCards$.next(data.cards ?? []);
  captureSelectedIds$.next(data.selectedCardIds ?? []);
}

function clearCaptureState() {
  captureCards$.next([]);
  captureSelectedIds$.next([]);
}

async function saveActiveTaskData() {
  const activeId = activeTaskId$.value;
  if (!activeId) return;
  const task = taskList$.value.find((t) => t.id === activeId);
  if (!task) return;

  if (task.type === "design") {
    await set(`${DB_PREFIX}task:${activeId}`, snapshotDesignState());
  } else if (task.type === "capture") {
    await set(`${DB_PREFIX}task:${activeId}`, snapshotCaptureState());
  }

  taskList$.next(taskList$.value.map((t) => (t.id === activeId ? { ...t, updatedAt: Date.now() } : t)));
}

async function loadTaskData(taskId: string) {
  const task = taskList$.value.find((t) => t.id === taskId);
  if (!task) return;

  if (task.type === "design") {
    const data = await get<DesignTaskData>(`${DB_PREFIX}task:${taskId}`);
    if (data) restoreDesignState(data);
    else clearDesignState();
  } else if (task.type === "capture") {
    const data = await get<CaptureTaskData>(`${DB_PREFIX}task:${taskId}`);
    if (data) restoreCaptureState(data);
    else clearCaptureState();
  }
}

// Auto-save active task on changes (debounced)
merge(
  pickedColors$,
  pickedMaterials$,
  pickedSurfaceOptions$,
  pickedMechanisms$,
  pickedShapes$,
  customInstructions$,
  synthesisOutput$,
  editInstructions$,
  photoScene$,
  photoGallery$,
  scannedPhotos$,
  captureCards$,
  captureSelectedIds$,
)
  .pipe(
    skip(1),
    debounceTime(500),
    tap(() => saveActiveTaskData()),
  )
  .subscribe();

// --- Task management ---

function createTask(type: "design" | "capture", title?: string, seedCards?: PlaygroundCard[]) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const summary: TaskSummary = {
    id,
    type,
    title: title || `${TASK_TYPE_LABELS[type]} ${taskList$.value.filter((t) => t.type === type).length + 1}`,
    createdAt: now,
    updatedAt: now,
  };
  taskList$.next([summary, ...taskList$.value]);

  if (type === "capture" && seedCards?.length) {
    set(`${DB_PREFIX}task:${id}`, { cards: seedCards, selectedCardIds: [] });
  }

  switchToTask(id);
}

async function switchToTask(taskId: string) {
  await saveActiveTaskData();
  await loadTaskData(taskId);
  activeTaskId$.next(taskId);
  renderApp();
}

async function deleteTask(taskId: string) {
  if (activeTaskId$.value === taskId) {
    activeTaskId$.next(null);
    clearDesignState();
    clearCaptureState();
  }
  taskList$.next(taskList$.value.filter((t) => t.id !== taskId));
  await set(`${DB_PREFIX}task:${taskId}`, undefined);
  renderApp();
}

function updateTaskTitle(taskId: string, title: string) {
  taskList$.next(taskList$.value.map((t) => (t.id === taskId ? { ...t, title } : t)));
}

// --- Toast system ---

function showToast(message: string, type: "error" | "info" = "info") {
  const id = crypto.randomUUID();
  toasts$.next([...toasts$.value, { id, message, type }]);
  setTimeout(() => dismissToast(id), 5000);
}

function dismissToast(id: string) {
  toasts$.next(toasts$.value.filter((t) => t.id !== id));
}

// --- Task hub modal ---

function openTaskHub() {
  const dialog = document.getElementById("task-hub-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  const renderHub = () => {
    const tasks = taskList$.value;
    const activeId = activeTaskId$.value;

    const template = html`
      <div class="task-hub-header">
        <h2>Tasks</h2>
        <button commandfor="task-hub-dialog" command="close">Close</button>
      </div>
      <div class="task-hub-create">
        <button
          @click=${() => {
            dialog.close();
            createTask("design");
          }}
        >
          New Design
        </button>
        <button
          @click=${() => {
            dialog.close();
            createTask("capture");
          }}
        >
          New Capture
        </button>
      </div>
      ${tasks.length > 0
        ? html`<div class="task-list">
            ${tasks.map(
              (task) => html`
                <div class="task-item ${task.id === activeId ? "active" : ""}">
                  <button
                    class="task-item"
                    style="border:none"
                    @click=${() => {
                      dialog.close();
                      switchToTask(task.id);
                    }}
                  >
                    <div class="task-item-info">
                      <span class="task-item-title">${task.title}</span>
                      <span class="task-item-meta"
                        >${TASK_TYPE_LABELS[task.type]} · ${formatTime(task.updatedAt)}</span
                      >
                    </div>
                  </button>
                  <div class="task-item-actions">
                    <button
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${task.title}"?`)) {
                          deleteTask(task.id);
                          renderHub();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              `,
            )}
          </div>`
        : html`<p>No tasks yet. Create one to get started.</p>`}
    `;
    render(template, dialogContent);
  };

  renderHub();
  dialog.showModal();
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// --- Capture task rendering ---

function addReferenceImage(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const card: PlaygroundCard = {
      id: crypto.randomUUID(),
      type: "reference",
      title: file.name,
      description: "",
      image: dataUrl,
      metadata: { source: "upload" },
    };
    captureCards$.next([...captureCards$.value, card]);
    renderApp();
  };
  reader.readAsDataURL(file);
}

function addTextCard(title: string, description: string) {
  const card: PlaygroundCard = {
    id: crypto.randomUUID(),
    type: "text",
    title: title || "Note",
    description,
    image: "",
    metadata: { source: "text" },
  };
  captureCards$.next([...captureCards$.value, card]);
  renderApp();
}

function toggleCaptureCardSelection(cardId: string) {
  const current = captureSelectedIds$.value;
  captureSelectedIds$.next(
    current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
  );
  renderApp();
}

function deleteCaptureCard(cardId: string) {
  captureCards$.next(captureCards$.value.filter((c) => c.id !== cardId));
  captureSelectedIds$.next(captureSelectedIds$.value.filter((id) => id !== cardId));
  renderApp();
}

function handOffSelectedCards() {
  const selectedIds = captureSelectedIds$.value;
  const cards = captureCards$.value.filter((c) => selectedIds.includes(c.id));
  if (cards.length === 0) {
    showToast("Select cards first to hand off.", "info");
    return;
  }
  createTask("capture", `Handoff (${cards.length} cards)`, cards);
}

// --- Register custom elements ---

GenerativeImageElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

// --- Observe generative-image status changes ---

const imageStatusObserver = new MutationObserver((mutations) => {
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
imageStatusObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["status"] });

// --- Toast rendering ---

function renderToasts() {
  const container = document.getElementById("toast-container")!;
  const template = html`
    ${toasts$.value.map(
      (t) => html`
        <div class="toast toast-${t.type}" @click=${() => dismissToast(t.id)}>
          <span class="toast-message">${t.message}</span>
          <button class="toast-close" @click=${() => dismissToast(t.id)}>x</button>
        </div>
      `,
    )}
  `;
  render(template, container);
}

toasts$.subscribe(() => renderToasts());

// --- Main rendering ---

function renderApp() {
  const app = document.getElementById("app")!;
  const activeId = activeTaskId$.value;
  const tasks = taskList$.value;

  if (!activeId) {
    render(
      html`
        <div class="empty-state">
          <p>No active task</p>
          <button @click=${openTaskHub}>Create or select a task</button>
        </div>
      `,
      app,
    );
    return;
  }

  const task = tasks.find((t) => t.id === activeId);
  if (!task) {
    render(html`<div class="empty-state"><p>Task not found</p></div>`, app);
    return;
  }

  if (task.type === "design") {
    renderDesignTask(app, task);
  } else if (task.type === "capture") {
    renderCaptureTask(app, task);
  }
}

function renderDesignTask(app: HTMLElement, task: TaskSummary) {
  const template = html`
    <div class="task-page">
      <div class="task-header">
        <input
          type="text"
          .value=${task.title}
          @change=${(e: Event) => updateTaskTitle(task.id, (e.target as HTMLInputElement).value)}
        />
        <span class="task-type-badge">${TASK_TYPE_LABELS[task.type]}</span>
      </div>
    </div>
    <div class="design-layout">
      <aside class="design-sidebar">
        ${LeftPanelComponent({
          pickedColors$,
          pickedMaterials$,
          pickedSurfaceOptions$,
          pickedMechanisms$,
          pickedShapes$,
          filterText$,
          scanDialogProps: { scannedPhotos$, scanTrigger$ },
        })}
      </aside>
      <main class="design-main">
        ${CenterPanelComponent({
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
        })}
      </main>
    </div>
  `;
  render(template, app);
}

function renderCaptureTask(app: HTMLElement, task: TaskSummary) {
  const cards = captureCards$.value;
  const selectedIds = captureSelectedIds$.value;

  const template = html`
    <div class="task-page">
      <div class="task-header">
        <input
          type="text"
          .value=${task.title}
          @change=${(e: Event) => updateTaskTitle(task.id, (e.target as HTMLInputElement).value)}
        />
        <span class="task-type-badge">${TASK_TYPE_LABELS[task.type]}</span>
      </div>

      <section class="capture-input">
        <h2>Add references</h2>
        <div class="capture-actions">
          <button
            @click=${() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.multiple = true;
              input.onchange = () => {
                if (input.files) Array.from(input.files).forEach(addReferenceImage);
              };
              input.click();
            }}
          >
            Upload images
          </button>
          <button id="add-text-btn" @click=${() => showTextInput()}>Add text</button>
        </div>
        <div id="text-input-area"></div>
      </section>

      ${selectedIds.length > 0
        ? html`<div class="handoff-section">
            <span>${selectedIds.length} card(s) selected</span>
            <button @click=${handOffSelectedCards}>Hand off to new task</button>
            <button
              @click=${() => {
                captureSelectedIds$.next([]);
                renderApp();
              }}
            >
              Clear selection
            </button>
          </div>`
        : null}
      ${cards.length > 0
        ? html`
            <section>
              <h2>Cards (${cards.length})</h2>
              <div class="capture-cards">
                ${cards.map(
                  (card) => html`
                    <div
                      class="capture-card ${selectedIds.includes(card.id) ? "selected" : ""}"
                      @click=${() => toggleCaptureCardSelection(card.id)}
                    >
                      ${card.image ? html`<img src=${card.image} alt=${card.title} />` : null}
                      <div class="card-title">${card.title}</div>
                      ${card.description ? html`<div class="card-description">${card.description}</div>` : null}
                      <div class="card-actions">
                        <button
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            deleteCaptureCard(card.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  `,
                )}
              </div>
            </section>
          `
        : html`<p>No cards yet. Upload images or add text to get started.</p>`}
    </div>
  `;
  render(template, app);
}

function showTextInput() {
  const area = document.getElementById("text-input-area");
  if (!area) return;
  const template = html`
    <div style="display: flex; flex-direction: column; gap: 1ch;">
      <input id="text-card-title" type="text" placeholder="Title (optional)" />
      <textarea id="text-card-body" placeholder="Enter text..."></textarea>
      <menu>
        <button
          @click=${() => {
            const title = (document.getElementById("text-card-title") as HTMLInputElement)?.value ?? "";
            const body = (document.getElementById("text-card-body") as HTMLTextAreaElement)?.value ?? "";
            if (!title && !body) return;
            addTextCard(title, body);
            render(html``, area);
          }}
        >
          Add card
        </button>
        <button @click=${() => render(html``, area)}>Cancel</button>
      </menu>
    </div>
  `;
  render(template, area);
}

// --- Clipboard paste handler ---

document.addEventListener("paste", (e: ClipboardEvent) => {
  const activeId = activeTaskId$.value;
  if (!activeId) return;
  const task = taskList$.value.find((t) => t.id === activeId);
  if (!task || task.type !== "capture") return;

  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) addReferenceImage(file);
    }
  }
});

// --- Setup dialog ---

useSetupDialog({
  dialogElement: document.getElementById("setup-dialog") as HTMLDialogElement,
  apiKeys$,
});

// --- Header event handlers ---

document.getElementById("tasks-button")!.addEventListener("click", openTaskHub);

// --- Initialization ---

async function init() {
  await loadShellState();
  persistShellState();

  const activeId = activeTaskId$.value;
  if (activeId) {
    await loadTaskData(activeId);
  }

  renderApp();

  // Show task hub on first visit
  if (taskList$.value.length === 0) {
    openTaskHub();
  }
}

init();
