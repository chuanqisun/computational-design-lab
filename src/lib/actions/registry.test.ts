import { describe, expect, it } from "vitest";
import { createAppRegistry } from "./app-registry";
import { HUMAN_ENTRIES } from "./human-entries";
import { agentParameters, getAgentDeclarations } from "./registry";
import { isWellFormedSchema } from "./schema";

const registry = createAppRegistry({ image: async () => undefined, videoFrames: async () => undefined });
const defs = [...registry.values()];

describe("action registry", () => {
  it("every action has a snake_case name, description, well-formed schema, humanEntry and agent mode", () => {
    for (const def of defs) {
      expect(def.name, def.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(def.description.length, def.name).toBeGreaterThan(10);
      expect(def.parameters.type, def.name).toBe("object");
      expect(isWellFormedSchema(def.parameters), def.name).toBe(true);
      expect(def.humanEntry, def.name).toBeTruthy();
      expect(def.agent, def.name).toBeDefined();
    }
  });

  it("human-only args are underscore-prefixed and hidden from the agent", () => {
    for (const def of defs) {
      for (const key of def.humanArgs ?? []) {
        expect(key.startsWith("_"), `${def.name}.${key}`).toBe(true);
        expect(agentParameters(def).properties, def.name).not.toHaveProperty(key);
      }
    }
  });
});

describe("parity manifest", () => {
  it("every action's humanEntry is in the manifest and maps back to that action", () => {
    for (const def of defs) {
      expect(HUMAN_ENTRIES[def.humanEntry], `${def.name} → ${def.humanEntry}`).toBe(def.name);
    }
  });

  it("every manifest entry maps to a registered action or explains why it has no board effect", () => {
    for (const [entry, target] of Object.entries(HUMAN_ENTRIES)) {
      if (typeof target === "string") {
        expect(registry.has(target), `${entry} → ${target}`).toBe(true);
      } else {
        expect(target.none.length, entry).toBeGreaterThan(5);
      }
    }
  });

  it("unsupported actions carry a reason and are never declared to the agent", () => {
    const declared = new Set(getAgentDeclarations(registry).map((fn) => fn.name));
    const unsupported = defs.filter((def) => typeof def.agent === "object");
    expect(unsupported.map((def) => def.name).sort()).toEqual(["add_media", "export_cards"]);
    for (const def of unsupported) {
      expect((def.agent as { unsupported: string }).unsupported.length).toBeGreaterThan(10);
      expect(declared.has(def.name)).toBe(false);
    }
  });

  it("agent declarations are exactly the native + equivalent + perception actions", () => {
    const declared = getAgentDeclarations(registry).map((fn) => fn.name).sort();
    const expected = defs.filter((def) => typeof def.agent === "string").map((def) => def.name).sort();
    expect(declared).toEqual(expected);
    expect(declared).toEqual(
      expect.arrayContaining(["observe", "view_cards", "wait_for_idle", "edit_image", "interview_persona", "duplicate_cards"]),
    );
  });
});
