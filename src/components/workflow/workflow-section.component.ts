import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { agentStatus$, describeAgentStatus, startAgent, stopAgent } from "../../lib/agent/agent-controller";
import { persistSubject } from "../../lib/persistence";
import { activeWorkflowId$, editorActions, workflowStore, workflows$ } from "../../lib/workflows/workflow-store";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { traceRow } from "./trace-list";
import "./workflow.css";

const RECENT_TRACE_COUNT = 4;

/** Context-tray section: pick a workflow, run it, and glance at the latest trace. */
export const WorkflowSectionComponent = createComponent(
  ({ runtime, apiKeys$ }: { runtime: ActionRuntime; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const brief$ = new BehaviorSubject("");
    void persistSubject(brief$, "context-tray:workflow:brief");

    const run = () => {
      if (agentStatus$.value.running) {
        stopAgent();
        return;
      }
      const workflow = workflowStore.active();
      const apiKey = apiKeys$.value.gemini;
      if (!workflow || !apiKey) return;
      startAgent({ runtime, agentsMd: workflow.agentsMd, apiKey, goal: brief$.value });
    };

    return combineLatest([workflows$, activeWorkflowId$, agentStatus$, apiKeys$, runtime.log.records$, brief$]).pipe(
      map(([workflows, activeId, status, apiKeys, records, brief]) => {
        const active = workflows.find((workflow) => workflow.id === activeId);
        const runBlocker = !apiKeys.gemini ? "Add a Gemini API key in Setup" : !active ? "Select a workflow" : "";
        const recent = records.slice(-RECENT_TRACE_COUNT).reverse();

        return html`
          <div class="workflow-section">
            <fieldset class="workflow-list" ?disabled=${status.running}>
              <legend class="visually-hidden">Workflow</legend>
              ${workflows.map(
                (workflow) => html`<label class="workflow-option ${workflow.id === activeId ? "is-active" : ""}">
                  <input
                    type="radio"
                    name="active-workflow"
                    .checked=${workflow.id === activeId}
                    @change=${() => workflowStore.select(workflow.id)}
                  />
                  <span class="workflow-option-text">
                    <span class="workflow-option-name">
                      ${workflow.name} ${workflow.builtIn ? html`<span class="tag">Built-in</span>` : nothing}
                    </span>
                    <span class="workflow-option-summary">${workflow.summary}</span>
                  </span>
                </label>`,
              )}
            </fieldset>

            <label class="field">
              <span>Brief</span>
              <textarea
                rows="2"
                placeholder="Optional focus for this run, e.g. a reading lamp for small apartments"
                .value=${brief}
                ?disabled=${status.running}
                @input=${(e: Event) => brief$.next((e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </label>

            <div class="workflow-actions">
              <button
                class="primary ${status.running ? "is-running" : ""}"
                ?disabled=${!status.running && !!runBlocker}
                title=${status.running ? "Stop the run" : runBlocker || `Let the AI run “${active?.name}”`}
                @click=${run}
              >
                ${status.running ? "Stop" : "Run"}
              </button>
              <button
                commandfor="workflow-editor"
                command="show-modal"
                ?disabled=${!active || status.running}
                title=${active?.builtIn ? "View or copy this built-in workflow" : "Edit this workflow"}
                @click=${() => active && editorActions.openExisting(active.id)}
              >
                ${active?.builtIn ? "View" : "Edit"}
              </button>
              <button commandfor="workflow-editor" command="show-modal" @click=${() => editorActions.openNew()}>New</button>
            </div>

            <p class="workflow-status ${status.running ? "is-running" : ""}" aria-live="polite">
              <span class="status-dot"></span>${describeAgentStatus(status)}
            </p>
            ${status.message ? html`<p class="workflow-message" title=${status.message}>${status.message}</p>` : nothing}

            <div class="trace-preview">
              <div class="trace-preview-header">
                <span>Trace</span>
                <button class="link" commandfor="trace-dialog" command="show-modal">Open trace</button>
              </div>
              ${recent.length
                ? html`<ol class="trace-list compact">${recent.map((record) => traceRow(record))}</ol>`
                : html`<p class="empty">Actions by you and the AI will appear here.</p>`}
            </div>
          </div>
        `;
      }),
    );
  },
);
