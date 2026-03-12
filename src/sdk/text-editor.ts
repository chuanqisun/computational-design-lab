import { defaultKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { noChange } from "lit-html";
import { AsyncDirective, directive } from "lit-html/async-directive.js";

const sharedExtensions: Extension[] = [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of(defaultKeymap),
  EditorView.lineWrapping,
];

class TextEditorDirective extends AsyncDirective {
  private view: EditorView | null = null;
  private container: HTMLDivElement | null = null;
  private currentDoc = "";
  private onChange: ((value: string) => void) | null = null;
  private lang: Extension[] = [];

  render(doc: string, onChange: (value: string) => void, lang?: Extension[]) {
    this.onChange = onChange;
    this.lang = lang ?? [];
    if (!this.view) {
      this.container = document.createElement("div");
      this.container.className = "text-editor";
      this.currentDoc = doc;
      queueMicrotask(() => this.mount(doc));
      return this.container;
    }
    if (doc !== this.currentDoc) {
      this.currentDoc = doc;
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: doc },
      });
    }
    return noChange;
  }

  private mount(doc: string) {
    if (!this.container) return;
    this.view = new EditorView({
      parent: this.container,
      state: EditorState.create({
        doc,
        extensions: [
          ...sharedExtensions,
          ...this.lang,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            this.currentDoc = update.state.doc.toString();
            this.onChange?.(this.currentDoc);
          }),
        ],
      }),
    });
  }

  disconnected() {
    this.view?.destroy();
    this.view = null;
    this.container = null;
  }

  reconnected() {
    if (this.container && !this.view) this.mount(this.currentDoc);
  }
}

export const textEditor = directive(TextEditorDirective);
export const jsonLang = () => [json()];
