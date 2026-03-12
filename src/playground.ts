import { GoogleGenAI, type Content } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, firstValueFrom, map, skip } from "rxjs";
import { CanvasComponent } from "./components/canvas/canvas.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { useSetupDialog } from "./components/connections/use-setup-dialog";
import { generateImage } from "./components/design/generate-image-gemini";
import { colors } from "./components/material-library/colors";
import { materials } from "./components/material-library/materials";
import { genericInteractionOptions, mechanisms } from "./components/material-library/mechanisms";
import { shapes } from "./components/material-library/shapes";
import { clearPersistenceExcept, persistSubject } from "./lib/persistence";
import { revise, runScanAI, synthesize } from "./lib/studio-ai";
import { allSurfaceOptions } from "./lib/studio-utils";
import {
  cloneCardsForTask,
  createTask,
  duplicateTask,
  getCompatibleSurfaceOptions,
  getSelectedCards,
  makeId,
  mergeCardsIntoTask,
  normalizeCard,
  summarizeTask,
  taskTemplates,
  toggleAttributeCard,
  type PendingImport,
  type PlaygroundCard,
  type PlaygroundImageOutput,
  type PlaygroundTask,
  type PlaygroundTaskTypeId,
} from "./playground-state";
import { createComponent } from "./sdk/create-component";
import "./playground.css";

const appElement = document.getElementById("app") as HTMLElement;
const taskHubDialog = document.getElementById("task-hub-dialog") as HTMLDialogElement;
const taskHubContent = taskHubDialog.querySelector(".dialog-content") as HTMLElement;
const setupDialog = document.getElementById("setup-dialog") as HTMLDialogElement;

const tasks$ = new BehaviorSubject<PlaygroundTask[]>([]);
const activeTaskId$ = new BehaviorSubject<string | null>(null);
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
const toast$ = new BehaviorSubject<{ id: string; tone: "info" | "error"; message: string } | null>(null);
const taskHubMode$ = new BehaviorSubject<"create" | "switch" | "handoff">("create");
const activeBoardCards$ = new BehaviorSubject<PlaygroundCard[]>([]);
const boardApiKeys$ = new BehaviorSubject<ApiKeys>({});

const persistenceReady = Promise.all([
  persistSubject(tasks$, "playground:tasks"),
  persistSubject(activeTaskId$, "playground:activeTaskId"),
]);

useSetupDialog({
  dialogElement: setupDialog,
  apiKeys$,
});

let toastTimer = 0;
let syncingBoardCards = false;

combineLatest([tasks$, activeTaskId$]).subscribe(([tasks, activeTaskId]) => {
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  syncingBoardCards = true;
  activeBoardCards$.next(activeTask?.cards.map(normalizeCard) ?? []);
  syncingBoardCards = false;

  if (!activeTask && tasks.length > 0) {
    activeTaskId$.next(tasks[0].id);
  }

  renderTaskHubDialog();
});

activeBoardCards$.pipe(skip(1)).subscribe((cards) => {
  if (syncingBoardCards) return;
  const activeTaskId = activeTaskId$.value;
  if (!activeTaskId) return;

  updateTask(activeTaskId, (task) => ({
    ...task,
    cards: cards.map(normalizeCard),
    selectionIds: cards.filter((card) => card.isSelected).map((card) => card.id),
  }));
});

taskHubMode$.subscribe(() => {
  renderTaskHubDialog();
});

taskHubDialog.addEventListener("close", () => {
  if (!activeTaskId$.value) {
    queueMicrotask(() => {
      if (!taskHubDialog.open) taskHubDialog.showModal();
    });
  }
});

function getActiveTask(): PlaygroundTask | null {
  const activeTaskId = activeTaskId$.value;
  return tasks$.value.find((task) => task.id === activeTaskId) ?? null;
}

function updateTask(taskId: string, updater: (task: PlaygroundTask) => PlaygroundTask) {
  tasks$.next(
    tasks$.value.map((task) => {
      if (task.id !== taskId) return task;
      const updatedTask = updater(task);
      return {
        ...updatedTask,
        updatedAt: Date.now(),
      };
    }),
  );
}

function updateActiveTask(updater: (task: PlaygroundTask) => PlaygroundTask) {
  const activeTask = getActiveTask();
  if (!activeTask) return;
  updateTask(activeTask.id, updater);
}

function setToast(message: string, tone: "info" | "error" = "info") {
  const toast = { id: makeId("toast"), tone, message };
  toast$.next(toast);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toast$.value?.id === toast.id) toast$.next(null);
  }, 4000);
}

function openTaskHub(mode: "create" | "switch" | "handoff") {
  taskHubMode$.next(mode);
  renderTaskHubDialog();
  if (!taskHubDialog.open) taskHubDialog.showModal();
}

function closeTaskHub() {
  if (taskHubDialog.open) taskHubDialog.close();
}

function createTaskAndSwitch(taskTypeId: PlaygroundTaskTypeId, seedCards: PlaygroundCard[] = []) {
  const task = createTask(taskTypeId, { seedCards });
  tasks$.next([...tasks$.value, task]);
  activeTaskId$.next(task.id);
  closeTaskHub();
}

function switchTask(taskId: string) {
  activeTaskId$.next(taskId);
  closeTaskHub();
}

function deleteTask(taskId: string) {
  const remainingTasks = tasks$.value.filter((task) => task.id !== taskId);
  tasks$.next(remainingTasks);

  if (activeTaskId$.value === taskId) {
    activeTaskId$.next(remainingTasks[0]?.id ?? null);
  }

  if (remainingTasks.length === 0) {
    openTaskHub("create");
  }
}

function duplicateTaskById(taskId: string) {
  const task = tasks$.value.find((item) => item.id === taskId);
  if (!task) return;
  const duplicate = duplicateTask(task);
  tasks$.next([...tasks$.value, duplicate]);
  activeTaskId$.next(duplicate.id);
  closeTaskHub();
}

function handOffSelectionToTask(targetTaskId: string) {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  const selectedCards = getSelectedCards(activeTask);
  if (selectedCards.length === 0) {
    setToast("Select one or more cards before handing them off.", "error");
    return;
  }

  updateTask(targetTaskId, (task) =>
    mergeCardsIntoTask(task, cloneCardsForTask(selectedCards, activeTask.id, targetTaskId)),
  );

  setToast("Selected cards were handed off to the chosen task.");
  closeTaskHub();
}

function createTaskFromSelection(taskTypeId: PlaygroundTaskTypeId) {
  const activeTask = getActiveTask();
  const selectedCards = activeTask ? getSelectedCards(activeTask) : [];
  createTaskAndSwitch(
    taskTypeId,
    activeTask ? cloneCardsForTask(selectedCards, activeTask.id, "pending-target") : selectedCards,
  );
}

function renderTaskHubDialog() {
  const activeTask = getActiveTask();
  const selectedCards = activeTask ? getSelectedCards(activeTask) : [];
  const mode = taskHubMode$.value;
  const canClose = !!activeTaskId$.value;

  const template = html`
    <div class="dialog-header">
      <div class="dialog-heading">
        <h2>
          ${mode === "handoff"
            ? "Hand off selected cards"
            : mode === "switch"
              ? "Task hub"
              : "Create a task"}
        </h2>
        <p>
          ${mode === "handoff"
            ? `${selectedCards.length} selected card${selectedCards.length === 1 ? "" : "s"} ready to seed another task.`
            : "Create, resume, duplicate, or switch between resumable tasks."}
        </p>
      </div>
      <button ?disabled=${!canClose} @click=${closeTaskHub}>Close</button>
    </div>

    <section class="hub-section">
      <h3>New task</h3>
      <div class="hub-grid">
        ${taskTemplates.map(
          (template) => html`
            <button
              class="hub-card"
              @click=${() =>
                mode === "handoff" && selectedCards.length > 0
                  ? createTaskAndSwitch(template.id, cloneCardsForTask(selectedCards, activeTask!.id, "pending-target"))
                  : createTaskAndSwitch(template.id)}
            >
              <strong>${template.label}</strong>
              <span>${template.taskClass}</span>
              <p>${template.summary}</p>
            </button>
          `,
        )}
      </div>
    </section>

    <section class="hub-section">
      <h3>Existing tasks</h3>
      <div class="hub-list">
        ${tasks$.value.length === 0
          ? html`<p>No tasks yet. Create one to begin.</p>`
          : tasks$.value.map(
              (task) => html`
                <div class="task-row ${task.id === activeTaskId$.value ? "active" : ""}">
                  <div class="task-row-main">
                    <strong>${task.title}</strong>
                    <small>${task.taskClass} · ${task.taskTypeId}</small>
                    <small>${new Date(task.updatedAt).toLocaleString()}</small>
                    <p>${summarizeTask(task)}</p>
                  </div>
                  <div class="task-row-actions">
                    ${mode === "handoff" && task.id !== activeTask?.id
                      ? html`
                          <button ?disabled=${selectedCards.length === 0} @click=${() => handOffSelectionToTask(task.id)}>
                            Seed here
                          </button>
                        `
                      : html`<button @click=${() => switchTask(task.id)}>Open</button>`}
                    <button @click=${() => duplicateTaskById(task.id)}>Duplicate</button>
                    <button @click=${() => deleteTask(task.id)}>Delete</button>
                  </div>
                </div>
              `,
            )}
      </div>
    </section>
  `;

  render(template, taskHubContent);
}

function updateTaskUi(patch: Partial<PlaygroundTask["ui"]>) {
  updateActiveTask((task) => ({
    ...task,
    ui: {
      ...task.ui,
      ...patch,
    },
  }));
}

async function filesToPendingImports(
  files: FileList | File[],
  source: PendingImport["source"],
): Promise<PendingImport[]> {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<PendingImport>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: makeId("pending"),
              source,
              name: file.name || "Image",
              image: String(reader.result),
              createdAt: Date.now(),
            });
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

async function readClipboardImports(source: PendingImport["source"]) {
  if (!navigator.clipboard?.read) {
    setToast("Clipboard image reading is not available in this browser.", "error");
    return [];
  }

  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];

    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          files.push(new File([blob], `clipboard.${type.split("/")[1] || "png"}`, { type }));
        }
      }
    }

    if (files.length === 0) {
      setToast("Clipboard does not currently contain an image.", "error");
      return [];
    }

    return filesToPendingImports(files, source);
  } catch (error) {
    setToast(error instanceof Error ? error.message : "Failed to read clipboard.", "error");
    return [];
  }
}

function nextCardPosition(cards: PlaygroundCard[]) {
  const count = cards.length;
  return {
    x: 48 + (count % 4) * 232,
    y: 48 + Math.floor(count / 4) * 332,
    width: 200,
    height: 280,
    zIndex: count + 1,
  };
}

function buildCard(
  task: PlaygroundTask,
  card: Partial<PlaygroundCard> & Pick<PlaygroundCard, "title" | "description" | "imagePrompt" | "image">,
): PlaygroundCard {
  return normalizeCard({
    id: makeId("card"),
    metadata: {
      sourceTaskId: task.id,
      ...card.metadata,
    },
    ...nextCardPosition(task.cards),
    ...card,
  });
}

function commitPendingReferenceImports() {
  const task = getActiveTask();
  if (!task || task.ui.pendingReferenceImports.length === 0) return;

  const cards = task.ui.pendingReferenceImports.map((pending) =>
    buildCard(task, {
      title: pending.name.replace(/\.[^.]+$/, "") || "Reference",
      description: `Reference image imported from ${pending.source.replace("-", " ")}.`,
      imagePrompt: "",
      image: pending.image,
      metadata: {
        cardType: "reference",
        source: pending.source,
      },
    }),
  );

  updateActiveTask((currentTask) => ({
    ...mergeCardsIntoTask(currentTask, cards),
    ui: {
      ...currentTask.ui,
      pendingReferenceImports: [],
    },
  }));
}

function removePendingImport(kind: "pendingReferenceImports" | "pendingScanImports", id: string) {
  const task = getActiveTask();
  if (!task) return;

  updateTaskUi({
    [kind]: task.ui[kind].filter((item) => item.id !== id),
  });
}

async function appendPendingImports(kind: "pendingReferenceImports" | "pendingScanImports", files: FileList | File[], source: PendingImport["source"]) {
  const task = getActiveTask();
  if (!task) return;

  try {
    const pending = await filesToPendingImports(files, source);
    updateTaskUi({
      [kind]: [...task.ui[kind], ...pending],
    });
  } catch (error) {
    setToast(error instanceof Error ? error.message : "Failed to read image files.", "error");
  }
}

async function appendClipboardImports(kind: "pendingReferenceImports" | "pendingScanImports", source: PendingImport["source"]) {
  const task = getActiveTask();
  if (!task) return;

  const pending = await readClipboardImports(source);
  if (pending.length === 0) return;

  updateTaskUi({
    [kind]: [...task.ui[kind], ...pending],
  });
}

function addTextCard() {
  const task = getActiveTask();
  if (!task) return;

  const text = task.ui.textDraft.trim();
  if (!text) {
    setToast("Write some inspiration text before adding a card.", "error");
    return;
  }

  const titleOnly = text.length <= 60 && !text.includes("\n");
  const title = titleOnly ? text : text.split("\n")[0].slice(0, 60).trim() || "Text inspiration";
  const description = titleOnly ? "" : text;

  updateActiveTask((currentTask) => ({
    ...mergeCardsIntoTask(currentTask, [
      buildCard(currentTask, {
        title,
        description,
        imagePrompt: "",
        image: "",
        metadata: {
          cardType: "text",
        },
      }),
    ]),
    ui: {
      ...currentTask.ui,
      textDraft: "",
    },
  }));
}

async function scanPendingPhotos() {
  const task = getActiveTask();
  if (!task) return;

  const pendingItems = task.ui.pendingScanImports;
  if (pendingItems.length === 0) return;

  const scanCards = pendingItems.map((pending) =>
    buildCard(task, {
      title: pending.name.replace(/\.[^.]+$/, "") || "Scanned photo",
      description: "Scanning product photo for packaging attributes.",
      imagePrompt: "",
      image: pending.image,
      metadata: {
        cardType: "reference",
        source: pending.source,
        scanState: "running",
      },
    }),
  );

  updateActiveTask((currentTask) => ({
    ...mergeCardsIntoTask(currentTask, scanCards),
    ui: {
      ...currentTask.ui,
      pendingScanImports: [],
    },
  }));

  for (const [index, pending] of pendingItems.entries()) {
    const sourceCard = scanCards[index];
    void runSingleScan(sourceCard.id, pending.image);
  }
}

async function runSingleScan(sourceCardId: string, image: string) {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  const scannedPhotos$ = new BehaviorSubject([
    {
      id: sourceCardId,
      thumbnailUrl: image,
      fullDataUrl: image,
      label: "scanning...",
      isScanning: true,
    },
  ]);

  const subscription = scannedPhotos$.pipe(skip(1)).subscribe((photos) => {
    const current = photos[0];
    updateActiveTask((task) => ({
      ...task,
      cards: task.cards.map((card) =>
        card.id === sourceCardId
          ? normalizeCard({
              ...card,
              description: current?.label === "Scan failed" ? "Scan failed. Retry by scanning the photo again." : card.description,
              metadata: {
                ...card.metadata,
                scanState: current?.isScanning ? "running" : current?.label === "Scan failed" ? "failed" : "complete",
              },
            })
          : card,
      ),
    }));
  });

  const result = await runScanAI(scannedPhotos$.value[0], scannedPhotos$);
  subscription.unsubscribe();

  if (!result) {
    setToast("Scan failed. Check the Gemini connection and try again.", "error");
    return;
  }

  updateActiveTask((task) => {
    const sourceCard = task.cards.find((card) => card.id === sourceCardId);
    if (!sourceCard) return task;

    const nextTask = {
      ...task,
      cards: task.cards.map((card) =>
        card.id === sourceCardId
          ? normalizeCard({
              ...card,
              description: "Scanned product photo with inferred packaging attributes.",
              metadata: {
                ...card.metadata,
                scanState: "complete",
                scanResult: result,
              },
            })
          : card,
      ),
    };

    const attributeCards = [
      ...result.shapes.map((shapeId) => {
        const item = shapes.find((shape) => shape.id === shapeId);
        return item
          ? buildCard(nextTask, {
              title: item.name,
              description: item.description,
              imagePrompt: "",
              image: "",
              metadata: {
                cardType: "attribute",
                attributeGroup: "shapes",
                attributeValue: item.id,
                sourceProvenance: sourceCardId,
              },
            })
          : null;
      }),
      ...result.materials.map((materialId) => {
        const item = materials.find((material) => material.id === materialId);
        return item
          ? buildCard(nextTask, {
              title: item.name,
              description: item.visual,
              imagePrompt: "",
              image: "",
              metadata: {
                cardType: "attribute",
                attributeGroup: "materials",
                attributeValue: item.id,
                sourceProvenance: sourceCardId,
              },
            })
          : null;
      }),
      ...result.mechanisms.map((mechanismId) => {
        const item = mechanisms.find((mechanism) => mechanism.id === mechanismId);
        return item
          ? buildCard(nextTask, {
              title: item.name,
              description: item.interaction,
              imagePrompt: "",
              image: "",
              metadata: {
                cardType: "attribute",
                attributeGroup: "mechanisms",
                attributeValue: item.id,
                sourceProvenance: sourceCardId,
              },
            })
          : null;
      }),
      ...result.colors.map((colorName) => {
        const item = colors.find((color) => color.name === colorName);
        return item
          ? buildCard(nextTask, {
              title: item.name,
              description: `${item.description} ${item.hex}`,
              imagePrompt: "",
              image: "",
              metadata: {
                cardType: "attribute",
                attributeGroup: "colors",
                attributeValue: item.name,
                sourceProvenance: sourceCardId,
              },
            })
          : null;
      }),
    ].filter((card): card is PlaygroundCard => card !== null);

    return mergeCardsIntoTask(nextTask, attributeCards);
  });
}

function getSelectedPromptSource(task: PlaygroundTask) {
  const selected = getSelectedCards(task);
  return (
    selected.find((card) => card.metadata.cardType === "scene") ??
    selected.find((card) => card.metadata.cardType === "prompt") ??
    task.cards.findLast((card) => card.metadata.cardType === "scene") ??
    task.cards.findLast((card) => card.metadata.cardType === "prompt") ??
    null
  );
}

function collectSynthesisSelections(task: PlaygroundTask) {
  const selectedCards = getSelectedCards(task);
  const selectedAttributes = selectedCards.filter((card) => card.metadata.cardType === "attribute");
  const references = selectedCards.filter((card) => card.metadata.cardType === "reference" && card.image);

  return {
    pickedColors: selectedAttributes
      .filter((card) => card.metadata.attributeGroup === "colors")
      .map((card) => String(card.metadata.attributeValue)),
    pickedMaterials: selectedAttributes
      .filter((card) => card.metadata.attributeGroup === "materials")
      .map((card) => String(card.metadata.attributeValue)),
    pickedSurfaceOptions: selectedAttributes
      .filter((card) => card.metadata.attributeGroup === "surfaceOptions")
      .map((card) => String(card.metadata.attributeValue)),
    pickedMechanisms: selectedAttributes
      .filter((card) => card.metadata.attributeGroup === "mechanisms")
      .map((card) => String(card.metadata.attributeValue)),
    pickedShapes: selectedAttributes
      .filter((card) => card.metadata.attributeGroup === "shapes")
      .map((card) => String(card.metadata.attributeValue)),
    scannedPhotos: references.map((card) => ({
      id: card.id,
      thumbnailUrl: card.image,
      fullDataUrl: card.image,
      label: card.title,
      isScanning: false,
    })),
  };
}

async function synthesizePromptCard() {
  const task = getActiveTask();
  if (!task) return;

  const selections = collectSynthesisSelections(task);
  const hasSelection =
    selections.pickedColors.length +
      selections.pickedMaterials.length +
      selections.pickedSurfaceOptions.length +
      selections.pickedMechanisms.length +
      selections.pickedShapes.length >
    0;

  if (!hasSelection) {
    setToast("Select attribute cards before synthesizing a prompt.", "error");
    return;
  }

  const synthesisOutput$ = new BehaviorSubject(task.ui.draftPrompt);
  const isSynthesizing$ = new BehaviorSubject(task.isSynthesizing);
  const conversationHistory$ = new BehaviorSubject(task.conversationHistory);

  const subscriptions = [
    synthesisOutput$.pipe(skip(1)).subscribe((draftPrompt) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        ui: {
          ...currentTask.ui,
          draftPrompt,
        },
      }));
    }),
    isSynthesizing$.pipe(skip(1)).subscribe((isSynthesizing) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        isSynthesizing,
      }));
    }),
    conversationHistory$.pipe(skip(1)).subscribe((conversationHistory) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        conversationHistory,
      }));
    }),
  ];

  await synthesize({
    ...selections,
    customInstructions: task.ui.customInstructions,
    synthesisOutput$,
    isSynthesizing$,
    conversationHistory$,
  });

  for (const subscription of subscriptions) subscription.unsubscribe();

  const finalPrompt = synthesisOutput$.value.trim();
  if (!finalPrompt || finalPrompt.startsWith("Error:")) {
    if (finalPrompt.startsWith("Error:")) setToast(finalPrompt, "error");
    return;
  }

  updateActiveTask((currentTask) =>
    mergeCardsIntoTask(currentTask, [
      buildCard(currentTask, {
        title: `Prompt ${currentTask.cards.filter((card) => card.metadata.cardType === "prompt").length + 1}`,
        description: finalPrompt,
        imagePrompt: "",
        image: "",
        metadata: {
          cardType: "prompt",
          selectedSourceCardIds: getSelectedCards(currentTask).map((card) => card.id),
        },
      }),
    ]),
  );
}

async function revisePromptCard() {
  const task = getActiveTask();
  if (!task) return;

  if (!task.ui.editInstructions.trim()) {
    setToast("Write revision instructions before revising the prompt.", "error");
    return;
  }

  if (task.conversationHistory.length === 0) {
    setToast("Synthesize a prompt in this task before revising it.", "error");
    return;
  }

  const synthesisOutput$ = new BehaviorSubject(task.ui.draftPrompt);
  const isSynthesizing$ = new BehaviorSubject(task.isSynthesizing);
  const conversationHistory$ = new BehaviorSubject(task.conversationHistory);
  const editInstructions$ = new BehaviorSubject(task.ui.editInstructions);

  const subscriptions = [
    synthesisOutput$.pipe(skip(1)).subscribe((draftPrompt) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        ui: {
          ...currentTask.ui,
          draftPrompt,
        },
      }));
    }),
    isSynthesizing$.pipe(skip(1)).subscribe((isSynthesizing) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        isSynthesizing,
      }));
    }),
    conversationHistory$.pipe(skip(1)).subscribe((conversationHistory) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        conversationHistory,
      }));
    }),
    editInstructions$.pipe(skip(1)).subscribe((editInstructions) => {
      updateActiveTask((currentTask) => ({
        ...currentTask,
        ui: {
          ...currentTask.ui,
          editInstructions,
        },
      }));
    }),
  ];

  await revise({
    editInstructions: task.ui.editInstructions,
    synthesisOutput$,
    isSynthesizing$,
    conversationHistory$,
    editInstructions$,
  });

  for (const subscription of subscriptions) subscription.unsubscribe();

  const finalPrompt = synthesisOutput$.value.trim();
  if (!finalPrompt || finalPrompt.startsWith("Error:")) {
    if (finalPrompt.startsWith("Error:")) setToast(finalPrompt, "error");
    return;
  }

  updateActiveTask((currentTask) =>
    mergeCardsIntoTask(currentTask, [
      buildCard(currentTask, {
        title: `Prompt ${currentTask.cards.filter((card) => card.metadata.cardType === "prompt").length + 1}`,
        description: finalPrompt,
        imagePrompt: "",
        image: "",
        metadata: {
          cardType: "prompt",
          revisedFromPromptId: getSelectedPromptSource(currentTask)?.id ?? null,
        },
      }),
    ]),
  );
}

async function generateSceneXml(baseXml: string, scene: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const promptText = `Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.

Current XML:
${baseXml}

Photo scene: ${scene}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      thinkingConfig: { thinkingBudget: 0 },
    },
    contents: [{ role: "user", parts: [{ text: promptText }] }],
  });

  return response.text?.trim() || "";
}

async function stageSceneCard() {
  const task = getActiveTask();
  if (!task) return;

  const promptCard = getSelectedPromptSource(task);
  if (!promptCard || typeof promptCard.description !== "string" || !promptCard.description.trim()) {
    setToast("Select a prompt or scene card before staging a scene.", "error");
    return;
  }

  const sceneInstructions = task.ui.sceneInstructions.trim();
  if (!sceneInstructions) {
    setToast("Write a scene instruction before staging.", "error");
    return;
  }

  const apiKey = apiKeys$.value.gemini;
  if (!apiKey) {
    setToast("Gemini API key not configured. Use Connections to add it.", "error");
    return;
  }

  updateActiveTask((currentTask) => ({
    ...currentTask,
    isStagingScene: true,
  }));

  try {
    const sceneXml = await generateSceneXml(promptCard.description, sceneInstructions, apiKey);
    updateActiveTask((currentTask) => ({
      ...mergeCardsIntoTask(currentTask, [
        buildCard(currentTask, {
          title: `Scene ${currentTask.cards.filter((card) => card.metadata.cardType === "scene").length + 1}`,
          description: sceneXml,
          imagePrompt: "",
          image: "",
          metadata: {
            cardType: "scene",
            sourcePromptCardId: promptCard.id,
            sceneType: sceneInstructions,
          },
        }),
      ]),
      isStagingScene: false,
    }));
  } catch (error) {
    updateActiveTask((currentTask) => ({
      ...currentTask,
      isStagingScene: false,
    }));
    setToast(error instanceof Error ? error.message : "Failed to stage scene.", "error");
  }
}

function updateImageOutput(outputId: string, updater: (output: PlaygroundImageOutput) => PlaygroundImageOutput) {
  updateActiveTask((task) => ({
    ...task,
    imageOutputs: task.imageOutputs.map((output) => (output.id === outputId ? updater(output) : output)),
  }));
}

async function generateSingleImageOutput(outputId: string, prompt: string) {
  const apiKey = apiKeys$.value.gemini;
  if (!apiKey) {
    updateImageOutput(outputId, (output) => ({
      ...output,
      status: "error",
      error: "Gemini API key not configured.",
    }));
    return;
  }

  try {
    const result = await firstValueFrom(
      generateImage(
        { apiKey },
        {
          prompt,
          width: 540,
          height: 960,
          aspectRatio: "9:16",
        },
      ),
    );

    updateImageOutput(outputId, (output) => ({
      ...output,
      image: result.url,
      status: "success",
      error: undefined,
      metadata: {
        ...output.metadata,
        generatedAt: Date.now(),
      },
    }));
  } catch (error) {
    updateImageOutput(outputId, (output) => ({
      ...output,
      status: "error",
      error: error instanceof Error ? error.message : "Image generation failed.",
    }));
  }
}

function generateImageOutputs() {
  const task = getActiveTask();
  if (!task) return;

  const selected = getSelectedCards(task).filter(
    (card) => card.metadata.cardType === "scene" || card.metadata.cardType === "prompt",
  );
  const sources = selected.length > 0 ? selected : [getSelectedPromptSource(task)].filter((card): card is PlaygroundCard => !!card);

  if (sources.length === 0) {
    setToast("Select a prompt or scene card before generating images.", "error");
    return;
  }

  const outputs = sources.map((source, index) => ({
    id: makeId(`output-${index}`),
    title: `Render ${task.imageOutputs.length + index + 1}`,
    description: source.title,
    imagePrompt: source.description,
    image: "",
    metadata: {
      cardType: "image",
      sourceCardId: source.id,
      promptArtifact: source.description,
    },
    status: "loading" as const,
    createdAt: Date.now(),
  }));

  updateActiveTask((currentTask) => ({
    ...currentTask,
    imageOutputs: [...outputs, ...currentTask.imageOutputs],
  }));

  for (const output of outputs) {
    void generateSingleImageOutput(output.id, output.imagePrompt);
  }
}

function clearTaskInputs() {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  updateTask(activeTask.id, (task) => ({
    ...task,
    ui: {
      ...task.ui,
      textDraft: "",
      customInstructions: "",
      editInstructions: "",
      sceneInstructions: "",
      draftPrompt: "",
      pendingReferenceImports: [],
      pendingScanImports: [],
    },
    cards: [],
    selectionIds: [],
    imageOutputs: [],
    conversationHistory: [],
    isSynthesizing: false,
    isStagingScene: false,
  }));

  void clearPersistenceExcept(["playground:tasks", "playground:activeTaskId"]);
}

async function copyText(text: string, label: string) {
  if (!text.trim()) {
    setToast(`There is no ${label.toLowerCase()} to copy.`, "error");
    return;
  }

  if (!navigator.clipboard?.writeText) {
    setToast("Clipboard writing is not available in this browser.", "error");
    return;
  }

  await navigator.clipboard.writeText(text);
  setToast(`${label} copied.`);
}

function removeImageOutput(outputId: string) {
  updateActiveTask((task) => ({
    ...task,
    imageOutputs: task.imageOutputs.filter((output) => output.id !== outputId),
  }));
}

function renderPendingImports(task: PlaygroundTask, kind: "pendingReferenceImports" | "pendingScanImports") {
  const pending = task.ui[kind];
  if (pending.length === 0) return html`<p class="secondary">No pending images.</p>`;

  return html`
    <div class="pending-grid">
      ${pending.map(
        (item) => html`
          <figure class="pending-card">
            <img src=${item.image} alt=${item.name} />
            <figcaption>${item.name}</figcaption>
            <button @click=${() => removePendingImport(kind, item.id)}>Remove</button>
          </figure>
        `,
      )}
    </div>
  `;
}

function renderLibraryGroup(task: PlaygroundTask, config: {
  title: string;
  group: "shapes" | "materials" | "surfaceOptions" | "mechanisms" | "colors";
  items: Array<{ value: string; title: string; description: string; swatch?: string }>;
  dimmedValues?: string[];
}) {
  const selectedValues = task.cards
    .filter((card) => card.metadata.cardType === "attribute" && card.metadata.attributeGroup === config.group)
    .map((card) => String(card.metadata.attributeValue));
  const filter = task.ui.libraryFilter.toLowerCase();
  const filteredItems = config.items.filter(
    (item) =>
      item.title.toLowerCase().includes(filter) ||
      item.description.toLowerCase().includes(filter) ||
      item.value.toLowerCase().includes(filter),
  );

  return html`
    <section class="subsection">
      <div class="subsection-header">
        <h3>${config.title}</h3>
      </div>
      <div class="chip-grid">
        ${filteredItems.map(
          (item) => html`
            <button
              class="chip-button ${selectedValues.includes(item.value) ? "selected" : ""} ${config.dimmedValues?.includes(item.value)
                ? "dimmed"
                : ""}"
              title=${item.description}
              @click=${() =>
                updateActiveTask((currentTask) =>
                  toggleAttributeCard(currentTask, {
                    group: config.group,
                    value: item.value,
                    title: item.title,
                    description: item.description,
                  }),
                )}
            >
              ${item.swatch ? html`<span class="swatch" style="background:${item.swatch}"></span>` : null}
              <span>${item.title}</span>
            </button>
          `,
        )}
      </div>
    </section>
  `;
}

function renderPromptInspection(task: PlaygroundTask) {
  const selectedPromptSource = getSelectedPromptSource(task);
  const promptText = selectedPromptSource?.description || task.ui.draftPrompt;

  return html`
    <section class="section">
      <div class="section-header">
        <h2>Prompt inspection</h2>
        <p>Prompt-like outputs stay selectable and copyable across synthesis, revision, and scene staging.</p>
      </div>
      <div class="inspection">
        <div class="inspection-header">
          <strong>${selectedPromptSource?.title || "Current prompt draft"}</strong>
          <button @click=${() => void copyText(promptText, "Prompt text")}>Copy</button>
        </div>
        <textarea rows="10" readonly .value=${promptText}></textarea>
      </div>
    </section>
  `;
}

const Main = createComponent(() =>
  combineLatest([tasks$, activeTaskId$, toast$]).pipe(
    map(([_tasks, activeTaskId, toast]) => {
      const task = getActiveTask();
      if (!task || !activeTaskId) {
        return html`
          <main class="playground-shell">
            <section class="section">
              <div class="section-header">
                <h1>Playground</h1>
                <p>Pick a task to start building reference cards, prompt cards, and image outputs.</p>
              </div>
              <menu>
                <button @click=${() => openTaskHub("create")}>Open task hub</button>
              </menu>
            </section>
          </main>
        `;
      }

      const compatibleSurfaces = getCompatibleSurfaceOptions(task);
      const selectedMechanisms = task.cards
        .filter((card) => card.metadata.cardType === "attribute" && card.metadata.attributeGroup === "mechanisms")
        .map((card) => String(card.metadata.attributeValue));
      const sceneSuggestions = Array.from(
        new Set([
          ...genericInteractionOptions,
          ...mechanisms
            .filter((mechanism) => selectedMechanisms.includes(mechanism.id))
            .flatMap((mechanism) => mechanism.interactionOptions),
        ]),
      );

      return html`
        <main class="playground-shell">
          ${toast
            ? html`<div class="toast ${toast.tone}" role="status" aria-live="polite">${toast.message}</div>`
            : null}

          <header class="task-header section">
            <div class="task-heading">
              <label for="task-title">Task header</label>
              <input
                id="task-title"
                type="text"
                .value=${task.title}
                @input=${(event: Event) =>
                  updateActiveTask((currentTask) => ({
                    ...currentTask,
                    title: (event.target as HTMLInputElement).value,
                  }))}
              />
              <p>${task.taskClass} · ${task.taskTypeId} · Updated ${new Date(task.updatedAt).toLocaleString()}</p>
              <p>${summarizeTask(task)}</p>
            </div>
            <menu class="task-actions">
              <button @click=${() => openTaskHub("switch")}>Tasks</button>
              <button @click=${() => openTaskHub("handoff")}>Hand off selected</button>
              <button commandfor="setup-dialog" command="show-modal">Connections</button>
              <button @click=${clearTaskInputs}>Clear task</button>
            </menu>
          </header>

          <section class="section">
            <div class="section-header">
              <h2>Input area</h2>
              <p>Capture references, write text, choose attribute cards, and scan product photos.</p>
            </div>

            <div class="subsection-grid">
              <section class="subsection">
                <div class="subsection-header">
                  <h3>Capture reference material</h3>
                  <p>Upload files, capture from camera, or paste images from clipboard before committing them as cards.</p>
                </div>
                <menu>
                  <label class="button-like">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      @change=${(event: Event) =>
                        void appendPendingImports(
                          "pendingReferenceImports",
                          (event.target as HTMLInputElement).files ?? [],
                          "upload",
                        )}
                    />
                  </label>
                  <label class="button-like">
                    Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      @change=${(event: Event) =>
                        void appendPendingImports(
                          "pendingReferenceImports",
                          (event.target as HTMLInputElement).files ?? [],
                          "camera",
                        )}
                    />
                  </label>
                  <button @click=${() => void appendClipboardImports("pendingReferenceImports", "clipboard")}>
                    Paste clipboard image
                  </button>
                </menu>
                ${renderPendingImports(task, "pendingReferenceImports")}
                <menu>
                  <button ?disabled=${task.ui.pendingReferenceImports.length === 0} @click=${commitPendingReferenceImports}>
                    Commit reference cards
                  </button>
                </menu>
              </section>

              <section class="subsection">
                <div class="subsection-header">
                  <h3>Write textual inspiration</h3>
                  <p>Local authoring only. No API key is required to create text cards.</p>
                </div>
                <textarea
                  rows="4"
                  .value=${task.ui.textDraft}
                  placeholder="Write notes, intent, labels, or prompt fragments in English."
                  @input=${(event: Event) => updateTaskUi({ textDraft: (event.target as HTMLTextAreaElement).value })}
                ></textarea>
                <menu>
                  <button @click=${addTextCard}>Add text card</button>
                </menu>
              </section>
            </div>

            <div class="subsection-grid">
              <section class="subsection">
                <div class="subsection-header">
                  <h3>Create attribute cards from a library</h3>
                  <p>Filter library items, pick multiple values, and use compatibility hints for surface options.</p>
                </div>
                <input
                  type="search"
                  placeholder="Filter shapes, materials, mechanisms, colors, and surfaces"
                  .value=${task.ui.libraryFilter}
                  @input=${(event: Event) =>
                    updateTaskUi({ libraryFilter: (event.target as HTMLInputElement).value })}
                />
                ${renderLibraryGroup(task, {
                  title: "Shapes",
                  group: "shapes",
                  items: shapes.map((shape) => ({
                    value: shape.id,
                    title: shape.name,
                    description: shape.description,
                  })),
                })}
                ${renderLibraryGroup(task, {
                  title: "Materials",
                  group: "materials",
                  items: materials.map((material) => ({
                    value: material.id,
                    title: material.name,
                    description: material.visual,
                  })),
                })}
                <p class="secondary">
                  ${compatibleSurfaces.length > 0
                    ? `Compatible surface options for the selected materials: ${compatibleSurfaces.join(", ")}.`
                    : "Select materials to reveal compatible surface options."}
                </p>
                ${renderLibraryGroup(task, {
                  title: "Surface options",
                  group: "surfaceOptions",
                  items: allSurfaceOptions.map((surface) => ({
                    value: surface,
                    title: surface,
                    description: "Surface finish option",
                  })),
                  dimmedValues: compatibleSurfaces.length > 0
                    ? allSurfaceOptions.filter((surface) => !compatibleSurfaces.includes(surface))
                    : [],
                })}
                ${renderLibraryGroup(task, {
                  title: "Mechanisms",
                  group: "mechanisms",
                  items: mechanisms.map((mechanism) => ({
                    value: mechanism.id,
                    title: mechanism.name,
                    description: mechanism.interaction,
                  })),
                })}
                ${renderLibraryGroup(task, {
                  title: "Colors",
                  group: "colors",
                  items: colors.map((color) => ({
                    value: color.name,
                    title: color.name,
                    description: color.description,
                    swatch: color.hex,
                  })),
                })}
              </section>

              <section class="subsection">
                <div class="subsection-header">
                  <h3>Scan product photos into attribute cards</h3>
                  <p>Scans preserve the existing Gemini structured output constrained to the known library options.</p>
                </div>
                <menu>
                  <label class="button-like">
                    Upload photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      @change=${(event: Event) =>
                        void appendPendingImports(
                          "pendingScanImports",
                          (event.target as HTMLInputElement).files ?? [],
                          "scan-upload",
                        )}
                    />
                  </label>
                  <label class="button-like">
                    Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      @change=${(event: Event) =>
                        void appendPendingImports(
                          "pendingScanImports",
                          (event.target as HTMLInputElement).files ?? [],
                          "scan-camera",
                        )}
                    />
                  </label>
                  <button @click=${() => void appendClipboardImports("pendingScanImports", "scan-clipboard")}>
                    Paste clipboard image
                  </button>
                </menu>
                ${renderPendingImports(task, "pendingScanImports")}
                <menu>
                  <button ?disabled=${task.ui.pendingScanImports.length === 0} @click=${scanPendingPhotos}>
                    Scan into attribute cards
                  </button>
                </menu>
              </section>
            </div>
          </section>

          <section class="section">
            <div class="section-header">
              <h2>Current card collection</h2>
              <p>
                Click, modifier-select, marquee-select, drag, copy, paste, and delete cards. The layout is persisted per task.
              </p>
            </div>
            <div class="board-status">
              <span>${task.selectionIds.length} selected</span>
              <span>${task.cards.length} total cards</span>
            </div>
            <div class="canvas-area">${CanvasComponent({ items$: activeBoardCards$, apiKeys$: boardApiKeys$ })}</div>
          </section>

          <section class="section">
            <div class="section-header">
              <h2>Transform cards into prompts and scenes</h2>
              <p>Selected attribute cards and reference cards feed synthesis. Prompt and scene cards stay in the board for handoff.</p>
            </div>

            <div class="subsection-grid">
              <section class="subsection">
                <div class="subsection-header">
                  <h3>Synthesize prompt card</h3>
                </div>
                <textarea
                  rows="4"
                  .value=${task.ui.customInstructions}
                  placeholder="Optional custom instructions for the XML prompt."
                  @input=${(event: Event) =>
                    updateTaskUi({ customInstructions: (event.target as HTMLTextAreaElement).value })}
                ></textarea>
                <menu>
                  <button ?disabled=${task.isSynthesizing} @click=${() => void synthesizePromptCard()}>
                    ${task.isSynthesizing ? "Synthesizing..." : "Synthesize prompt"}
                  </button>
                </menu>
              </section>

              <section class="subsection">
                <div class="subsection-header">
                  <h3>Revise prompt card</h3>
                </div>
                <textarea
                  rows="4"
                  .value=${task.ui.editInstructions}
                  placeholder="Improve the current prompt in plain English."
                  @input=${(event: Event) =>
                    updateTaskUi({ editInstructions: (event.target as HTMLTextAreaElement).value })}
                ></textarea>
                <menu>
                  <button ?disabled=${task.isSynthesizing} @click=${() => void revisePromptCard()}>
                    ${task.isSynthesizing ? "Revising..." : "Revise prompt"}
                  </button>
                </menu>
              </section>
            </div>

            <div class="subsection-grid">
              <section class="subsection">
                <div class="subsection-header">
                  <h3>Stage scene cards</h3>
                  <p>Scene suggestions combine generic presets with selected mechanism interaction options.</p>
                </div>
                <div class="suggestion-list">
                  ${sceneSuggestions.map(
                    (suggestion) => html`
                      <button
                        class="suggestion-button"
                        @click=${() =>
                          updateTaskUi({
                            sceneInstructions:
                              task.ui.sceneInstructions.trim().length > 0
                                ? `${task.ui.sceneInstructions}\n${suggestion}`
                                : suggestion,
                          })}
                      >
                        ${suggestion}
                      </button>
                    `,
                  )}
                </div>
                <textarea
                  rows="4"
                  .value=${task.ui.sceneInstructions}
                  placeholder="Describe the desired scene in English."
                  @input=${(event: Event) =>
                    updateTaskUi({ sceneInstructions: (event.target as HTMLTextAreaElement).value })}
                ></textarea>
                <menu>
                  <button ?disabled=${task.isStagingScene} @click=${() => void stageSceneCard()}>
                    ${task.isStagingScene ? "Staging..." : "Stage scene card"}
                  </button>
                </menu>
              </section>

              <section class="subsection">
                <div class="subsection-header">
                  <h3>Generate product image cards</h3>
                  <p>Generate repeated additive runs from selected scene cards or prompt cards without leaving the task.</p>
                </div>
                <menu>
                  <button @click=${generateImageOutputs}>Generate images</button>
                </menu>
              </section>
            </div>
          </section>

          ${renderPromptInspection(task)}

          <section class="section">
            <div class="section-header">
              <h2>Generated outputs</h2>
              <p>Images render as plain images so browser save and copy behavior remains natural.</p>
            </div>
            ${task.imageOutputs.length === 0
              ? html`<p class="secondary">No generated images yet.</p>`
              : html`
                  <div class="output-grid">
                    ${task.imageOutputs.map(
                      (output) => html`
                        <article class="output-card">
                          <div class="output-preview">
                            ${output.image
                              ? html`<img src=${output.image} alt=${output.title} />`
                              : html`<div class="output-placeholder">${output.status === "loading" ? "Generating..." : "No image yet"}</div>`}
                          </div>
                          <div class="output-meta">
                            <strong>${output.title}</strong>
                            <small>${output.description}</small>
                            ${output.error ? html`<p class="error-text">${output.error}</p>` : null}
                            <textarea rows="8" readonly .value=${output.imagePrompt}></textarea>
                            <menu>
                              <button @click=${() => void copyText(output.imagePrompt, "Image prompt")}>Copy prompt</button>
                              <button @click=${() => removeImageOutput(output.id)}>Delete</button>
                            </menu>
                          </div>
                        </article>
                      `,
                    )}
                  </div>
                `}
          </section>

          <section class="section">
            <div class="section-header">
              <h2>Reusable actions</h2>
              <p>Resume work later, seed new tasks from selected cards, and keep everything locally persistent.</p>
            </div>
            <menu>
              <button @click=${() => openTaskHub("create")}>Create task</button>
              <button @click=${() => openTaskHub("switch")}>Switch task</button>
              <button @click=${() => openTaskHub("handoff")}>Hand off selected cards</button>
            </menu>
          </section>
        </main>
      `;
    }),
  ),
);

render(Main(), appElement);

persistenceReady.then(() => {
  const currentActiveTask = getActiveTask();
  if (!currentActiveTask) {
    if (tasks$.value.length > 0) {
      activeTaskId$.next(tasks$.value[0].id);
    } else {
      openTaskHub("create");
    }
  }
});
