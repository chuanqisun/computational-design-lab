import type { Interactions } from "@google/genai";
import type { BehaviorSubject, Observable } from "rxjs";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import type { Position } from "../../components/canvas/layout";

export type Actor = "user" | "ai";

export type PendingKind = "fill" | "image" | "video" | "search";

export interface CardView {
  id: string;
  kind: "text" | "image" | "video" | "mixed" | "empty";
  title?: string;
  body?: string;
  isSelected: boolean;
  pending?: PendingKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Extra semantic tag, e.g. "synthetic-user", "interview-summary". */
  tag?: string;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiState {
  cards: CardView[];
  selectedIds: string[];
  pending: { cardId: string; what: PendingKind }[];
  running: { actionId: string; name: string; actor: Actor }[];
  viewport: Viewport;
  hasApiKey: boolean;
}

export type MediaPart = Interactions.ImageContent | Interactions.VideoContent | Interactions.TextContent;

export interface ActionResult {
  /** One line; shown in the timeline and returned to the agent. */
  summary: string;
  created?: string[];
  updated?: string[];
  deleted?: string[];
  /** Async actions: cards still settling. */
  pending?: string[];
  data?: unknown;
  /** Image/video parts returned to the agent (never logged). */
  media?: MediaPart[];
  error?: string;
  reason?: string;
}

export type AgentSupport = "native" | "equivalent" | "perception" | { unsupported: string };

export type JSONSchema = {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

export type JSONSchemaObject = JSONSchema & { type: "object"; properties: Record<string, JSONSchema> };

/** Availability is evaluated against a set of target cards: the selection (tray) or explicit cardIds (dispatch). */
export interface AvailabilityInput {
  state: UiState;
  targets: CardView[];
}

export type Availability = true | { reason: string };

export interface ActionContext {
  actor: Actor;
  signal: AbortSignal;
  apiKey: string;
  items$: BehaviorSubject<CanvasItem[]>;
  getState(): UiState;
  /** Resolve the target cards for this call: args.cardIds, else the current selection. */
  targets: CanvasItem[];
  /** Resolve cards by id. Throws `card_not_found` for unknown ids. */
  cards(ids: string[]): CanvasItem[];
  /** Positions for new cards (human or agent): centered on the viewport, avoiding existing cards (see placeCentered). */
  place(count: number): Position[];
  /** Successive row positions computed from the board as it is now (for streamed results). */
  placer(): () => Position;
  /** Keep work running after the action returns (async actions). Cancelled by stop$. */
  background(task$: Observable<unknown>): void;
  newId(prefix: string): string;
  addCards(cards: CanvasItem[]): void;
  updateCard(id: string, patch: Partial<CanvasItem>): void;
  /** Fill missing text and render missing images for the given cards; completes once all settle. */
  settle$(ids: string[]): Observable<void>;
}

export interface ActionDef<A extends Record<string, unknown> = Record<string, any>> {
  /** snake_case; used as the Gemini function name. */
  name: string;
  /** Written for the model; also used as the UI tooltip. */
  description: string;
  /** Used as the Gemini function declaration. */
  parameters: JSONSchemaObject;
  /** Args only the human UI adapter may pass (devices: drawings, transcripts, files). Never declared to the agent. */
  humanArgs?: string[];
  isAvailable(input: AvailabilityInput): Availability;
  run(args: A, ctx: ActionContext): Observable<ActionResult>;
  /** Returns immediately with `pending`; remaining work keeps running. */
  async?: boolean;
  log: "record" | "coalesce" | "skip";
  /** Where a human triggers it, e.g. "tray:Blend". Must be a key of HUMAN_ENTRIES. */
  humanEntry: string;
  agent: AgentSupport;
  /** Whether the action requires a Gemini API key. */
  needsApiKey?: boolean;
}

export class ActionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
