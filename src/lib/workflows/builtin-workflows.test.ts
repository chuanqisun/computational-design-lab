import { describe, expect, it } from "vitest";
import { createAppRegistry } from "../actions/app-registry";
import { BUILT_IN_WORKFLOWS } from "./builtin-workflows";
import { allowsClearCanvas, validateAgentsMd } from "./workflow-storage";

const registry = createAppRegistry({ image: async () => undefined, videoFrames: async () => undefined });

describe("built-in workflows", () => {
  it("have unique ids and only reference registered tools, with all standard sections", () => {
    expect(new Set(BUILT_IN_WORKFLOWS.map((w) => w.id)).size).toBe(BUILT_IN_WORKFLOWS.length);
    for (const workflow of BUILT_IN_WORKFLOWS) {
      expect(validateAgentsMd(workflow.agentsMd, registry.keys()), workflow.name).toEqual({ unknownActions: [], missingSections: [] });
      expect(allowsClearCanvas(workflow.agentsMd), workflow.name).toBe(false);
      expect(workflow.agentsMd.startsWith(`# ${workflow.name}`)).toBe(true);
    }
  });

  it("together exercise a diverse set of agent tools", () => {
    const used = new Set(BUILT_IN_WORKFLOWS.flatMap((w) => [...w.agentsMd.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1])));
    expect(used.size).toBeGreaterThanOrEqual(12);
  });
});
