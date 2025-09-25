import { merge, Observable, of } from "rxjs";
import { map } from "rxjs/operators";

export type PasteAction = { type: "image"; src: string } | { type: "text"; content: string };

export function processClipboardPaste(event: ClipboardEvent): Observable<PasteAction> {
  const items = event.clipboardData?.items;
  if (!items) return of();

  const observables: Observable<PasteAction>[] = [];

  // Handle images
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        const obs = new Observable<string>((subscriber) => {
          reader.onload = (e) => {
            const src = e.target?.result as string;
            subscriber.next(src);
            subscriber.complete();
          };
          reader.onerror = () => subscriber.error(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        }).pipe(map((src) => ({ type: "image" as const, src })));
        observables.push(obs);
      }
    }
  }

  // Handle text
  const textPlain = event.clipboardData?.getData("text/plain");
  if (textPlain && textPlain.trim()) {
    observables.push(of({ type: "text" as const, content: textPlain }));
  } else {
    const textHtml = event.clipboardData?.getData("text/html");
    if (textHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(textHtml, "text/html");
      const text = doc.body.textContent || "";
      if (text && text.trim()) {
        observables.push(of({ type: "text" as const, content: text }));
      }
    }
  }

  return merge(...observables);
}
