import type { Content } from "@google/genai";
import { materialsById } from "./lib/studio-utils";

export type PlaygroundTaskClass = "lift" | "transform" | "view";

export type PlaygroundTaskTypeId =
  | "organize-curate"
  | "capture-reference"
  | "write-inspiration"
  | "attribute-library"
  | "scan-product-photos"
  | "synthesize-prompt"
  | "revise-prompt"
  | "stage-scenes"
  | "generate-images";

export interface PlaygroundTaskTemplate {
  id: PlaygroundTaskTypeId;
  taskClass: PlaygroundTaskClass;
  label: string;
  summary: string;
}

export interface PendingImport {
  id: string;
  source: "upload" | "camera" | "clipboard" | "scan-upload" | "scan-camera" | "scan-clipboard";
  name: string;
  image: string;
  createdAt: number;
}

export interface PlaygroundCard {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
  image: string;
  metadata: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isSelected?: boolean;
  body?: string;
  imageSrc?: string;
}

export interface PlaygroundImageOutput {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
  image: string;
  metadata: Record<string, unknown>;
  status: "idle" | "loading" | "success" | "error";
  error?: string;
  createdAt: number;
}

export interface PlaygroundTaskUiState {
  libraryFilter: string;
  textDraft: string;
  customInstructions: string;
  editInstructions: string;
  sceneInstructions: string;
  draftPrompt: string;
  pendingReferenceImports: PendingImport[];
  pendingScanImports: PendingImport[];
}

export interface PlaygroundTask {
  id: string;
  taskClass: PlaygroundTaskClass;
  taskTypeId: PlaygroundTaskTypeId;
  title: string;
  createdAt: number;
  updatedAt: number;
  persistenceKey: string;
  cards: PlaygroundCard[];
  selectionIds: string[];
  ui: PlaygroundTaskUiState;
  conversationHistory: Content[];
  imageOutputs: PlaygroundImageOutput[];
  isSynthesizing: boolean;
  isStagingScene: boolean;
}

export const taskTemplates: PlaygroundTaskTemplate[] = [
  {
    id: "organize-curate",
    taskClass: "view",
    label: "Organize and curate cards",
    summary: "Arrange, inspect, select, and hand off card collections.",
  },
  {
    id: "capture-reference",
    taskClass: "lift",
    label: "Capture reference material",
    summary: "Import reference images from uploads, camera capture, or clipboard.",
  },
  {
    id: "write-inspiration",
    taskClass: "lift",
    label: "Write textual inspiration",
    summary: "Turn raw design notes into local text cards.",
  },
  {
    id: "attribute-library",
    taskClass: "lift",
    label: "Create attribute cards from a library",
    summary: "Choose packaging-domain ingredients as explicit attribute cards.",
  },
  {
    id: "scan-product-photos",
    taskClass: "lift",
    label: "Scan product photos into attribute cards",
    summary: "Infer shapes, materials, mechanisms, and colors from source photos.",
  },
  {
    id: "synthesize-prompt",
    taskClass: "transform",
    label: "Synthesize prompt card",
    summary: "Build a structured XML prompt from selected cards and instructions.",
  },
  {
    id: "revise-prompt",
    taskClass: "transform",
    label: "Revise prompt card",
    summary: "Improve the current prompt without starting over.",
  },
  {
    id: "stage-scenes",
    taskClass: "transform",
    label: "Stage scene cards",
    summary: "Turn a base product prompt into scene-specific prompt variants.",
  },
  {
    id: "generate-images",
    taskClass: "transform",
    label: "Generate product image cards",
    summary: "Render product imagery from staged prompts or prompt cards.",
  },
];

export function makeId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeCard(card: PlaygroundCard): PlaygroundCard {
  return {
    ...card,
    body: card.description,
    imageSrc: card.image,
  };
}

export function createTask(
  taskTypeId: PlaygroundTaskTypeId,
  options: { title?: string; seedCards?: PlaygroundCard[] } = {},
): PlaygroundTask {
  const template = taskTemplates.find((item) => item.id === taskTypeId) ?? taskTemplates[0];
  const now = Date.now();
  const id = makeId("task");
  const cards = (options.seedCards ?? []).map((card, index) =>
    normalizeCard({
      ...card,
      id: makeId(`card-${index}`),
      x: card.x + 48,
      y: card.y + 48,
      zIndex: index + 1,
      isSelected: false,
      metadata: {
        ...card.metadata,
        importedFromTaskId: card.metadata.importedFromTaskId ?? card.metadata.sourceTaskId ?? null,
        originatingTaskId: id,
      },
    }),
  );

  return {
    id,
    taskClass: template.taskClass,
    taskTypeId,
    title: options.title?.trim() || template.label,
    createdAt: now,
    updatedAt: now,
    persistenceKey: `playground:task:${id}`,
    cards,
    selectionIds: [],
    ui: {
      libraryFilter: "",
      textDraft: "",
      customInstructions: "",
      editInstructions: "",
      sceneInstructions: "",
      draftPrompt: "",
      pendingReferenceImports: [],
      pendingScanImports: [],
    },
    conversationHistory: [],
    imageOutputs: [],
    isSynthesizing: false,
    isStagingScene: false,
  };
}

export function duplicateTask(task: PlaygroundTask): PlaygroundTask {
  return createTask(task.taskTypeId, {
    title: `${task.title} copy`,
    seedCards: task.cards.map((card) =>
      normalizeCard({
        ...card,
        metadata: {
          ...card.metadata,
          sourceTaskId: task.id,
        },
      }),
    ),
  });
}

export function cloneCardsForTask(cards: PlaygroundCard[], sourceTaskId: string, targetTaskId: string): PlaygroundCard[] {
  return cards.map((card, index) =>
    normalizeCard({
      ...card,
      id: makeId(`card-${index}`),
      x: card.x + 36,
      y: card.y + 36,
      zIndex: index + 1,
      isSelected: false,
      metadata: {
        ...card.metadata,
        importedFromTaskId: sourceTaskId,
        originatingTaskId: targetTaskId,
      },
    }),
  );
}

export function mergeCardsIntoTask(task: PlaygroundTask, cards: PlaygroundCard[]): PlaygroundTask {
  const mergedCards = [...task.cards.map(normalizeCard), ...cards.map(normalizeCard)].map((card, index) =>
    normalizeCard({
      ...card,
      zIndex: index + 1,
    }),
  );

  return {
    ...task,
    cards: mergedCards,
    selectionIds: [],
    updatedAt: Date.now(),
  };
}

export function summarizeTask(task: PlaygroundTask): string {
  const promptCount = task.cards.filter((card) => card.metadata.cardType === "prompt").length;
  const sceneCount = task.cards.filter((card) => card.metadata.cardType === "scene").length;
  const selectionCount = task.selectionIds.length;
  return `${task.cards.length} cards · ${task.imageOutputs.length} renders · ${promptCount} prompts · ${sceneCount} scenes · ${selectionCount} selected`;
}

export function getSelectedCards(task: PlaygroundTask): PlaygroundCard[] {
  return task.cards.filter((card) => card.isSelected);
}

export function getCompatibleSurfaceOptions(task: PlaygroundTask): string[] {
  const selectedMaterialIds = task.cards
    .filter((card) => card.metadata.cardType === "attribute" && card.metadata.attributeGroup === "materials")
    .map((card) => String(card.metadata.attributeValue));

  if (selectedMaterialIds.length === 0) return [];

  return Array.from(
    new Set(selectedMaterialIds.flatMap((materialId) => materialsById.get(materialId)?.surfaceOptions ?? [])),
  ).sort();
}

export function toggleAttributeCard(
  task: PlaygroundTask,
  attribute: {
    group: "shapes" | "materials" | "surfaceOptions" | "mechanisms" | "colors";
    value: string;
    title: string;
    description: string;
  },
): PlaygroundTask {
  const existing = task.cards.find(
    (card) =>
      card.metadata.cardType === "attribute" &&
      card.metadata.attributeGroup === attribute.group &&
      card.metadata.attributeValue === attribute.value,
  );

  if (existing) {
    const cards = task.cards.filter((card) => card.id !== existing.id).map(normalizeCard);
    return {
      ...task,
      cards,
      selectionIds: task.selectionIds.filter((id) => id !== existing.id),
      updatedAt: Date.now(),
    };
  }

  const card = normalizeCard({
    id: makeId("card"),
    title: attribute.title,
    description: attribute.description,
    imagePrompt: "",
    image: "",
    metadata: {
      cardType: "attribute",
      attributeGroup: attribute.group,
      attributeValue: attribute.value,
      sourceTaskId: task.id,
    },
    x: 48 + (task.cards.length % 4) * 232,
    y: 48 + Math.floor(task.cards.length / 4) * 332,
    width: 200,
    height: 280,
    zIndex: task.cards.length + 1,
  });

  return {
    ...task,
    cards: [...task.cards.map(normalizeCard), card],
    updatedAt: Date.now(),
  };
}
