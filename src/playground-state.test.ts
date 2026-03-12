import { describe, expect, it } from "vitest";
import {
  cloneCardsForTask,
  createTask,
  getCompatibleSurfaceOptions,
  mergeCardsIntoTask,
  normalizeCard,
  summarizeTask,
  toggleAttributeCard,
  type PlaygroundCard,
} from "./playground-state";

function makeCard(overrides: Partial<PlaygroundCard> = {}): PlaygroundCard {
  return normalizeCard({
    id: "card-1",
    title: "Reference",
    description: "Reference description",
    imagePrompt: "",
    image: "",
    metadata: { cardType: "text", sourceTaskId: "task-1" },
    x: 10,
    y: 20,
    width: 200,
    height: 280,
    zIndex: 1,
    ...overrides,
  });
}

describe("playground state helpers", () => {
  it("creates resumable tasks with defaults", () => {
    const task = createTask("capture-reference");

    expect(task.taskTypeId).toBe("capture-reference");
    expect(task.taskClass).toBe("lift");
    expect(task.persistenceKey).toContain(task.id);
    expect(task.cards).toEqual([]);
    expect(task.ui.pendingReferenceImports).toEqual([]);
  });

  it("toggles attribute cards by group and value", () => {
    const task = createTask("attribute-library");
    const withAttribute = toggleAttributeCard(task, {
      group: "materials",
      value: "glass",
      title: "Glass",
      description: "Unmatched depth and gloss.",
    });
    const withoutAttribute = toggleAttributeCard(withAttribute, {
      group: "materials",
      value: "glass",
      title: "Glass",
      description: "Unmatched depth and gloss.",
    });

    expect(withAttribute.cards).toHaveLength(1);
    expect(withAttribute.cards[0].metadata.attributeValue).toBe("glass");
    expect(withoutAttribute.cards).toHaveLength(0);
  });

  it("derives compatible surface options from selected material cards", () => {
    const task = createTask("attribute-library");
    const withGlass = toggleAttributeCard(task, {
      group: "materials",
      value: "glass",
      title: "Glass",
      description: "Glass material",
    });

    expect(getCompatibleSurfaceOptions(withGlass)).toContain("Frosted");
    expect(getCompatibleSurfaceOptions(withGlass)).toContain("High gloss");
  });

  it("clones cards for handoff while tracking provenance", () => {
    const sourceCard = makeCard({
      metadata: { cardType: "attribute", sourceTaskId: "task-source" },
    });

    const cloned = cloneCardsForTask([sourceCard], "task-source", "task-target");

    expect(cloned).toHaveLength(1);
    expect(cloned[0].id).not.toBe(sourceCard.id);
    expect(cloned[0].metadata.importedFromTaskId).toBe("task-source");
    expect(cloned[0].metadata.originatingTaskId).toBe("task-target");
  });

  it("merges handed off cards into a task and updates summary counts", () => {
    const task = createTask("organize-curate");
    const merged = mergeCardsIntoTask(task, [
      makeCard({ metadata: { cardType: "prompt", sourceTaskId: task.id } }),
      makeCard({ id: "card-2", metadata: { cardType: "scene", sourceTaskId: task.id } }),
    ]);

    expect(merged.cards).toHaveLength(2);
    expect(summarizeTask(merged)).toContain("2 cards");
    expect(summarizeTask(merged)).toContain("1 prompts");
    expect(summarizeTask(merged)).toContain("1 scenes");
  });
});
