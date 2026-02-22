import { merge, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import type { CanvasItem } from "./canvas.component";

export type PasteAction = { type: "image"; src: string } | { type: "text"; content: string };

const CANVAS_ITEMS_TEXT_PREFIX = "__canvas_items__:";

interface ProcessClipboardPasteOptions {
  includeImages?: boolean;
}

function stripTransientFields(item: CanvasItem): Omit<CanvasItem, "isSelected" | "zIndex"> {
  const { isSelected: _, zIndex: _z, ...rest } = item;
  return rest;
}

export function serializeItemsForClipboardText(items: CanvasItem[]): string {
  const serialized = items.map(stripTransientFields);
  return `${CANVAS_ITEMS_TEXT_PREFIX}${JSON.stringify(serialized)}`;
}

export function parseItemsFromClipboardText(text: string): CanvasItem[] | null {
  if (!text.startsWith(CANVAS_ITEMS_TEXT_PREFIX)) return null;

  try {
    const parsed = JSON.parse(text.slice(CANVAS_ITEMS_TEXT_PREFIX.length)) as CanvasItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function copyItemsToClipboard(event: ClipboardEvent, items: CanvasItem[]): void {
  const serialized = items.map(stripTransientFields);
  event.clipboardData?.setData("text/x-canvas-items", JSON.stringify(serialized));
  const textContent = items
    .map((i) => [i.title, i.body].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("\n");
  event.clipboardData?.setData("text/plain", textContent || "canvas items");
}

export function processClipboardPaste(
  event: ClipboardEvent,
  options: ProcessClipboardPasteOptions = {},
): Observable<PasteAction> {
  const items = event.clipboardData?.items;
  if (!items) return of();

  const { includeImages = true } = options;

  const observables: Observable<PasteAction>[] = [];

  // Handle images
  if (includeImages) {
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
