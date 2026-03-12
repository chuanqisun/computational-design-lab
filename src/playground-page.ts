import "./playground-page.css";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, map, merge, tap, ignoreElements, mergeWith, Subject } from "rxjs";
import { createComponent } from "./sdk/create-component";
import { textEditor, jsonLang } from "./sdk/text-editor";
import { renderTemplate, registerHelpers } from "./lib/playground-template";
import { builtinTemplates } from "./lib/playground-templates-data";
import { persistSubject } from "./lib/persistence";

registerHelpers();

const selectedTemplateId$ = new BehaviorSubject<string>(builtinTemplates[0].id);
const templateSource$ = new BehaviorSubject<string>(builtinTemplates[0].promptTemplate);
const variablesJson$ = new BehaviorSubject<string>(JSON.stringify(builtinTemplates[0].defaultVariables, null, 2));

persistSubject(selectedTemplateId$, "playground-template-id");
persistSubject(templateSource$, "playground-template-source");
persistSubject(variablesJson$, "playground-variables-json");

function getRenderedOutput(source: string, jsonStr: string): string {
  try {
    return renderTemplate(source, JSON.parse(jsonStr));
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

const Playground = createComponent(() => {
  const selectTemplate$ = new Subject<string>();
  const updateSource$ = new Subject<string>();
  const updateVariables$ = new Subject<string>();
  const copy$ = new Subject<void>();
  const copiedVisible$ = new BehaviorSubject(false);

  const effects$ = merge(
    selectTemplate$.pipe(
      tap((id) => {
        selectedTemplateId$.next(id);
        const tmpl = builtinTemplates.find((t) => t.id === id);
        if (tmpl) {
          templateSource$.next(tmpl.promptTemplate);
          variablesJson$.next(JSON.stringify(tmpl.defaultVariables, null, 2));
        }
      })
    ),
    updateSource$.pipe(tap((s) => templateSource$.next(s))),
    updateVariables$.pipe(tap((v) => variablesJson$.next(v))),
    copy$.pipe(
      tap(() => {
        const output = getRenderedOutput(templateSource$.value, variablesJson$.value);
        navigator.clipboard.writeText(output);
        copiedVisible$.next(true);
        setTimeout(() => copiedVisible$.next(false), 1500);
      })
    )
  ).pipe(ignoreElements());

  return combineLatest([selectedTemplateId$, templateSource$, variablesJson$, copiedVisible$]).pipe(
    map(([selectedId, source, varsJson, copied]) => {
      const output = getRenderedOutput(source, varsJson);
      return html`
        <div class="header">
          <h1>Prompt Playground</h1>
        </div>

        <div class="section">
          <label class="section-label">Template</label>
          <select @change=${(e: Event) => selectTemplate$.next((e.target as HTMLSelectElement).value)}>
            ${builtinTemplates.map(
              (t) => html`<option value=${t.id} ?selected=${t.id === selectedId}>${t.title} — ${t.description}</option>`
            )}
          </select>
        </div>

        <div class="editors">
          <div class="editor-pane">
            <label class="section-label">Prompt template (Handlebars)</label>
            ${textEditor(source, (v: string) => updateSource$.next(v))}
          </div>
          <div class="editor-pane">
            <label class="section-label">Variables (JSON)</label>
            ${textEditor(varsJson, (v: string) => updateVariables$.next(v), jsonLang())}
          </div>
        </div>

        <div class="output-area">
          <div class="output-header">
            <label class="section-label">Output</label>
            <span>
              ${copied ? html`<span class="copied-msg">Copied!</span>` : ""}
              <button @click=${() => copy$.next()}>Copy</button>
            </span>
          </div>
          <div class="output-text">${output}</div>
        </div>
      `;
    }),
    mergeWith(effects$)
  );
});

render(Playground(), document.getElementById("app")!);

