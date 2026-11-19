import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { agentStatus$, describeAgentStatus, startAgent, stopAgent } from "../../lib/agent/agent-controller";
import { persistSubject } from "../../lib/persistence";
import { activeWorkflowId$, editorActions, workflowStore, workflows$ } from "../../lib/workflows/workflow-store";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import "./workflow.css";

/** Context-tray section: pick a workflow and run it. */
export const WorkflowSectionComponent = createComponent(
  ({ runtime, apiKeys$ }: { runtime: ActionRuntime; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const brief$ = new BehaviorSubject("");
    void persistSubject(brief$, "context-tray:workflow:brief");

    // Hiding the popover from a button inside it drops focus; return it to the picker (listen on the target).
    const onMenuToggle = (event: Event) => {
      const menu = event.currentTarget as HTMLElement;
      if (
        (event as ToggleEvent).newState === "closed" &&
        (!document.activeElement || document.activeElement === document.body || menu.contains(document.activeElement))
      ) {
        (menu.previousElementSibling as HTMLElement | null)?.focus();
      }
    };

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

    return combineLatest([workflows$, activeWorkflowId$, agentStatus$, apiKeys$, brief$]).pipe(
      map(([workflows, activeId, status, apiKeys, brief]) => {
        const active = workflows.find((workflow) => workflow.id === activeId);
        const runBlocker = !apiKeys.gemini ? "Add a Gemini API key in Setup" : !active ? "Select a workflow" : "";

        return html`
          <div class="workflow-section">
            <button
              class="workflow-picker"
              commandfor="workflow-picker-menu"
              command="toggle-popover"
              ?disabled=${status.running}
              aria-haspopup="listbox"
            >
              <span class="workflow-picker-text">
                <span class="workflow-option-name">
                  ${active?.name ?? "Choose a workflow"}
                  ${active?.builtIn ? html`<span class="tag">Built-in</span>` : nothing}
                </span>
                ${active ? html`<span class="workflow-option-summary">${active.summary}</span>` : nothing}
              </span>
              <span class="chevron" aria-hidden="true">▾</span>
            </button>
            <div id="workflow-picker-menu" class="workflow-picker-menu" popover @toggle=${onMenuToggle}>
              <ul role="listbox" aria-label="Workflows">
                ${workflows.map(
                  (workflow) =>
                    html`<li role="option" aria-selected=${workflow.id === activeId}>
                      <button
                        class="workflow-option ${workflow.id === activeId ? "is-active" : ""}"
                        commandfor="workflow-picker-menu"
                        command="hide-popover"
                        @click=${() => workflowStore.select(workflow.id)}
                      >
                        <span class="check" aria-hidden="true">${workflow.id === activeId ? "✓" : ""}</span>
                        <span class="workflow-option-text">
                          <span class="workflow-option-name">
                            ${workflow.name} ${workflow.builtIn ? html`<span class="tag">Built-in</span>` : nothing}
                          </span>
                          <span class="workflow-option-summary">${workflow.summary}</span>
                        </span>
                      </button>
                    </li>`,
                )}
              </ul>
            </div>

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
              <button commandfor="workflow-editor" command="show-modal" @click=${() => editorActions.openNew()}>
                New
              </button>
            </div>

            <p class="workflow-status ${status.running ? "is-running" : ""}" aria-live="polite">
              <span class="status-dot"></span>${describeAgentStatus(status)}
            </p>
            ${status.message ? html`<p class="workflow-message" title=${status.message}>${status.message}</p>` : nothing}
          </div>
        `;
      }),
    );
  },
);
