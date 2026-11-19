import { html } from "lit-html";
import {
  BehaviorSubject,
  filter,
  ignoreElements,
  map,
  mergeWith,
  Observable,
  tap,
  withLatestFrom,
} from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getActionRuntime, runUserAction } from "../../../lib/actions/app-runtime";
import { SCAN_LENSES, type ScanLens } from "../../../lib/actions/defs/generate";
import type { ApiKeys } from "../../connections/storage";
import "./conceptual-scan.tool.css";

export const ConceptualScanTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const scanTypes = (Object.keys(SCAN_LENSES) as ScanLens[]).map((id) => ({
      id,
      label: `${id[0].toUpperCase()}${id.slice(1)}`,
    }));
    const runtime = getActionRuntime(items$, apiKeys$);

    const scan$ = new BehaviorSubject<(typeof scanTypes)[number] | null>(null);

    const scanEffect$ = scan$.pipe(
      filter((scanType): scanType is (typeof scanTypes)[number] => scanType !== null),
      withLatestFrom(selected$),
      tap(([scanType, selected]) => {
        if (selected.length === 0) return;
        runUserAction(runtime, "scan_concept", { lens: scanType.id, cardIds: selected.map((item) => item.id) });
      }),
      ignoreElements(),
    );

    const template$ = selected$.pipe(
      map((selected) => {
        if (selected.length === 0) return html``;

        return html`
          <div class="conceptual-scan-section">
            <div class="scan-options">
              ${scanTypes.map(
                (scanType) => html`
                  <button class="scan-option" @click=${() => scan$.next(scanType)}>${scanType.label}</button>
                `,
              )}
            </div>
          </div>
        `;
      }),
    );

    return template$.pipe(mergeWith(scanEffect$));
  },
);
