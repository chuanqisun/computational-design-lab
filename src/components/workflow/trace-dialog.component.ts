import { html, nothing, type TemplateResult } from "lit-html";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  from,
  ignoreElements,
  map,
  mergeWith,
  switchMap,
  tap,
} from "rxjs";
import { isAgentVisible } from "../../lib/actions/registry";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { agentStatus$, describeAgentStatus } from "../../lib/agent/agent-controller";
import { browserEncoders } from "../../lib/agent/media-encode";
import { buildObservation, type ObservationPart } from "../../lib/agent/observe";
import { editorActions, workflowStore } from "../../lib/workflows/workflow-store";
import { allowsClearCanvas } from "../../lib/workflows/workflow-storage";
import { createComponent } from "../../sdk/create-component";
import { submitTask } from "../context-tray/tasks";
import { traceRow } from "./trace-list";
import "./workflow.css";

type TraceTab = "timeline" | "ai-view";

/** The trace: everything you and the AI did, the AI's latest status, and what the AI currently perceives. */
export const TraceDialogComponent = createComponent(({ runtime }: { runtime: ActionRuntime }) => {
  const tab$ = new BehaviorSubject<TraceTab>("timeline");
  const checked$ = new BehaviorSubject<Set<string>>(new Set());
  const open$ = new BehaviorSubject(false);
  const preview$ = new BehaviorSubject<ObservationPart[] | null>(null);

  const isHumanOnly = (action: string) => typeof runtime.registry.get(action)?.agent === "object";

  const toggle = (id: string) => {
    const next = new Set(checked$.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    checked$.next(next);
  };

  const startWorkflowFromSelection = () => {
    const records = runtime.log.records.filter((record) => checked$.value.has(record.id));
    const targetsCards = (action: string) => {
      const properties = runtime.registry.get(action)?.parameters.properties ?? {};
      return "cardIds" in properties || "cardId" in properties;
    };
    editorActions.openFromTrace(records, isHumanOnly, targetsCards);
  };

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

  const previewEffect$ = combineLatest([tab$, open$]).pipe(
    filter(([tab, open]) => open && tab === "ai-view"),
    switchMap(() => runtime.items$.pipe(debounceTime(300))),
    switchMap(() => refreshPreview()),
    ignoreElements(),
  );

  // toggle does not bubble: listen on the dialog itself.
  const onToggle = (event: Event) => open$.next((event as ToggleEvent).newState === "open");

  const renderTimeline = (records = runtime.log.records, checked: Set<string>) => html`
    <div class="toolbar">
      <button
        class="primary"
        commandfor="workflow-editor"
        command="show-modal"
        ?disabled=${checked.size === 0}
        @click=${startWorkflowFromSelection}
      >
        New workflow from ${checked.size || ""} selected
      </button>
      <button @click=${() => checked$.next(new Set(records.filter((r) => r.status === "done").map((r) => r.id)))}>
        Select all
      </button>
      <button @click=${() => checked$.next(new Set())} ?disabled=${checked.size === 0}>Clear selection</button>
      <span class="spacer"></span>
      <button
        class="danger"
        @click=${() => (runtime.log.clear(), checked$.next(new Set()))}
        ?disabled=${records.length === 0}
      >
        Clear trace
      </button>
    </div>
    ${
      records.length === 0
        ? html`<p class="empty">No actions yet. Everything you or the AI do on the board is recorded here.</p>`
        : html`<ol class="trace-list">
            ${records.map((record) =>
              traceRow(record, { checked: checked.has(record.id), onToggle: () => toggle(record.id), thumbs: true }),
            )}
          </ol>`
    }
  `;

  const renderAiView = (parts: ObservationPart[] | null) => html`
    <div class="toolbar">
      <button @click=${() => submitTask(refreshPreview())}>Refresh</button>
      <span class="hint"
        >Exactly what the AI receives after each action. Images shown are from the selected cards.</span
      >
    </div>
    ${
      parts === null
        ? html`<p class="empty">Loading…</p>`
        : html`<div class="ai-view">
            ${parts.map((part): TemplateResult => {
              if (part.type === "text") return html`<pre>${part.text}</pre>`;
              if (part.type === "image") return html`<img src="data:${part.mime_type};base64,${part.data}" alt="" />`;
              return html`<video controls src="data:${part.mime_type};base64,${part.data}"></video>`;
            })}
          </div>`
    }
  `;

  return combineLatest([tab$, runtime.log.records$, checked$, agentStatus$, preview$]).pipe(
    map(
      ([tab, records, checked, status, preview]) => html`
        <dialog id="trace-dialog" class="app-dialog" aria-labelledby="trace-dialog-title" @toggle=${onToggle}>
          <header class="dialog-header">
            <h2 id="trace-dialog-title">Trace</h2>
            <nav class="tabs" role="tablist">
              <button role="tab" aria-selected=${tab === "timeline"} @click=${() => tab$.next("timeline")}>
                Timeline
              </button>
              <button role="tab" aria-selected=${tab === "ai-view"} @click=${() => tab$.next("ai-view")}>
                AI view
              </button>
            </nav>
            <button commandfor="trace-dialog" command="close">Close</button>
          </header>
          <div class="ai-status ${status.running ? "is-running" : ""}">
            <span class="status-dot"></span>
            <strong>AI ${describeAgentStatus(status).toLowerCase()}</strong>
            ${status.message ? html`<span class="ai-status-message">${status.message}</span>` : nothing}
          </div>
          <section class="dialog-body">
            ${tab === "timeline" ? renderTimeline(records, checked) : renderAiView(preview)}
          </section>
        </dialog>
      `,
    ),
    mergeWith(previewEffect$),
  );
});
