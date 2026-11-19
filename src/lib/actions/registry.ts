import type { Interactions } from "@google/genai";
import type { ActionDef, JSONSchemaObject } from "./types";

export type Registry = ReadonlyMap<string, ActionDef>;

export function createRegistry(defs: ActionDef<any>[]): Registry {
  const map = new Map<string, ActionDef>();
  for (const def of defs) {
    if (map.has(def.name)) throw new Error(`Duplicate action name: ${def.name}`);
    map.set(def.name, def as ActionDef);
  }
  return map;
}

export function isAgentVisible(def: ActionDef): boolean {
  return typeof def.agent === "string";
}

/** Schema exposed to the agent: never includes human-only args. */
export function agentParameters(def: ActionDef): JSONSchemaObject {
  const hidden = new Set(def.humanArgs ?? []);
  const properties = Object.fromEntries(Object.entries(def.parameters.properties).filter(([key]) => !hidden.has(key)));
  const required = def.parameters.required?.filter((key) => !hidden.has(key));
  return { ...def.parameters, properties, ...(required ? { required } : {}) };
}

export function getAgentDeclarations(registry: Registry): Interactions.Function[] {
  return [...registry.values()].filter(isAgentVisible).map((def) => ({
    type: "function",
    name: def.name,
    description: def.description,
    parameters: agentParameters(def),
  }));
}
