import type { Interactions } from "@google/genai";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import type { CardView, UiState } from "../actions/types";
import type { ActionRecord } from "../workflows/action-log";

export type ObservationPart = Interactions.TextContent | Interactions.ImageContent | Interactions.VideoContent;

export interface MediaEncoders {
  /** Downscaled JPEG of an image src. */
  image(src: string, maxPx: number): Promise<Interactions.ImageContent | undefined>;
  /** First/middle/last keyframes of a video plus its duration. */
  videoFrames(src: string, maxPx: number): Promise<{ frames: Interactions.ImageContent[]; durationS?: number } | undefined>;
}

export interface ObservationBudget {
  maxBytes: number;
  maxThumbs: number;
  thumbPx?: number;
  maxInlineVideoBytes?: number;
}

export const DEFAULT_BUDGET: Required<ObservationBudget> = {
  maxBytes: 1_500_000,
  maxThumbs: 4,
  thumbPx: 384,
  maxInlineVideoBytes: 4_000_000,
};

export interface StateDiff {
  created: string[];
  updated: string[];
  deleted: string[];
}

const significant = (card: CardView) =>
  [card.kind, card.title, card.body, card.pending, card.x, card.y, card.width, card.height].join("\u0000");

export function diffStates(prev: UiState, curr: UiState): StateDiff {
  const prevById = new Map(prev.cards.map((card) => [card.id, card]));
  const currIds = new Set(curr.cards.map((card) => card.id));
  return {
    created: curr.cards.filter((card) => !prevById.has(card.id)).map((card) => card.id),
    updated: curr.cards
      .filter((card) => prevById.has(card.id) && significant(prevById.get(card.id)!) !== significant(card))
      .map((card) => card.id),
    deleted: prev.cards.filter((card) => !currIds.has(card.id)).map((card) => card.id),
  };
}

const oneLine = (text: string | undefined, max: number) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export function renderCardLine(card: CardView): string {
  return [
    card.id,
    card.kind,
    oneLine(card.title, 60) || "(untitled)",
    oneLine(card.body, 120) || "-",
    [card.isSelected ? "selected" : "", card.pending ? `pending:${card.pending}` : "", card.tag ? `tag:${card.tag}` : ""]
      .filter(Boolean)
      .join(" ") || "-",
    `${card.x},${card.y}`,
  ].join(" | ");
}

export function renderObservationText(input: {
  state: UiState;
  prev?: UiState;
  available: string[];
  unavailable: { name: string; reason: string }[];
  userActions?: ActionRecord[];
}): string {
  const { state } = input;
  const lines: string[] = [];
  const vp = state.viewport;
  lines.push(`## Board (${state.cards.length} cards; viewport ${Math.round(vp.x)},${Math.round(vp.y)} ${vp.width}x${vp.height})`);
  if (state.cards.length === 0) {
    lines.push("(board is empty)");
  } else {
    lines.push("id | kind | title | body | flags | x,y");
    lines.push(...state.cards.map(renderCardLine));
  }
  lines.push(`Selected: ${state.selectedIds.join(", ") || "(none)"}`);
  if (state.running.length) {
    lines.push(`Running: ${state.running.map((entry) => `${entry.name} (${entry.actor})`).join(", ")}`);
  }

  if (input.prev) {
    const diff = diffStates(input.prev, state);
    const changes = [
      diff.created.length ? `+created: ${diff.created.join(", ")}` : "",
      diff.updated.length ? `~updated: ${diff.updated.join(", ")}` : "",
      diff.deleted.length ? `-deleted: ${diff.deleted.join(", ")}` : "",
    ].filter(Boolean);
    lines.push(`Changes since last observation: ${changes.join("; ") || "none"}`);
  }

  if (input.userActions?.length) {
    lines.push("User actions since last observation:");
    lines.push(...input.userActions.map((record) => `- [user] ${record.action}: ${record.summary || record.status}`));
  }

  if (!state.hasApiKey) lines.push("Note: no Gemini API key; generative actions are unavailable.");
  lines.push(`Available actions: ${input.available.join(", ") || "(none)"}`);
  if (input.unavailable.length) {
    lines.push("Unavailable actions:");
    lines.push(...input.unavailable.map((entry) => `- ${entry.name} — ${entry.reason}`));
  }
  return lines.join("\n");
}

const base64Bytes = (data: string | undefined) => Math.ceil(((data ?? "").length * 3) / 4);

function parseDataUrl(src: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(src);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

/** Media parts for the given cards, honoring the thumbnail count and byte budgets. */
export async function buildMediaParts(input: {
  items: CanvasItem[];
  cardIds: string[];
  encoders: MediaEncoders;
  budget: ObservationBudget;
  usedBytes?: number;
}): Promise<{ parts: ObservationPart[]; omitted: number }> {
  const budget = { ...DEFAULT_BUDGET, ...input.budget };
  const parts: ObservationPart[] = [];
  let used = input.usedBytes ?? 0;
  let omitted = 0;
  let mediaCount = 0;

  for (const id of input.cardIds) {
    const card = input.items.find((item) => item.id === id);
    if (!card || (!card.imageSrc && !card.videoSrc)) continue;
    if (mediaCount >= budget.maxThumbs) {
      omitted += 1;
      continue;
    }

    const candidate: ObservationPart[] = [];
    if (card.videoSrc) {
      const inline = parseDataUrl(card.videoSrc);
      if (inline && base64Bytes(inline.data) <= budget.maxInlineVideoBytes) {
        candidate.push(
          { type: "text", text: `Video of card ${card.id}:` },
          { type: "video", mime_type: (card.videoMimeType || inline.mimeType) as Interactions.VideoContent["mime_type"], data: inline.data },
        );
      } else {
        const frames = await input.encoders.videoFrames(card.videoSrc, budget.thumbPx).catch(() => undefined);
        if (frames?.frames.length) {
          candidate.push(
            {
              type: "text",
              text: `Video of card ${card.id}${frames.durationS ? ` (${Math.round(frames.durationS)}s)` : ""}: first/middle/last keyframes`,
            },
            ...frames.frames,
          );
        }
      }
    } else if (card.imageSrc) {
      const thumb = await input.encoders.image(card.imageSrc, budget.thumbPx).catch(() => undefined);
      if (thumb) candidate.push({ type: "text", text: `Image of card ${card.id}:` }, thumb);
    }

    if (!candidate.length) continue;
    const bytes = candidate.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : base64Bytes(part.data)), 0);
    if (used + bytes > budget.maxBytes) {
      omitted += 1;
      continue;
    }
    used += bytes;
    mediaCount += 1;
    parts.push(...candidate);
  }

  return { parts, omitted };
}

/** Full observation: text block (always) + media of the cards created by the last action (budgeted). */
export async function buildObservation(input: {
  state: UiState;
  items: CanvasItem[];
  prev?: UiState;
  available: string[];
  unavailable: { name: string; reason: string }[];
  userActions?: ActionRecord[];
  mediaCardIds?: string[];
  encoders: MediaEncoders;
  budget?: ObservationBudget;
}): Promise<ObservationPart[]> {
  const text = renderObservationText(input);
  const budget = { ...DEFAULT_BUDGET, ...input.budget };
  const { parts, omitted } = await buildMediaParts({
    items: input.items,
    cardIds: input.mediaCardIds ?? [],
    encoders: input.encoders,
    budget,
    usedBytes: text.length,
  });
  const result: ObservationPart[] = [{ type: "text", text }, ...parts];
  if (omitted) result.push({ type: "text", text: `(${omitted} thumbnail(s) omitted; call view_cards to see them)` });
  return result;
}
