import { defaultKeymap } from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { noChange } from "lit-html";
import { AsyncDirective, directive } from "lit-html/async-directive.js";

const baseExtensions = [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of(defaultKeymap),
  xml(),
  oneDark,
];

class XmlEditorDirective extends AsyncDirective {
  private view: EditorView | null = null;
  private container: HTMLDivElement | null = null;
  private currentDoc = "";
  private onChange: ((value: string) => void) | null = null;
  private suppressUpdate = false;

  render(doc: string, onChange: (value: string) => void) {
    this.onChange = onChange;
    if (!this.view) {
      this.container = document.createElement("div");
      this.container.className = "xml-editor";
      this.currentDoc = doc;
      queueMicrotask(() => this.mount(doc));
      return this.container;
    }
    // Update content from outside if changed (e.g. streaming)
    if (doc !== this.currentDoc) {
      this.currentDoc = doc;
      this.suppressUpdate = true;
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: doc },
      });
      this.suppressUpdate = false;
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
          ...baseExtensions,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (this.suppressUpdate || !update.docChanged) return;
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
    if (this.container && !this.view) {
      this.mount(this.currentDoc);
    }
  }
}

export const xmlEditor = directive(XmlEditorDirective);

/** Mount a CodeMirror XML editor imperatively into a container element. Returns getter/destroy. */
export function mountXmlEditor(container: HTMLElement, doc: string) {
  const view = new EditorView({
    parent: container,
    state: EditorState.create({
      doc,
      extensions: baseExtensions,
    }),
  });
  return {
    getValue: () => view.state.doc.toString(),
    destroy: () => view.destroy(),
  };
}
