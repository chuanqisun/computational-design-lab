import type { CanvasItem } from "../../components/canvas/canvas.component";
import type { Actor, CardView, PendingKind, UiState, Viewport } from "./types";

export function cardKind(item: CanvasItem): CardView["kind"] {
  const hasText = !!(item.title?.trim() || item.body?.trim());
  const hasVisual = !!(item.videoSrc || item.imageSrc || item.imagePrompt);
  if (item.videoSrc) return hasText ? "mixed" : "video";
  if (item.imageSrc || item.imagePrompt) return hasText ? "mixed" : "image";
  if (hasText) return "text";
  return hasVisual ? "image" : "empty";
}

export function getPending(item: CanvasItem): PendingKind | undefined {
  const pending = item.metadata?.pending as PendingKind | undefined;
  if (pending) return pending;
  if (item.metadata?.pendingImage) return "image";
  return undefined;
}

export function toCardView(item: CanvasItem): CardView {
  return {
    id: item.id,
    kind: cardKind(item),
    title: item.title,
    body: item.body,
    isSelected: !!item.isSelected,
    pending: getPending(item),
    x: Math.round(item.x),
    y: Math.round(item.y),
    width: item.width,
    height: item.height,
    tag: typeof item.metadata?.kind === "string" ? item.metadata.kind : undefined,
  };
}

export function buildUiState(input: {
  items: CanvasItem[];
  running: { actionId: string; name: string; actor: Actor }[];
  viewport: Viewport;
  hasApiKey: boolean;
}): UiState {
  const cards = input.items.map(toCardView);
  return {
    cards,
    selectedIds: cards.filter((card) => card.isSelected).map((card) => card.id),
    pending: cards.flatMap((card) => (card.pending ? [{ cardId: card.id, what: card.pending }] : [])),
    running: input.running,
    viewport: input.viewport,
    hasApiKey: input.hasApiKey,
  };
}
