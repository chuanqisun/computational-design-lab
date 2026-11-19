import { html } from "lit-html";
import { combineLatest, map, type BehaviorSubject } from "rxjs";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { agentStatus$, describeAgentStatus, startAgent, stopAgent } from "../../lib/agent/agent-controller";
import { activeWorkflowId$, workflowStore, workflows$ } from "../../lib/workflows/workflow-store";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import "./workflow.css";

/**
 * Top-bar workflow control: active AGENTS.md, Auto-Iterate toggle, status pill (+ activity popover),
 * and the declarative opener for the Workflow dialog.
 */
export const WorkflowControlComponent = createComponent(
  ({ runtime, apiKeys$ }: { runtime: ActionRuntime; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const toggleAutoIterate = () => {
      if (agentStatus$.value.running) {
        stopAgent();
        return;
      }
      const workflow = workflowStore.active();
      const apiKey = apiKeys$.value.gemini;
      if (!workflow || !apiKey) return;
      startAgent({ runtime, agentsMd: workflow.agentsMd, apiKey });
    };

    return combineLatest([workflows$, activeWorkflowId$, agentStatus$, apiKeys$, runtime.log.records$]).pipe(
      map(([workflows, activeId, status, apiKeys, records]) => {
        const disabledReason = !apiKeys.gemini
          ? "Gemini API key required (Setup)"
          : !activeId
            ? "Choose an active workflow first"
            : "";
        const recent = records.slice(-5).reverse();

        return html`
          <div class="workflow-control" role="group" aria-label="Workflow">
            <select
              aria-label="Active workflow"
              ?disabled=${status.running}
              @change=${(e: Event) => workflowStore.setActive((e.target as HTMLSelectElement).value || null)}
            >
              <option value="" ?selected=${!activeId}>(no workflow)</option>
              ${workflows.map(
                (workflow) => html`<option value=${workflow.id} ?selected=${workflow.id === activeId}>${workflow.name}</option>`,
              )}
            </select>
            <button
              class="auto-iterate"
              aria-pressed=${status.running ? "true" : "false"}
              ?disabled=${!status.running && !!disabledReason}
              title=${status.running ? "Stop the agent" : disabledReason || "Let the agent follow the active workflow"}
              @click=${toggleAutoIterate}
            >
              Auto-Iterate
            </button>
            <button
              class="status-pill ${status.running ? "running" : ""}"
              commandfor="agent-status-popover"
              command="toggle-popover"
              title=${status.message ?? ""}
            >
              ${describeAgentStatus(status)}
            </button>
            <button commandfor="workflow-dialog" command="show-modal">Workflow</button>
          </div>
          <div id="agent-status-popover" class="agent-status-popover" popover>
            ${status.message ? html`<p class="agent-message">${status.message}</p>` : html``}
            <ol class="activity-mini">
              ${recent.length
                ? recent.map(
                    (record) => html`<li>
                      <span class="actor-pill actor-${record.actor}">${record.actor === "ai" ? "AI" : "User"}</span>
                      <code>${record.action}</code>
                      <span class="summary ${record.status}">${record.summary || record.status}</span>
                    </li>`,
                  )
                : html`<li class="empty">No activity yet</li>`}
            </ol>
          </div>
        `;
      }),
    );
  },
);
