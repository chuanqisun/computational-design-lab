import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, finalize, map, tap } from "rxjs";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { summarizeTraceToAgentsMd$, type CatalogEntry } from "../../lib/workflows/summarize-agents-md";
import { editor$, editorActions, workflowStore, type EditorState } from "../../lib/workflows/workflow-store";
import {
  exportAgentsMd,
  validateAgentsMd,
  workflowNameFromMd,
  type TraceStep,
} from "../../lib/workflows/workflow-storage";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { submitTask } from "../context-tray/tasks";
import { actorBadge } from "./trace-list";
import "./workflow.css";

/** Create or edit one workflow: recorded steps (optional) → instructions (AGENTS.md) → save. */
export const WorkflowEditorComponent = createComponent(
  ({ runtime, apiKeys$ }: { runtime: ActionRuntime; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const generating$ = new BehaviorSubject(false);
    const argErrors$ = new BehaviorSubject<Record<string, string>>({});

    const catalog = (): CatalogEntry[] =>
      [...runtime.registry.values()]
        .filter((def) => def.agent !== "perception")
        .map((def) => ({ name: def.name, description: def.description, humanOnly: typeof def.agent === "object" }));

    const steps = () => editor$.value.steps;
    const setSteps = (next: TraceStep[]) => editorActions.update({ steps: next });
    const updateStep = (id: string, patch: Partial<TraceStep>) =>
      setSteps(steps().map((step) => (step.id === id ? { ...step, ...patch } : step)));
    const moveStep = (index: number, delta: number) => {
      const next = [...steps()];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setSteps(next);
    };
    const updateArgs = (id: string, text: string) => {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
          throw new Error("Must be a JSON object");
        updateStep(id, { args: parsed });
        const { [id]: _removed, ...rest } = argErrors$.value;
        argErrors$.next(rest);
      } catch (error) {
        argErrors$.next({ ...argErrors$.value, [id]: error instanceof Error ? error.message : "Invalid JSON" });
      }
    };

    const generate = () => {
      const apiKey = apiKeys$.value.gemini;
      const { name, goal } = editor$.value;
      if (!apiKey) {
        editorActions.update({ notice: "Add a Gemini API key in Setup to generate instructions." });
        return;
      }
      generating$.next(true);
      submitTask(
        summarizeTraceToAgentsMd$({
          name: name.trim() || "Untitled workflow",
          goal,
          steps: steps(),
          catalog: catalog(),
          apiKey,
        }).pipe(
          tap({
            next: (md) =>
              editorActions.update({ md, tab: "instructions", notice: "Instructions generated. Review, then save." }),
            error: (error) =>
              editorActions.update({ notice: error instanceof Error ? error.message : "Generation failed." }),
          }),
          finalize(() => generating$.next(false)),
        ),
      );
    };

    const save = () => {
      const { workflowId, name, md, steps: sourceSteps } = editor$.value;
      if (!md.trim()) return;
      const saved = workflowStore.save({
        id: workflowId,
        name: name.trim() || workflowNameFromMd(md, "Untitled workflow"),
        agentsMd: md,
        sourceSteps: sourceSteps.length ? sourceSteps : undefined,
      });
      workflowStore.select(saved.id);
      editorActions.update({ workflowId: saved.id, name: saved.name, notice: `Saved and selected “${saved.name}”.` });
    };

    const confirmDelete = () => {
      const { workflowId, name } = editor$.value;
      if (!workflowId) return;
      workflowStore.remove(workflowId);
      editorActions.openNew();
      editorActions.update({ notice: `Deleted “${name}”.` });
    };

    const importFile = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) void file.text().then((md) => editorActions.importMd(md));
      input.value = "";
    };

    const renderSteps = (state: EditorState, errors: Record<string, string>, generating: boolean) => html`
      ${
        state.steps.length === 0
          ? html`<p class="empty">
              No recorded steps. Open the trace, select actions, and choose “New workflow from selected”.
            </p>`
          : html`<ol class="step-list">
              ${state.steps.map(
                (step, index) =>
                  html`<li class="step ${step.included ? "" : "is-excluded"}">
                    <div class="step-header">
                      <label class="inline">
                        <input
                          type="checkbox"
                          .checked=${step.included}
                          @change=${() => updateStep(step.id, { included: !step.included })}
                        />
                        Include
                      </label>
                      <span class="step-index">${index + 1}</span>
                      ${actorBadge(step.actor)}
                      <code>${step.action}</code>
                      ${step.humanOnly ? html`<span class="tag">Human step</span>` : nothing}
                      <span class="spacer"></span>
                      <button class="icon" title="Move up" ?disabled=${index === 0} @click=${() => moveStep(index, -1)}>
                        ↑
                      </button>
                      <button
                        class="icon"
                        title="Move down"
                        ?disabled=${index === state.steps.length - 1}
                        @click=${() => moveStep(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        class="icon"
                        title="Remove step"
                        @click=${() => setSteps(steps().filter((s) => s.id !== step.id))}
                      >
                        ✕
                      </button>
                    </div>
                    <label class="field">
                      <span>Why this step matters</span>
                      <input
                        type="text"
                        .value=${step.note}
                        placeholder="e.g. Focus on tactile matte materials"
                        @change=${(e: Event) => updateStep(step.id, { note: (e.target as HTMLInputElement).value })}
                      />
                    </label>
                    <details>
                      <summary>Arguments</summary>
                      <textarea
                        class="code"
                        .value=${JSON.stringify(step.args, null, 1)}
                        @change=${(e: Event) => updateArgs(step.id, (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                      ${errors[step.id] ? html`<p class="error">${errors[step.id]}</p>` : nothing}
                    </details>
                    ${step.thumbs.length ? html`<div class="trace-thumbs">${step.thumbs.map((src) => html`<img src=${src} alt="" />`)}</div>` : nothing}
                  </li>`,
              )}
            </ol>`
      }
      <div class="form-row">
        <label class="field grow">
          <span>Goal</span>
          <input
            type="text"
            .value=${state.goal}
            placeholder="What should this workflow achieve?"
            @input=${(e: Event) => editorActions.update({ goal: (e.target as HTMLInputElement).value })}
          />
        </label>
        <button
          class="primary"
          ?disabled=${generating || !state.steps.some((s) => s.included) || Object.keys(errors).length > 0}
          @click=${generate}
        >
          ${generating ? "Generating…" : "Generate instructions"}
        </button>
      </div>
    `;

    const renderInstructions = (state: EditorState) => {
      const validation = state.md.trim() ? validateAgentsMd(state.md, runtime.registry.keys()) : null;
      return html`
        <textarea
          class="code instructions"
          spellcheck="false"
          aria-label="Instructions (AGENTS.md)"
          .value=${state.md}
          placeholder="# Workflow name&#10;## Tools&#10;## Workflow&#10;## Aesthetic & Quality Criteria&#10;## Guardrails & Stop Conditions"
          @input=${(e: Event) => editorActions.update({ md: (e.target as HTMLTextAreaElement).value })}
        ></textarea>
        ${
          validation && (validation.unknownActions.length || validation.missingSections.length)
            ? html`<ul class="warnings">
                ${validation.unknownActions.map((name) => html`<li>Unknown tool <code>${name}</code></li>`)}
                ${validation.missingSections.map((name) => html`<li>Missing section “${name}”</li>`)}
              </ul>`
            : nothing
        }
        <div class="form-row">
          <label class="file-button">
            Import AGENTS.md…
            <input type="file" accept=".md,text/markdown,text/plain" @change=${importFile} />
          </label>
          <button
            ?disabled=${!state.md.trim()}
            @click=${() => exportAgentsMd({ id: "", name: state.name, agentsMd: state.md, createdAt: 0, updatedAt: 0 })}
          >
            Download AGENTS.md
          </button>
        </div>
      `;
    };

    return combineLatest([editor$, argErrors$, generating$]).pipe(
      map(([state, errors, generating]) => {
        const isSaved = !!state.workflowId;
        return html`
          <dialog id="workflow-editor" class="app-dialog" aria-labelledby="workflow-editor-title">
            <header class="dialog-header">
              <h2 id="workflow-editor-title">${isSaved ? "Edit workflow" : "New workflow"}</h2>
              <input
                class="title-input"
                type="text"
                aria-label="Workflow name"
                placeholder="Workflow name"
                .value=${state.name}
                @input=${(e: Event) => editorActions.update({ name: (e.target as HTMLInputElement).value })}
              />
              <nav class="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected=${state.tab === "steps"}
                  @click=${() => editorActions.update({ tab: "steps" })}
                >
                  Steps${state.steps.length ? ` (${state.steps.length})` : ""}
                </button>
                <button
                  role="tab"
                  aria-selected=${state.tab === "instructions"}
                  @click=${() => editorActions.update({ tab: "instructions" })}
                >
                  Instructions
                </button>
              </nav>
              <button commandfor="workflow-editor" command="close">Close</button>
            </header>
            ${state.notice ? html`<p class="notice">${state.notice}</p>` : nothing}
            <section class="dialog-body">
              ${state.tab === "steps" ? renderSteps(state, errors, generating) : renderInstructions(state)}
            </section>
            <footer class="dialog-footer">
              ${
                isSaved
                  ? html`<button class="danger" commandfor="workflow-delete-confirm" command="show-modal">
                      Delete
                    </button>`
                  : nothing
              }
              <span class="spacer"></span>
              <button class="primary" ?disabled=${!state.md.trim()} @click=${save}>
                ${isSaved ? "Save" : "Save workflow"}
              </button>
            </footer>
          </dialog>
          <dialog id="workflow-delete-confirm" class="app-dialog confirm" aria-labelledby="workflow-delete-title">
            <h2 id="workflow-delete-title">Delete “${state.name}”?</h2>
            <p>This removes the workflow from this browser. It cannot be undone.</p>
            <footer class="dialog-footer">
              <span class="spacer"></span>
              <button commandfor="workflow-delete-confirm" command="close">Cancel</button>
              <button class="danger" commandfor="workflow-delete-confirm" command="close" @click=${confirmDelete}>
                Delete
              </button>
            </footer>
          </dialog>
        `;
      }),
    );
  },
);
