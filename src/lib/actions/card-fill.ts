import { EMPTY, Observable, catchError, concat, defer, finalize, ignoreElements, last, map, mergeMap, of, tap } from "rxjs";
import { fillCard } from "../../components/canvas/ai-helpers";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { generateImage } from "../../components/design/generate-image-gemini";
import { progress$ } from "../../components/progress/progress";
import type { ActionContext, PendingKind } from "./types";

export interface CardFillDeps {
  fill: typeof fillCard;
  render: (apiKey: string, prompt: string) => Observable<string>;
}

const defaultDeps: CardFillDeps = {
  fill: fillCard,
  render: (apiKey, prompt) => generateImage({ apiKey }, { prompt, width: 512, height: 512 }).pipe(map((r) => r.url)),
};

export function needsFill(item: CanvasItem): boolean {
  const hasContent = !!(item.title || item.body || item.imageSrc || item.imagePrompt || item.videoSrc);
  const missingText = !item.title || !item.body;
  const missingImage = !item.videoSrc && !item.imagePrompt && !item.imageSrc;
  return hasContent && (missingText || missingImage);
}

export function needsRender(item: CanvasItem): boolean {
  return !!item.imagePrompt?.trim() && !item.imageSrc && !item.videoSrc;
}

/**
 * Fill missing text and render missing images for a card, owned by the action layer (not the view).
 * Marks `metadata.pending` while working and completes once the card has settled.
 */
export function settleCard$(
  id: string,
  ctx: Pick<ActionContext, "items$" | "apiKey">,
  deps: CardFillDeps = defaultDeps,
): Observable<void> {
  const find = () => ctx.items$.value.find((item) => item.id === id);
  const patch = (update: Partial<CanvasItem>, pending: PendingKind | undefined) => {
    ctx.items$.next(
      ctx.items$.value.map((item) =>
        item.id === id ? { ...item, ...update, metadata: { ...item.metadata, pending, pendingImage: undefined } } : item,
      ),
    );
  };

  const fillStep$ = defer(() => {
    const item = find();
    if (!item || !ctx.apiKey || !needsFill(item)) return EMPTY;
    patch({}, "fill");
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    return deps
      .fill(
        {
          title: item.title,
          body: item.body,
          imagePrompt: item.imagePrompt,
          imageSrc: item.imageSrc,
          videoSrc: item.videoSrc,
          videoMimeType: item.videoMimeType,
        },
        ctx.apiKey,
      )
      .pipe(
        tap((updates) => {
          const current = find();
          if (!current) return;
          // Only fill fields that are still empty (user may have typed meanwhile).
          const safe: Partial<CanvasItem> = {};
          if (updates.title && !current.title) safe.title = updates.title;
          if (updates.body && !current.body) safe.body = updates.body;
          if (updates.imagePrompt && !current.imagePrompt && !current.imageSrc && !current.videoSrc)
            safe.imagePrompt = updates.imagePrompt;
          patch(safe, "fill");
        }),
        catchError((error) => {
          console.error("Card fill failed", error);
          return EMPTY;
        }),
        finalize(() => progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) })),
        ignoreElements(),
      );
  });

  const renderStep$ = defer(() => {
    const item = find();
    if (!item || !ctx.apiKey || !needsRender(item)) return EMPTY;
    patch({}, "image");
    return deps.render(ctx.apiKey, item.imagePrompt!).pipe(
      tap((url) => {
        if (find()) patch({ imageSrc: url }, "image");
      }),
      catchError((error) => {
        console.error("Card render failed", error);
        return EMPTY;
      }),
      ignoreElements(),
    );
  });

  return concat(fillStep$, renderStep$).pipe(
    finalize(() => {
      const item = find();
      if (item?.metadata?.pending) patch({}, undefined);
    }),
    last(undefined, undefined),
    map(() => undefined),
  );
}

/** Settle several cards concurrently; completes when all have settled. */
export function settleCards$(
  ids: string[],
  ctx: Pick<ActionContext, "items$" | "apiKey">,
  deps?: CardFillDeps,
): Observable<void> {
  if (!ids.length) return of(undefined);
  return of(...ids).pipe(
    mergeMap((id) => settleCard$(id, ctx, deps), 4),
    last(undefined, undefined),
    map(() => undefined),
  );
}
