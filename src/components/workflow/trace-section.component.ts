import { html } from "lit-html";
import { map } from "rxjs";
import type { ActionRuntime } from "../../lib/actions/runtime";
import { createComponent } from "../../sdk/create-component";
import { traceRow } from "./trace-list";
import "./workflow.css";

const RECENT_TRACE_COUNT = 4;

/** Context-tray section: the latest trace items, with Open (trace dialog) and Clear. */
export const TraceSectionComponent = createComponent(({ runtime }: { runtime: ActionRuntime }) =>
  runtime.log.records$.pipe(
    map((records) => {
      const recent = records.slice(-RECENT_TRACE_COUNT).reverse();
      return html`
        <div class="trace-section">
          ${
            recent.length
              ? html`<ol class="trace-list compact">
                  ${recent.map((record) => traceRow(record))}
                </ol>`
              : html`<p class="empty">Actions by you and the AI will appear here.</p>`
          }
          <div class="trace-actions">
            <button commandfor="trace-dialog" command="show-modal" title="Review the full trace and what the AI sees">
              Open
            </button>
            <button
              ?disabled=${records.length === 0}
              title="Remove all recorded actions"
              @click=${() => runtime.log.clear()}
            >
              Clear
            </button>
          </div>
        </div>
      `;
    }),
  ),
);
