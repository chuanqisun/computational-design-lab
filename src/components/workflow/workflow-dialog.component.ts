import { html, nothing, type TemplateResult } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  finalize,
  from,
  ignoreElements,
  map,
  mergeWith,
  switchMap,
  tap,
  type Observable,
} from "rxjs";
import { isAgentVisible } from "../../lib/actions/registry";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { allowsClearCanvas } from "../../lib/workflows/workflow-storage";
import { browserEncoders } from "../../lib/agent/media-encode";
import { buildObservation, type ObservationPart } from "../../lib/agent/observe";
import { summarizeTraceToAgentsMd$, type CatalogEntry } from "../../lib/workflows/summarize-agents-md";
import { activeWorkflowId$, workflowStore, workflows$ } from "../../lib/workflows/workflow-store";
import {
  exportAgentsMd,
  recordsToTrace,
  validateAgentsMd,
  workflowNameFromMd,
  type TraceStep,
} from "../../lib/workflows/workflow-storage";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { submitTask } from "../context-tray/tasks";
import "./workflow.css";

type Tab = "activity" | "trace" | "agents" | "saved" | "agent-view";

const TABS: { id: Tab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "trace", label: "Trace" },
  { id: "agents", label: "AGENTS.md" },
  { id: "saved", label: "Saved" },
  { id: "agent-view", label: "Agent view" },
];

interface EditorState {
  workflowId?: string;
  name: string;
  md: string;
}

const timeOf = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const WorkflowDialogComponent = createComponent(
  ({ runtime, apiKeys$ }: { runtime: ActionRuntime; apiKeys$: BehaviorSubject<ApiKeys> }) => {
    const tab$ = new BehaviorSubject<Tab>("activity");
    const checked$ = new BehaviorSubject<Set<string>>(new Set());
    const draft$ = new BehaviorSubject<TraceStep[]>([]);
    const draftName$ = new BehaviorSubject("");
    const draftGoal$ = new BehaviorSubject("");
    const argErrors$ = new BehaviorSubject<Record<string, string>>({});
    const editor$ = new BehaviorSubject<EditorState>({ name: "", md: "" });
    const generating$ = new BehaviorSubject(false);
    const message$ = new BehaviorSubject("");
    const pendingDeleteId$ = new BehaviorSubject<string | null>(null);
    const importText$ = new BehaviorSubject("");
    const preview$ = new BehaviorSubject<ObservationPart[] | null>(null);
    const dialogOpen$ = new BehaviorSubject(false);

    const isHumanOnly = (action: string) => {
      const def = runtime.registry.get(action);
      return !!def && typeof def.agent === "object";
    };

    const catalog = (): CatalogEntry[] =>
      [...runtime.registry.values()]
        .filter((def) => def.agent !== "perception")
        .map((def) => ({ name: def.name, description: def.description, humanOnly: typeof def.agent === "object" }));

    // --- Activity ---
    const toggleChecked = (id: string) => {
      const next = new Set(checked$.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      checked$.next(next);
    };

    const editSelectedAsTrace = () => {
      const records = runtime.log.records.filter((record) => checked$.value.has(record.id));
      if (!records.length) return;
      draft$.next(recordsToTrace(records, isHumanOnly));
      argErrors$.next({});
      tab$.next("trace");
    };

    // --- Trace ---
    const updateStep = (id: string, patch: Partial<TraceStep>) =>
      draft$.next(draft$.value.map((step) => (step.id === id ? { ...step, ...patch } : step)));

    const moveStep = (index: number, delta: number) => {
      const steps = [...draft$.value];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      draft$.next(steps);
    };

    const updateArgs = (id: string, text: string) => {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Args must be a JSON object");
        updateStep(id, { args: parsed });
        const { [id]: _removed, ...rest } = argErrors$.value;
        argErrors$.next(rest);
      } catch (error) {
        argErrors$.next({ ...argErrors$.value, [id]: error instanceof Error ? error.message : "Invalid JSON" });
      }
    };

    const generateAgentsMd = () => {
      const apiKey = apiKeys$.value.gemini;
      const name = draftName$.value.trim() || "Untitled workflow";
      if (!apiKey) {
        message$.next("Gemini API key required to generate AGENTS.md.");
        return;
      }
      generating$.next(true);
      message$.next("");
      submitTask(
        summarizeTraceToAgentsMd$({ name, goal: draftGoal$.value, steps: draft$.value, catalog: catalog(), apiKey }).pipe(
          tap({
            next: (md) => {
              editor$.next({ name, md });
              tab$.next("agents");
            },
            error: (error) => message$.next(error instanceof Error ? error.message : "Generation failed"),
          }),
          finalize(() => generating$.next(false)),
        ),
      );
    };

    // --- AGENTS.md ---
    const saveEditor = (makeActive: boolean) => {
      const { workflowId, name, md } = editor$.value;
      if (!md.trim()) return;
      const saved = workflowStore.save({
        id: workflowId,
        name: name.trim() || workflowNameFromMd(md, "Untitled workflow"),
        agentsMd: md,
        sourceSteps: workflowId ? undefined : draft$.value,
      });
      editor$.next({ workflowId: saved.id, name: saved.name, md: saved.agentsMd });
      if (makeActive) workflowStore.setActive(saved.id);
      message$.next(`Saved "${saved.name}"${makeActive ? " and set active" : ""}.`);
    };

    const importMd = (md: string) => {
      if (!md.trim()) return;
      const saved = workflowStore.import(md);
      editor$.next({ workflowId: saved.id, name: saved.name, md: saved.agentsMd });
      importText$.next("");
      message$.next(`Imported "${saved.name}".`);
      tab$.next("agents");
    };

    const importFile = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then(importMd);
      input.value = "";
    };

    // --- Agent view (what the agent would perceive right now) ---
    const refreshPreview = () =>
      from(
        (async () => {
          const state = runtime.getUiState();
          const md = workflowStore.active()?.agentsMd ?? "";
          const available: string[] = [];
          const unavailable: { name: string; reason: string }[] = [];
          for (const def of [...runtime.registry.values()].filter(isAgentVisible)) {
            if (def.name === "clear_canvas" && !allowsClearCanvas(md)) {
              unavailable.push({ name: def.name, reason: "Not allowed by the workflow" });
              continue;
            }
            const result = runtime.availability(def.name, "board");
            if (result === true) available.push(def.name);
            else unavailable.push({ name: def.name, reason: result.reason });
          }
          return buildObservation({
            state,
            items: runtime.items$.value,
            available,
            unavailable,
            mediaCardIds: state.selectedIds,
            encoders: browserEncoders,
          });
        })(),
      ).pipe(tap((parts) => preview$.next(parts)));

    const previewEffect$ = combineLatest([tab$, dialogOpen$]).pipe(
      filter(([tab, open]) => open && tab === "agent-view"),
      switchMap(() => runtime.items$.pipe(debounceTime(300))),
      switchMap(() => refreshPreview()),
      ignoreElements(),
    );

    // Listen on the target dialog itself (command/toggle events do not bubble).
    const onDialogToggle = (event: Event) => dialogOpen$.next((event as ToggleEvent).newState === "open");

    // --- Rendering ---
    const renderActivity = (records = runtime.log.records, checked: Set<string>) => html`
      <div class="wf-toolbar">
        <button @click=${editSelectedAsTrace} ?disabled=${checked.size === 0}>Edit selected as trace (${checked.size})</button>
        <button @click=${() => checked$.next(new Set(records.filter((r) => r.status === "done").map((r) => r.id)))}>
          Select all
        </button>
        <button @click=${() => checked$.next(new Set())} ?disabled=${checked.size === 0}>Clear selection</button>
        <button @click=${() => runtime.log.clear()} ?disabled=${records.length === 0}>Clear log</button>
      </div>
      ${records.length === 0
        ? html`<p class="wf-empty">No actions yet. Everything you or the agent do on the board appears here.</p>`
        : html`<ol class="wf-timeline">
            ${records.map(
              (record) => html`<li class="status-${record.status}">
                <label>
                  <input type="checkbox" .checked=${checked.has(record.id)} @change=${() => toggleChecked(record.id)} />
                  <span class="actor-pill actor-${record.actor}">${record.actor === "ai" ? "AI" : "User"}</span>
                  <code>${record.action}</code>
                  <span class="summary">${record.summary || record.status}</span>
                  <time>${timeOf(record.timestamp)}</time>
                </label>
                ${record.outputThumbs.length
                  ? html`<div class="thumbs">${record.outputThumbs.map((src) => html`<img src=${src} alt="" />`)}</div>`
                  : nothing}
              </li>`,
            )}
          </ol>`}
    `;

    const renderTrace = (steps: TraceStep[], name: string, goal: string, errors: Record<string, string>, generating: boolean) => html`
      ${steps.length === 0
        ? html`<p class="wf-empty">Select actions in Activity, then "Edit selected as trace".</p>`
        : html`<ol class="wf-trace">
            ${steps.map(
              (step, index) => html`<li class=${step.included ? "" : "excluded"}>
                <header>
                  <label><input type="checkbox" .checked=${step.included} @change=${() => updateStep(step.id, { included: !step.included })} /> Include</label>
                  <span class="actor-pill actor-${step.actor}">${step.actor === "ai" ? "AI" : "User"}</span>
                  <code>${step.action}</code>
                  ${step.humanOnly ? html`<span class="human-step">Human step</span>` : nothing}
                  <span class="spacer"></span>
                  <button title="Move up" ?disabled=${index === 0} @click=${() => moveStep(index, -1)}>↑</button>
                  <button title="Move down" ?disabled=${index === steps.length - 1} @click=${() => moveStep(index, 1)}>↓</button>
                  <button title="Remove" @click=${() => draft$.next(draft$.value.filter((s) => s.id !== step.id))}>✕</button>
                </header>
                <label>Args (JSON)
                  <textarea class="args" .value=${JSON.stringify(step.args, null, 1)} @change=${(e: Event) => updateArgs(step.id, (e.target as HTMLTextAreaElement).value)}></textarea>
                </label>
                ${errors[step.id] ? html`<p class="wf-error">${errors[step.id]}</p>` : nothing}
                <label>Note (why this step matters)
                  <input type="text" .value=${step.note} placeholder="e.g. Focus on tactile matte materials" @change=${(e: Event) => updateStep(step.id, { note: (e.target as HTMLInputElement).value })} />
                </label>
                ${step.thumbs.length ? html`<div class="thumbs">${step.thumbs.map((src) => html`<img src=${src} alt="" />`)}</div>` : nothing}
              </li>`,
            )}
          </ol>`}
      <div class="wf-form">
        <label>Workflow name <input type="text" .value=${name} @input=${(e: Event) => draftName$.next((e.target as HTMLInputElement).value)} /></label>
        <label>Goal <input type="text" .value=${goal} @input=${(e: Event) => draftGoal$.next((e.target as HTMLInputElement).value)} /></label>
        <button
          ?disabled=${generating || !steps.some((s) => s.included) || Object.keys(errors).length > 0}
          @click=${generateAgentsMd}
        >
          ${generating ? "Generating…" : "Generate AGENTS.md"}
        </button>
      </div>
    `;

    const renderAgents = (editor: EditorState, importText: string) => {
      const validation = editor.md ? validateAgentsMd(editor.md, runtime.registry.keys()) : null;
      return html`
        <div class="wf-form">
          <label>Name <input type="text" .value=${editor.name} @input=${(e: Event) => editor$.next({ ...editor$.value, name: (e.target as HTMLInputElement).value })} /></label>
        </div>
        <textarea
          class="agents-md"
          spellcheck="false"
          .value=${editor.md}
          placeholder="# Workflow name&#10;## Tools&#10;## Workflow&#10;## Aesthetic & Quality Criteria&#10;## Guardrails & Stop Conditions"
          @input=${(e: Event) => editor$.next({ ...editor$.value, md: (e.target as HTMLTextAreaElement).value })}
        ></textarea>
        ${validation && (validation.unknownActions.length || validation.missingSections.length)
          ? html`<ul class="wf-warnings">
              ${validation.unknownActions.map((name) => html`<li>Unknown tool: <code>${name}</code></li>`)}
              ${validation.missingSections.map((name) => html`<li>Missing section: ${name}</li>`)}
            </ul>`
          : nothing}
        <div class="wf-toolbar">
          <button ?disabled=${!editor.md.trim()} @click=${() => saveEditor(false)}>Save</button>
          <button ?disabled=${!editor.md.trim()} @click=${() => saveEditor(true)}>Save &amp; set active</button>
          <button
            ?disabled=${!editor.md.trim()}
            @click=${() => exportAgentsMd({ id: "", name: editor.name, agentsMd: editor.md, createdAt: 0, updatedAt: 0 })}
          >
            Download AGENTS.md
          </button>
        </div>
        <details class="wf-import">
          <summary>Import AGENTS.md</summary>
          <input type="file" accept=".md,text/markdown,text/plain" @change=${importFile} />
          <textarea placeholder="…or paste Markdown here" .value=${importText} @input=${(e: Event) => importText$.next((e.target as HTMLTextAreaElement).value)}></textarea>
          <button ?disabled=${!importText.trim()} @click=${() => importMd(importText$.value)}>Import pasted</button>
        </details>
      `;
    };

    const renderSaved = (workflows = workflows$.value, activeId: string | null) =>
      workflows.length === 0
        ? html`<p class="wf-empty">No saved workflows. Generate one from a trace or import an AGENTS.md.</p>`
        : html`<ul class="wf-saved">
            ${workflows.map(
              (workflow) => html`<li class=${workflow.id === activeId ? "active" : ""}>
                <strong>${workflow.name}</strong>
                ${workflow.id === activeId ? html`<span class="badge">active</span>` : nothing}
                <time>${new Date(workflow.updatedAt).toLocaleString()}</time>
                <span class="spacer"></span>
                <button ?disabled=${workflow.id === activeId} @click=${() => workflowStore.setActive(workflow.id)}>Set active</button>
                <button
                  @click=${() => {
                    editor$.next({ workflowId: workflow.id, name: workflow.name, md: workflow.agentsMd });
                    tab$.next("agents");
                  }}
                >
                  Edit
                </button>
                <button
                  commandfor="workflow-delete-confirm"
                  command="show-modal"
                  @click=${() => pendingDeleteId$.next(workflow.id)}
                >
                  Delete
                </button>
              </li>`,
            )}
          </ul>`;

    const renderPreview = (parts: ObservationPart[] | null) => html`
      <div class="wf-toolbar">
        <button @click=${() => submitTask(refreshPreview())}>Refresh</button>
        <span class="hint">Exactly what the agent receives as its observation (media: selected cards).</span>
      </div>
      ${parts === null
        ? html`<p class="wf-empty">Loading…</p>`
        : html`<div class="wf-preview">
            ${parts.map((part): TemplateResult => {
              if (part.type === "text") return html`<pre>${part.text}</pre>`;
              if (part.type === "image") return html`<img src="data:${part.mime_type};base64,${part.data}" alt="" />`;
              return html`<video controls src="data:${part.mime_type};base64,${part.data}"></video>`;
            })}
          </div>`}
    `;

    const body$: Observable<TemplateResult> = combineLatest([
      tab$,
      runtime.log.records$,
      checked$,
      draft$,
      draftName$,
      draftGoal$,
      argErrors$,
      generating$,
      editor$,
      importText$,
      workflows$,
      activeWorkflowId$,
      preview$,
      message$,
    ]).pipe(
      map(([tab, records, checked, draft, name, goal, errors, generating, editor, importText, workflows, activeId, preview, message]) => {
        const content =
          tab === "activity"
            ? renderActivity(records, checked)
            : tab === "trace"
              ? renderTrace(draft, name, goal, errors, generating)
              : tab === "agents"
                ? renderAgents(editor, importText)
                : tab === "saved"
                  ? renderSaved(workflows, activeId)
                  : renderPreview(preview);
        return html`
          <header class="wf-header">
            <h2 id="workflow-dialog-title">Workflow</h2>
            <nav class="wf-tabs" role="tablist">
              ${TABS.map(
                (entry) => html`<button
                  role="tab"
                  aria-selected=${tab === entry.id ? "true" : "false"}
                  @click=${() => tab$.next(entry.id)}
                >
                  ${entry.label}
                </button>`,
              )}
            </nav>
            <button commandfor="workflow-dialog" command="close">Close</button>
          </header>
          ${message ? html`<p class="wf-message">${message}</p>` : nothing}
          <section class="wf-body">${content}</section>
        `;
      }),
    );

    const confirmDelete = () => {
      const id = pendingDeleteId$.value;
      if (id) workflowStore.remove(id);
      pendingDeleteId$.next(null);
    };

    return body$.pipe(
      map(
        (body) => html`
          <dialog id="workflow-dialog" class="workflow-dialog" aria-labelledby="workflow-dialog-title" @toggle=${onDialogToggle}>
            ${body}
          </dialog>
          <dialog id="workflow-delete-confirm" class="workflow-confirm">
            <p>Delete this workflow? This cannot be undone.</p>
            <menu>
              <button commandfor="workflow-delete-confirm" command="close" @click=${() => pendingDeleteId$.next(null)}>Cancel</button>
              <button class="danger" commandfor="workflow-delete-confirm" command="close" @click=${confirmDelete}>Delete</button>
            </menu>
          </dialog>
        `,
      ),
      mergeWith(previewEffect$),
    );
  },
);
