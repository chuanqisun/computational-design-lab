import { BehaviorSubject, combineLatest, map } from "rxjs";
import type { ActionRecord } from "./action-log";
import { BUILT_IN_WORKFLOWS } from "./builtin-workflows";
import {
  deleteWorkflow,
  getActiveWorkflowId,
  loadWorkflows,
  recordsToTrace,
  saveWorkflow,
  setActiveWorkflow,
  workflowNameFromMd,
  type SavedWorkflow,
  type TraceStep,
} from "./workflow-storage";

export interface WorkflowEntry extends SavedWorkflow {
  builtIn: boolean;
  summary: string;
}

const hasStorage = typeof localStorage !== "undefined";
const saved$ = new BehaviorSubject<SavedWorkflow[]>(hasStorage ? loadWorkflows() : []);

/** Selected workflow id (built-in or saved). */
export const activeWorkflowId$ = new BehaviorSubject<string | null>(hasStorage ? getActiveWorkflowId() : null);

const summaryOf = (md: string) =>
  md
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) ?? "";

/** Built-in workflows first, then the user's saved workflows. */
export const workflows$ = saved$.pipe(
  map((saved): WorkflowEntry[] => [
    ...BUILT_IN_WORKFLOWS,
    ...saved.map((workflow) => ({ ...workflow, builtIn: false, summary: summaryOf(workflow.agentsMd) })),
  ]),
);

export const activeWorkflow$ = combineLatest([workflows$, activeWorkflowId$]).pipe(
  map(([workflows, id]) => workflows.find((workflow) => workflow.id === id) ?? null),
);

const refresh = () => {
  saved$.next(loadWorkflows());
  activeWorkflowId$.next(getActiveWorkflowId());
};

export const workflowStore = {
  save(input: Parameters<typeof saveWorkflow>[0]): SavedWorkflow {
    const saved = saveWorkflow(input);
    refresh();
    return saved;
  },
  remove(id: string): void {
    deleteWorkflow(id);
    refresh();
  },
  select(id: string | null): void {
    setActiveWorkflow(id);
    refresh();
  },
  find(id: string | null | undefined): WorkflowEntry | undefined {
    if (!id) return undefined;
    const builtIn = BUILT_IN_WORKFLOWS.find((workflow) => workflow.id === id);
    if (builtIn) return builtIn;
    const saved = saved$.value.find((workflow) => workflow.id === id);
    return saved ? { ...saved, builtIn: false, summary: summaryOf(saved.agentsMd) } : undefined;
  },
  active(): WorkflowEntry | undefined {
    return workflowStore.find(activeWorkflowId$.value);
  },
};

/* ---------- Workflow editor state (shared by the tray section and the trace dialog) ---------- */

export type EditorTab = "steps" | "instructions";

export interface EditorState {
  /** Saved workflow being edited; undefined for a new workflow or a copy of a built-in. */
  workflowId?: string;
  name: string;
  md: string;
  steps: TraceStep[];
  goal: string;
  tab: EditorTab;
  notice: string;
}

const emptyEditor = (): EditorState => ({ name: "", md: "", steps: [], goal: "", tab: "instructions", notice: "" });

export const editor$ = new BehaviorSubject<EditorState>(emptyEditor());

export const editorActions = {
  openNew(): void {
    editor$.next({ ...emptyEditor(), notice: "Write instructions, paste or import an AGENTS.md, or start from the trace." });
  },
  openExisting(id: string): void {
    const workflow = workflowStore.find(id);
    if (!workflow) return;
    editor$.next({
      ...emptyEditor(),
      workflowId: workflow.builtIn ? undefined : workflow.id,
      name: workflow.builtIn ? `${workflow.name} (copy)` : workflow.name,
      md: workflow.agentsMd,
      steps: workflow.sourceSteps ?? [],
      notice: workflow.builtIn ? "Built-in workflows are read-only; saving creates your own copy." : "",
    });
  },
  openFromTrace(records: ActionRecord[], isHumanOnly: (action: string) => boolean): void {
    editor$.next({
      ...emptyEditor(),
      steps: recordsToTrace(records, isHumanOnly),
      tab: "steps",
      notice: "Edit the recorded steps, add notes on intent, then generate the instructions.",
    });
  },
  update(patch: Partial<EditorState>): void {
    editor$.next({ ...editor$.value, ...patch });
  },
  importMd(md: string): void {
    editor$.next({ ...editor$.value, md, name: editor$.value.name || workflowNameFromMd(md), tab: "instructions" });
  },
};
