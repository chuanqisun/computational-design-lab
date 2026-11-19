import { html } from "lit-html";
import { BehaviorSubject, combineLatest, map, type Observable } from "rxjs";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { persistSubject } from "../../../lib/persistence";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import "./design.tool.css";

const MAX_CREATE = 4;
const MAX_ITERATE = 5;

/** Design section: Create new concepts (design_concepts) or Iterate on selected designs (iterate_designs). */
export const DesignTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const runtime = getActionRuntime(items$, apiKeys$);
    const brief$ = new BehaviorSubject("");
    const brandGuide$ = new BehaviorSubject("");
    const count$ = new BehaviorSubject(2);
    const busy$ = new BehaviorSubject<"create" | "iterate" | null>(null);

    void persistSubject(brief$, "context-tray:design:brief");
    void persistSubject(brandGuide$, "context-tray:design:brand-guide");
    void persistSubject(count$, "context-tray:design:count");

    const run = (mode: "create" | "iterate", selected: CanvasItem[]) => {
      if (!selected.length) return;
      const cardIds = selected.map((item) => item.id);
      const brief = brief$.value.trim();
      const brandGuide = brandGuide$.value;
      busy$.next(mode);
      const done = () => busy$.next(null);
      if (mode === "create") {
        runUserAction(
          runtime,
          "design_concepts",
          { requirements: brief, brandGuide, count: Math.min(count$.value, MAX_CREATE), cardIds },
          done,
        );
      } else {
        runUserAction(
          runtime,
          "iterate_designs",
          { direction: brief, brandGuide, count: Math.min(count$.value, MAX_ITERATE), cardIds },
          done,
        );
      }
    };

    return combineLatest([selected$, brief$, brandGuide$, count$, busy$, apiKeys$]).pipe(
      map(([selected, brief, brandGuide, count, busy, apiKeys]) => {
        const blocked = !apiKeys.gemini ? "Gemini API key required" : !selected.length ? "Select cards first" : "";
        return html`
          <div class="design-tool">
            <textarea
              rows="2"
              placeholder="Requirements for new designs, or feedback to iterate on..."
              .value=${brief}
              @input=${(e: Event) => brief$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <textarea
              class="brand-guide-input"
              rows="1"
              placeholder="Optional brand guide..."
              .value=${brandGuide}
              @input=${(e: Event) => brandGuide$.next((e.target as HTMLTextAreaElement).value)}
            ></textarea>
            <div class="design-row">
              <label for="design-count">Count</label>
              <input
                type="number"
                id="design-count"
                min="1"
                max=${MAX_ITERATE}
                .value=${String(count)}
                @input=${(e: Event) => count$.next(parseInt((e.target as HTMLInputElement).value) || 1)}
              />
              <button
                ?disabled=${!!busy || !!blocked}
                title=${blocked ||
                `Create ${Math.min(count, MAX_CREATE)} new design concept(s) inspired by the selected cards, following the requirements above (max ${MAX_CREATE}).`}
                @click=${() => run("create", selected)}
              >
                ${busy === "create" ? "Creating…" : "Create"}
              </button>
              <button
                ?disabled=${!!busy || !!blocked}
                title=${blocked ||
                `Iterate on the selected designs: produce ${Math.min(count, MAX_ITERATE)} improved variant(s) that address the feedback above (max ${MAX_ITERATE}).`}
                @click=${() => run("iterate", selected)}
              >
                ${busy === "iterate" ? "Iterating…" : "Iterate"}
              </button>
            </div>
          </div>
        `;
      }),
    );
  },
);
