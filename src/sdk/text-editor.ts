import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { noChange } from "lit-html";
import { AsyncDirective, directive } from "lit-html/async-directive.js";

const baseExtensions = [
  keymap.of(defaultKeymap),
  EditorView.lineWrapping,
  EditorView.theme({
    "&": {
      border: "1px solid #ccc",
      backgroundColor: "#fff",
      color: "#222",
      fontFamily: "inherit",
      fontSize: "inherit",
    },
    ".cm-content": {
      minHeight: "8ch",
      padding: "1ch",
      caretColor: "#000",
    },
    "&.cm-focused": {
      outline: "2px solid #000",
      outlineOffset: "0",
    },
    ".cm-scroller": {
      fontFamily: "inherit",
      lineHeight: "1.4",
    },
    ".cm-gutters": {
      display: "none",
    },
  }),
];

class TextEditorDirective extends AsyncDirective {
  private view: EditorView | null = null;
  private container: HTMLDivElement | null = null;
  private currentDoc = "";
  private onChange: ((value: string) => void) | null = null;
  private suppressUpdate = false;

  render(doc: string, onChange: (value: string) => void) {
    this.onChange = onChange;
    if (!this.view) {
      this.container = document.createElement("div");
      this.container.className = "text-editor";
      this.currentDoc = doc;
      queueMicrotask(() => this.mount(doc));
      return this.container;
    }

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

export const textEditor = directive(TextEditorDirective);
