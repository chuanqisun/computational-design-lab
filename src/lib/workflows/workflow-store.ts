import { BehaviorSubject } from "rxjs";
import {
  deleteWorkflow,
  getActiveWorkflowId,
  importAgentsMd,
  loadWorkflows,
  saveWorkflow,
  setActiveWorkflow,
  type SavedWorkflow,
} from "./workflow-storage";

/** Reactive view of saved AGENTS.md workflows shared by the top bar and the Workflow dialog. */
export const workflows$ = new BehaviorSubject<SavedWorkflow[]>(typeof localStorage === "undefined" ? [] : loadWorkflows());
export const activeWorkflowId$ = new BehaviorSubject<string | null>(
  typeof localStorage === "undefined" ? null : getActiveWorkflowId(),
);

const refresh = () => {
  workflows$.next(loadWorkflows());
  activeWorkflowId$.next(getActiveWorkflowId());
};

export const workflowStore = {
  save(input: Parameters<typeof saveWorkflow>[0]): SavedWorkflow {
    const saved = saveWorkflow(input);
    refresh();
    return saved;
  },
  import(md: string): SavedWorkflow {
    const saved = importAgentsMd(md);
    refresh();
    return saved;
  },
  remove(id: string): void {
    deleteWorkflow(id);
    refresh();
  },
  setActive(id: string | null): void {
    setActiveWorkflow(id);
    refresh();
  },
  active(): SavedWorkflow | undefined {
    return workflows$.value.find((workflow) => workflow.id === activeWorkflowId$.value);
  },
};
