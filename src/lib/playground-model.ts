export type TaskClass = "lift" | "transform" | "view";

export type TaskTypeId =
  | "capture-reference"
  | "write-text"
  | "attribute-library"
  | "scan-photos"
  | "synthesize-prompt"
  | "revise-prompt"
  | "stage-scenes"
  | "generate-images"
  | "organize-curate";

export type CardCategory =
  | "reference"
  | "text"
  | "concept"
  | "attribute"
  | "prompt"
  | "scene"
  | "image"
  | "persona"
  | "feedback";

export type AttributeGroup = "shape" | "material" | "surface-option" | "mechanism" | "color";

export interface TaskDefinition {
  id: TaskTypeId;
  title: string;
  taskClass: TaskClass;
  description: string;
}

export interface CardMetadata {
  source: string;
  originatingTaskId: string;
  createdAt: string;
  updatedAt: string;
  promptRevisionHistory: string[];
  structuredAttributes?: Partial<Record<AttributeGroup, string[]>>;
  generationStatus?: "idle" | "running" | "success" | "error";
  libraryReferences?: string[];
  sourceCardIds?: string[];
  sourceCardId?: string;
  importedFromTaskId?: string;
}

export interface PlaygroundCard {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
  image?: string;
  artifact?: string;
  category: CardCategory;
  metadata: CardMetadata;
}

export interface SerializableContentPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

export interface SerializableContent {
  role?: string;
  parts?: SerializableContentPart[];
}

export interface PendingImport {
  id: string;
  title: string;
  image: string;
  source: string;
}

export interface TaskUiState {
  draftText: string;
  libraryFilter: string;
  customInstructions: string;
  revisionInstructions: string;
  sceneInstructions: string;
  promptArtifact: string;
  conversationHistory: SerializableContent[];
  pendingImports: PendingImport[];
  inspectCardId?: string;
}

export interface PlaygroundTask {
  id: string;
  taskTypeId: TaskTypeId;
  title: string;
  createdAt: string;
  updatedAt: string;
  localPersistenceKey: string;
  cards: PlaygroundCard[];
  selectedCardIds: string[];
  ui: TaskUiState;
}

export interface PlaygroundSession {
  tasks: PlaygroundTask[];
  activeTaskId: string | null;
}

export const taskDefinitions: TaskDefinition[] = [
  {
    id: "capture-reference",
    title: "Capture reference material",
    taskClass: "lift",
    description: "Import product references from files, camera captures, or pasted images.",
  },
  {
    id: "write-text",
    title: "Write textual inspiration",
    taskClass: "lift",
    description: "Turn freeform notes and intent into reusable text cards.",
  },
  {
    id: "attribute-library",
    title: "Create attribute cards from a library",
    taskClass: "lift",
    description: "Select shapes, materials, surfaces, mechanisms, and colors as explicit cards.",
  },
  {
    id: "scan-photos",
    title: "Scan product photos into attribute cards",
    taskClass: "lift",
    description: "Use Gemini to infer structured packaging attributes from reference photos.",
  },
  {
    id: "synthesize-prompt",
    title: "Synthesize prompt card",
    taskClass: "transform",
    description: "Build XML prompt cards from selected attributes, references, and instructions.",
  },
  {
    id: "revise-prompt",
    title: "Revise prompt card",
    taskClass: "transform",
    description: "Iterate on prompt cards while preserving the earlier conversation context.",
  },
  {
    id: "stage-scenes",
    title: "Stage scene cards",
    taskClass: "transform",
    description: "Create scene-specific prompt variants from a base prompt card.",
  },
  {
    id: "generate-images",
    title: "Generate product image cards",
    taskClass: "transform",
    description: "Generate additive image outputs from prompt and scene cards.",
  },
  {
    id: "organize-curate",
    title: "Organize and curate cards",
    taskClass: "view",
    description: "Select, reorder, inspect, delete, and hand off cards between tasks.",
  },
];

const taskDefinitionById = new Map(taskDefinitions.map((definition) => [definition.id, definition]));

const defaultTaskUiState = (): TaskUiState => ({
  draftText: "",
  libraryFilter: "",
  customInstructions: "",
  revisionInstructions: "",
  sceneInstructions: "",
  promptArtifact: "",
  conversationHistory: [],
  pendingImports: [],
});

const cloneCard = (card: PlaygroundCard): PlaygroundCard => ({
  ...card,
  metadata: {
    ...card.metadata,
    promptRevisionHistory: [...card.metadata.promptRevisionHistory],
    structuredAttributes: card.metadata.structuredAttributes
      ? Object.fromEntries(
          Object.entries(card.metadata.structuredAttributes).map(([key, values]) => [key, [...(values ?? [])]]),
        )
      : undefined,
    libraryReferences: [...(card.metadata.libraryReferences ?? [])],
    sourceCardIds: [...(card.metadata.sourceCardIds ?? [])],
  },
});

export const createPlaygroundSession = (): PlaygroundSession => ({
  tasks: [],
  activeTaskId: null,
});

export function ensureSession(session: PlaygroundSession): PlaygroundSession {
  if (session.tasks.length === 0) {
    return { tasks: [], activeTaskId: null };
  }

  const activeTaskId = session.tasks.some((task) => task.id === session.activeTaskId)
    ? session.activeTaskId
    : session.tasks[0]?.id ?? null;

  return {
    tasks: session.tasks.map((task) => ({
      ...task,
      selectedCardIds: task.selectedCardIds.filter((cardId) => task.cards.some((card) => card.id === cardId)),
      ui: { ...defaultTaskUiState(), ...task.ui, pendingImports: [...(task.ui.pendingImports ?? [])] },
    })),
    activeTaskId,
  };
}

export function createTask(
  taskTypeId: TaskTypeId,
  now: string,
  createId: () => string,
  seedCards: PlaygroundCard[] = [],
): PlaygroundTask {
  const definition = taskDefinitionById.get(taskTypeId);
  const id = `task-${createId()}`;
  const title = definition ? definition.title : taskTypeId;

  return {
    id,
    taskTypeId,
    title,
    createdAt: now,
    updatedAt: now,
    localPersistenceKey: `playground:${id}`,
    cards: seedCards.map((card) => cloneCard(card)),
    selectedCardIds: [],
    ui: defaultTaskUiState(),
  };
}

export function updateTask(task: PlaygroundTask, now: string, updater: (task: PlaygroundTask) => PlaygroundTask): PlaygroundTask {
  const updatedTask = updater(task);
  return { ...updatedTask, updatedAt: now };
}

export function withSelection(task: PlaygroundTask, cardId: string, mode: "replace" | "toggle" | "add"): PlaygroundTask {
  if (mode === "replace") {
    return { ...task, selectedCardIds: [cardId], ui: { ...task.ui, inspectCardId: cardId } };
  }

  if (mode === "add") {
    return task.selectedCardIds.includes(cardId)
      ? { ...task, ui: { ...task.ui, inspectCardId: cardId } }
      : { ...task, selectedCardIds: [...task.selectedCardIds, cardId], ui: { ...task.ui, inspectCardId: cardId } };
  }

  return {
    ...task,
    selectedCardIds: task.selectedCardIds.includes(cardId)
      ? task.selectedCardIds.filter((selectedId) => selectedId !== cardId)
      : [...task.selectedCardIds, cardId],
    ui: { ...task.ui, inspectCardId: cardId },
  };
}

export function clearSelection(task: PlaygroundTask): PlaygroundTask {
  return { ...task, selectedCardIds: [] };
}

export function addCards(task: PlaygroundTask, cards: PlaygroundCard[]): PlaygroundTask {
  return { ...task, cards: [...cards.map((card) => cloneCard(card)), ...task.cards] };
}

export function deleteSelectedCards(task: PlaygroundTask): PlaygroundTask {
  const selectedIds = new Set(task.selectedCardIds);
  return {
    ...task,
    cards: task.cards.filter((card) => !selectedIds.has(card.id)),
    selectedCardIds: [],
    ui: { ...task.ui, inspectCardId: undefined },
  };
}

export function moveCard(task: PlaygroundTask, draggedCardId: string, targetCardId: string): PlaygroundTask {
  if (draggedCardId === targetCardId) return task;

  const cards = [...task.cards];
  const fromIndex = cards.findIndex((card) => card.id === draggedCardId);
  const toIndex = cards.findIndex((card) => card.id === targetCardId);
  if (fromIndex < 0 || toIndex < 0) return task;

  const [draggedCard] = cards.splice(fromIndex, 1);
  cards.splice(toIndex, 0, draggedCard);
  return { ...task, cards };
}

export function createTextCard(text: string, taskId: string, now: string, createId: () => string): PlaygroundCard {
  const trimmed = text.trim();
  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const title = lines[0] || "Text inspiration";
  const description = lines.length > 1 ? lines.slice(1).join("\n") : lines[0] ?? "";

  return {
    id: `card-${createId()}`,
    title: title.length > 80 ? `${title.slice(0, 77)}...` : title,
    description,
    imagePrompt: trimmed,
    category: "text",
    metadata: {
      source: "text",
      originatingTaskId: taskId,
      createdAt: now,
      updatedAt: now,
      promptRevisionHistory: [],
      generationStatus: "idle",
    },
  };
}

export function createReferenceCard(
  input: PendingImport,
  taskId: string,
  now: string,
  createId: () => string,
): PlaygroundCard {
  return {
    id: `card-${createId()}`,
    title: input.title,
    description: `${input.source} reference`,
    imagePrompt: "",
    image: input.image,
    category: "reference",
    metadata: {
      source: input.source,
      originatingTaskId: taskId,
      createdAt: now,
      updatedAt: now,
      promptRevisionHistory: [],
      generationStatus: "idle",
    },
  };
}

export function createAttributeCard(
  group: AttributeGroup,
  value: { id?: string; name: string; description: string },
  taskId: string,
  now: string,
  createId: () => string,
  sourceCardId?: string,
): PlaygroundCard {
  const structuredAttributes: Partial<Record<AttributeGroup, string[]>> = {
    [group]: [value.id ?? value.name],
  };

  return {
    id: `card-${createId()}`,
    title: value.name,
    description: value.description,
    imagePrompt: value.description,
    category: "attribute",
    metadata: {
      source: group,
      originatingTaskId: taskId,
      createdAt: now,
      updatedAt: now,
      promptRevisionHistory: [],
      structuredAttributes,
      libraryReferences: value.id ? [value.id] : [value.name],
      sourceCardId,
      sourceCardIds: sourceCardId ? [sourceCardId] : undefined,
      generationStatus: "idle",
    },
  };
}

export function createPromptCard(
  params: {
    taskId: string;
    title: string;
    artifact: string;
    category: "prompt" | "scene";
    now: string;
    createId: () => string;
    sourceCardIds?: string[];
    promptRevisionHistory?: string[];
  },
): PlaygroundCard {
  const { taskId, title, artifact, category, now, createId, sourceCardIds = [], promptRevisionHistory = [] } = params;

  return {
    id: `card-${createId()}`,
    title,
    description: category === "scene" ? "Scene-specific prompt artifact" : "Structured prompt artifact",
    imagePrompt: artifact,
    artifact,
    category,
    metadata: {
      source: category,
      originatingTaskId: taskId,
      createdAt: now,
      updatedAt: now,
      promptRevisionHistory,
      sourceCardIds,
      generationStatus: "success",
    },
  };
}

export function createImageCard(
  params: {
    taskId: string;
    title: string;
    prompt: string;
    now: string;
    createId: () => string;
    sourceCardIds?: string[];
  },
): PlaygroundCard {
  const { taskId, title, prompt, now, createId, sourceCardIds = [] } = params;

  return {
    id: `card-${createId()}`,
    title,
    description: "Generated product image",
    imagePrompt: prompt,
    category: "image",
    metadata: {
      source: "image-generation",
      originatingTaskId: taskId,
      createdAt: now,
      updatedAt: now,
      promptRevisionHistory: [],
      sourceCardIds,
      generationStatus: "running",
    },
  };
}

export function cloneCardsForTask(
  cards: PlaygroundCard[],
  destinationTaskId: string,
  now: string,
  createId: () => string,
  importedFromTaskId: string,
): PlaygroundCard[] {
  return cards.map((card) => ({
    ...cloneCard(card),
    id: `card-${createId()}`,
    metadata: {
      ...card.metadata,
      createdAt: now,
      updatedAt: now,
      originatingTaskId: destinationTaskId,
      importedFromTaskId,
      promptRevisionHistory: [...card.metadata.promptRevisionHistory],
      libraryReferences: [...(card.metadata.libraryReferences ?? [])],
      sourceCardIds: [...(card.metadata.sourceCardIds ?? [])],
    },
  }));
}

export function handoffSelectedCards(
  sourceTask: PlaygroundTask,
  destinationTask: PlaygroundTask,
  now: string,
  createId: () => string,
): { sourceTask: PlaygroundTask; destinationTask: PlaygroundTask; transferred: PlaygroundCard[] } {
  const selected = getSelectedCards(sourceTask);
  const transferred = cloneCardsForTask(selected, destinationTask.id, now, createId, sourceTask.id);

  return {
    sourceTask,
    destinationTask: addCards(destinationTask, transferred),
    transferred,
  };
}

export function getSelectedCards(task: PlaygroundTask): PlaygroundCard[] {
  const selectedIds = new Set(task.selectedCardIds);
  return task.cards.filter((card) => selectedIds.has(card.id));
}

export function getInspectableCard(task: PlaygroundTask): PlaygroundCard | undefined {
  const inspectCardId = task.ui.inspectCardId ?? task.selectedCardIds[0];
  return task.cards.find((card) => card.id === inspectCardId) ?? task.cards[0];
}

export function buildTaskStatus(task: PlaygroundTask): string {
  const selectedCount = task.selectedCardIds.length;
  const runningCount = task.cards.filter((card) => card.metadata.generationStatus === "running").length;
  const base = `${task.cards.length} card${task.cards.length === 1 ? "" : "s"}`;

  if (runningCount > 0) {
    return `${base} · ${runningCount} running`;
  }

  if (selectedCount > 0) {
    return `${base} · ${selectedCount} selected`;
  }

  return base;
}

export function getTaskDefinition(taskTypeId: TaskTypeId): TaskDefinition {
  return taskDefinitionById.get(taskTypeId) ?? {
    id: taskTypeId,
    title: taskTypeId,
    taskClass: "view",
    description: "",
  };
}
