import { describe, expect, it } from "vitest";
import {
  allowsClearCanvas,
  deleteWorkflow,
  getActiveWorkflowId,
  loadWorkflows,
  saveWorkflow,
  setActiveWorkflow,
  validateAgentsMd,
  workflowNameFromMd,
} from "./workflow-storage";

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
};

describe("workflow storage", () => {
  it("saves, updates, imports, activates and deletes workflows", () => {
    const store = memoryStore();
    const saved = saveWorkflow({ name: "A", agentsMd: "# A" }, store, 1);
    saveWorkflow({ id: saved.id, name: "A2", agentsMd: "# A2" }, store, 2);
    const md = "# Moody chairs\n\nBody";
    const imported = saveWorkflow({ name: workflowNameFromMd(md), agentsMd: md }, store);
    expect(imported.name).toBe("Moody chairs");
    expect(loadWorkflows(store).map((w) => w.name)).toEqual(["A2", "Moody chairs"]);
    expect(loadWorkflows(store)[0]).toMatchObject({ createdAt: 1, updatedAt: 2 });

    setActiveWorkflow(saved.id, store);
    expect(getActiveWorkflowId(store)).toBe(saved.id);
    deleteWorkflow(saved.id, store);
    expect(getActiveWorkflowId(store)).toBeNull();
    expect(loadWorkflows(store)).toHaveLength(1);
  });
});

describe("validateAgentsMd", () => {
  it("flags unknown snake_case tool names and missing sections", () => {
    const md = "# X\n## Tools\n- `render_image`, `make_magic`\n## Workflow\n1. Use `scan_concept`.";
    expect(validateAgentsMd(md, ["render_image", "scan_concept"])).toEqual({
      unknownActions: ["make_magic"],
      missingSections: ["Aesthetic & Quality Criteria", "Guardrails & Stop Conditions"],
    });
  });
});

describe("allowsClearCanvas", () => {
  it("requires an explicit allow and no prohibition", () => {
    expect(allowsClearCanvas("Never call `clear_canvas`.")).toBe(false);
    expect(allowsClearCanvas("You are allowed to use `clear_canvas` at the start.")).toBe(true);
    expect(allowsClearCanvas("Nothing about it")).toBe(false);
  });
});
