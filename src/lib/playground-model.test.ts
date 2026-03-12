import { describe, expect, it } from "vitest";
import {
  addCards,
  buildTaskStatus,
  cloneCardsForTask,
  createAttributeCard,
  createPlaygroundSession,
  createPromptCard,
  createTask,
  createTextCard,
  deleteSelectedCards,
  ensureSession,
  getSelectedCards,
  handoffSelectedCards,
  moveCard,
  withSelection,
} from "./playground-model";

const createIdFactory = (...ids: string[]) => {
  let index = 0;
  return () => ids[index++] ?? `fallback-${index}`;
};

describe("playground model", () => {
  it("creates tasks with stable shell metadata", () => {
    const task = createTask("capture-reference", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));

    expect(task.id).toBe("task-task-a");
    expect(task.localPersistenceKey).toBe("playground:task-task-a");
    expect(task.title).toBe("Capture reference material");
    expect(task.cards).toEqual([]);
  });

  it("creates explicit attribute cards with structured metadata", () => {
    const card = createAttributeCard(
      "material",
      { id: "glass", name: "Glass", description: "Clear and rigid" },
      "task-1",
      "2026-03-12T00:00:00.000Z",
      createIdFactory("card-a"),
      "source-card",
    );

    expect(card.category).toBe("attribute");
    expect(card.metadata.structuredAttributes).toEqual({ material: ["glass"] });
    expect(card.metadata.sourceCardId).toBe("source-card");
  });

  it("supports replace and toggle selection", () => {
    const task = createTask("organize-curate", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));
    const cardA = createTextCard("First", task.id, "2026-03-12T00:00:00.000Z", createIdFactory("card-a"));
    const cardB = createTextCard("Second", task.id, "2026-03-12T00:00:00.000Z", createIdFactory("card-b"));
    const populated = addCards(task, [cardA, cardB]);

    const replaced = withSelection(populated, cardA.id, "replace");
    const toggled = withSelection(replaced, cardB.id, "toggle");

    expect(replaced.selectedCardIds).toEqual([cardA.id]);
    expect(toggled.selectedCardIds).toEqual([cardA.id, cardB.id]);
    expect(getSelectedCards(toggled).map((card) => card.id)).toEqual([cardA.id, cardB.id]);
  });

  it("reorders cards without dropping any entries", () => {
    const task = createTask("organize-curate", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));
    const idFactory = createIdFactory("card-a", "card-b", "card-c");
    const populated = addCards(task, [
      createTextCard("A", task.id, "2026-03-12T00:00:00.000Z", idFactory),
      createTextCard("B", task.id, "2026-03-12T00:00:00.000Z", idFactory),
      createTextCard("C", task.id, "2026-03-12T00:00:00.000Z", idFactory),
    ]);

    const moved = moveCard(populated, populated.cards[2]!.id, populated.cards[0]!.id);

    expect(moved.cards.map((card) => card.title)).toEqual(["C", "A", "B"]);
  });

  it("deletes selected cards and clears selection", () => {
    const task = createTask("organize-curate", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));
    const cardA = createTextCard("First", task.id, "2026-03-12T00:00:00.000Z", createIdFactory("card-a"));
    const cardB = createTextCard("Second", task.id, "2026-03-12T00:00:00.000Z", createIdFactory("card-b"));
    const selected = withSelection(addCards(task, [cardA, cardB]), cardA.id, "replace");

    const cleaned = deleteSelectedCards(selected);

    expect(cleaned.cards.map((card) => card.id)).toEqual([cardB.id]);
    expect(cleaned.selectedCardIds).toEqual([]);
  });

  it("clones and hands off selected cards between tasks", () => {
    const sourceTask = createTask("write-text", "2026-03-12T00:00:00.000Z", createIdFactory("source"));
    const destinationTask = createTask("synthesize-prompt", "2026-03-12T00:00:00.000Z", createIdFactory("destination"));
    const sourceCard = createTextCard("Inspired by clean pharmacy packaging", sourceTask.id, "2026-03-12T00:00:00.000Z", createIdFactory("card-a"));
    const selectedSource = withSelection(addCards(sourceTask, [sourceCard]), sourceCard.id, "replace");

    const result = handoffSelectedCards(
      selectedSource,
      destinationTask,
      "2026-03-12T00:05:00.000Z",
      createIdFactory("clone-a"),
    );

    expect(result.transferred).toHaveLength(1);
    expect(result.destinationTask.cards[0]?.id).toBe("card-clone-a");
    expect(result.destinationTask.cards[0]?.metadata.importedFromTaskId).toBe(selectedSource.id);
  });

  it("summarizes task status based on cards, selection, and running jobs", () => {
    const task = createTask("generate-images", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));
    const promptCard = createPromptCard({
      taskId: task.id,
      title: "Prompt 1",
      artifact: "<scene />",
      category: "prompt",
      now: "2026-03-12T00:00:00.000Z",
      createId: createIdFactory("prompt-a"),
    });
    const imageCard = cloneCardsForTask(
      [
        {
          ...promptCard,
          id: "card-running",
          category: "image",
          metadata: { ...promptCard.metadata, generationStatus: "running" },
        },
      ],
      task.id,
      "2026-03-12T00:00:00.000Z",
      createIdFactory("image-a"),
      task.id,
    )[0]!;

    const populated = addCards(task, [promptCard, imageCard]);

    expect(buildTaskStatus(populated)).toBe("2 cards · 1 running");
  });

  it("repairs invalid active task ids during session restore", () => {
    const task = createTask("organize-curate", "2026-03-12T00:00:00.000Z", createIdFactory("task-a"));
    const restored = ensureSession({ tasks: [task], activeTaskId: "missing-task" });

    expect(restored.activeTaskId).toBe(task.id);
  });

  it("keeps empty sessions serializable", () => {
    const session = createPlaygroundSession();
    expect(JSON.parse(JSON.stringify(session))).toEqual({ tasks: [], activeTaskId: null });
  });
});
