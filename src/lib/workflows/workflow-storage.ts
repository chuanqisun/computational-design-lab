import type { Actor } from "../actions/types";
import type { ActionRecord } from "./action-log";

export interface TraceStep {
  id: string;
  action: string;
  actor: Actor;
  args: Record<string, unknown>;
  note: string;
  included: boolean;
  humanOnly: boolean;
  thumbs: string[];
}

export interface SavedWorkflow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  agentsMd: string;
  sourceSteps?: TraceStep[];
}

export const WORKFLOWS_KEY = "moodboard-saved-workflows";
export const ACTIVE_WORKFLOW_KEY = "moodboard-active-workflow";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const defaultStore = (): KeyValueStore => globalThis.localStorage;

export function recordsToTrace(records: ActionRecord[], isHumanOnly: (action: string) => boolean): TraceStep[] {
  return records.map((record) => ({
    id: record.id,
    action: record.action,
    actor: record.actor,
    args: structuredClone(record.args),
    note: "",
    included: record.status !== "error",
    humanOnly: isHumanOnly(record.action),
    thumbs: record.outputThumbs,
  }));
}

export function loadWorkflows(store: KeyValueStore = defaultStore()): SavedWorkflow[] {
  try {
    const parsed = JSON.parse(store.getItem(WORKFLOWS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWorkflows(workflows: SavedWorkflow[], store: KeyValueStore) {
  store.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
}

export function saveWorkflow(
  input: Pick<SavedWorkflow, "name" | "agentsMd"> & Partial<Pick<SavedWorkflow, "id" | "sourceSteps">>,
  store: KeyValueStore = defaultStore(),
  now = Date.now(),
): SavedWorkflow {
  const workflows = loadWorkflows(store);
  const existing = input.id ? workflows.find((workflow) => workflow.id === input.id) : undefined;
  const saved: SavedWorkflow = existing
    ? { ...existing, ...input, id: existing.id, updatedAt: now }
    : {
        id: input.id ?? `wf-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: input.name,
        agentsMd: input.agentsMd,
        sourceSteps: input.sourceSteps,
        createdAt: now,
        updatedAt: now,
      };
  writeWorkflows(existing ? workflows.map((w) => (w.id === saved.id ? saved : w)) : [...workflows, saved], store);
  return saved;
}

export function deleteWorkflow(id: string, store: KeyValueStore = defaultStore()): void {
  writeWorkflows(
    loadWorkflows(store).filter((workflow) => workflow.id !== id),
    store,
  );
  if (getActiveWorkflowId(store) === id) setActiveWorkflow(null, store);
}

export function getActiveWorkflowId(store: KeyValueStore = defaultStore()): string | null {
  return store.getItem(ACTIVE_WORKFLOW_KEY);
}

export function setActiveWorkflow(id: string | null, store: KeyValueStore = defaultStore()): void {
  if (id) store.setItem(ACTIVE_WORKFLOW_KEY, id);
  else store.removeItem(ACTIVE_WORKFLOW_KEY);
}

/** Name from the first `# Heading`, else a fallback. */
export function workflowNameFromMd(md: string, fallback = "Imported workflow"): string {
  return /^#\s+(.+)$/m.exec(md)?.[1]?.trim() || fallback;
}

export function importAgentsMd(md: string, store: KeyValueStore = defaultStore()): SavedWorkflow {
  return saveWorkflow({ name: workflowNameFromMd(md), agentsMd: md }, store);
}

export function exportAgentsMd(workflow: SavedWorkflow): void {
  const blob = new Blob([workflow.agentsMd], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "AGENTS.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface AgentsMdValidation {
  unknownActions: string[];
  missingSections: string[];
}

export const AGENTS_MD_SECTIONS = ["Tools", "Workflow", "Aesthetic & Quality Criteria", "Guardrails & Stop Conditions"];

/** Warn about `snake_case` tool names not in the registry and missing standard sections. */
export function validateAgentsMd(md: string, actionNames: Iterable<string>): AgentsMdValidation {
  const known = new Set(actionNames);
  const mentioned = new Set([...md.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((match) => match[1]));
  const headings = [...md.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim().toLowerCase());
  return {
    unknownActions: [...mentioned].filter((name) => !known.has(name)),
    missingSections: AGENTS_MD_SECTIONS.filter(
      (section) => !headings.some((heading) => heading.startsWith(section.toLowerCase().split(" ")[0])),
    ),
  };
}

/** Whether AGENTS.md explicitly allows clearing the canvas. */
export function allowsClearCanvas(md: string): boolean {
  return /allow(?:ed)?[^\n]{0,40}`?clear_canvas`?/i.test(md) && !/(never|do not|don't)[^\n]{0,40}`?clear_canvas`?/i.test(md);
}
