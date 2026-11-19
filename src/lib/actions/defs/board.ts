import { map, of, switchMap } from "rxjs";
import type { CanvasItem } from "../../../components/canvas/canvas.component";
import { focusSelectedItems, gatherItemsIntoViewport, placeRows } from "../../../components/canvas/layout";
import { ActionError, type ActionDef } from "../types";

const cardIdsParam = {
  type: "array" as const,
  items: { type: "string" as const },
  description: "Target card ids. Defaults to the current selection.",
};

const needTargets = (min: number, what = "card") => ({ targets }: { targets: unknown[] }) =>
  targets.length >= min ? (true as const) : { reason: `Select at least ${min} ${what}${min > 1 ? "s" : ""}` };

export const selectCards: ActionDef<{ cardIds?: string[]; mode?: "replace" | "add" | "remove" | "all" | "none" }> = {
  name: "select_cards",
  description:
    "Change which cards are selected. mode: replace (default) selects exactly cardIds; add/remove adjust the selection; all/none ignore cardIds.",
  parameters: {
    type: "object",
    properties: {
      cardIds: cardIdsParam,
      mode: { type: "string", enum: ["replace", "add", "remove", "all", "none"] },
    },
  },
  isAvailable: () => true,
  run: (args, ctx) =>
    of(null).pipe(
      map(() => {
        const mode = args.mode ?? "replace";
        const ids = new Set(args.cardIds ?? []);
        const next = ctx.items$.value.map((item) => {
          const selected =
            mode === "all"
              ? true
              : mode === "none"
                ? false
                : mode === "add"
                  ? !!item.isSelected || ids.has(item.id)
                  : mode === "remove"
                    ? !!item.isSelected && !ids.has(item.id)
                    : ids.has(item.id);
          return selected === !!item.isSelected ? item : { ...item, isSelected: selected };
        });
        ctx.items$.next(next);
        const selectedIds = next.filter((item) => item.isSelected).map((item) => item.id);
        return { summary: `Selected ${selectedIds.length} card(s)`, data: { selectedIds } };
      }),
    ),
  log: "coalesce",
  humanEntry: "canvas:select",
  agent: "native",
};

export const moveCards: ActionDef<{
  moves?: { id: string; x: number; y: number }[];
  arrange?: "gather" | "focus" | "rows";
  cardIds?: string[];
}> = {
  name: "move_cards",
  description:
    "Move cards. Either give explicit `moves` (absolute x,y), or `arrange`: gather (pull off-screen cards into view), focus (bring target cards into view), rows (lay target cards out in tidy rows).",
  parameters: {
    type: "object",
    properties: {
      moves: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, x: { type: "number" }, y: { type: "number" } },
          required: ["id", "x", "y"],
        },
      },
      arrange: { type: "string", enum: ["gather", "focus", "rows"] },
      cardIds: cardIdsParam,
    },
  },
  isAvailable: ({ state }) => (state.cards.length > 0 ? true : { reason: "The board is empty" }),
  run: (args, ctx) =>
    of(null).pipe(
      map(() => {
        const items = ctx.items$.value;
        const viewport = ctx.getState().viewport;
        const vp = { width: viewport.width, height: viewport.height, scrollX: viewport.x, scrollY: viewport.y };
        let moves: { id: string; x: number; y: number }[];

        if (args.moves?.length) {
          ctx.cards(args.moves.map((move) => move.id));
          moves = args.moves;
        } else if (args.arrange === "gather") {
          moves = gatherItemsIntoViewport(items, vp);
        } else if (args.arrange === "focus") {
          const targetIds = new Set(ctx.targets.map((t) => t.id));
          moves = focusSelectedItems(
            items.map((item) => ({ ...item, isSelected: targetIds.has(item.id) })),
            vp,
          );
        } else if (args.arrange === "rows") {
          const targets = ctx.targets;
          if (!targets.length) throw new ActionError("unavailable", "No target cards to arrange");
          const originX = Math.min(...targets.map((t) => t.x));
          const originY = Math.min(...targets.map((t) => t.y));
          const anchor: CanvasItem = { id: "__anchor", x: originX, y: originY - 24, width: 0, height: 0 };
          moves = placeRows([anchor], targets.length).map((pos, index) => ({ id: targets[index].id, x: pos.x, y: pos.y }));
        } else {
          throw new ActionError("invalid_args", "Provide either moves or arrange");
        }

        if (moves.length) {
          ctx.items$.next(
            ctx.items$.value.map((item) => {
              const move = moves.find((m) => m.id === item.id);
              return move ? { ...item, x: move.x, y: move.y } : item;
            }),
          );
        }
        return { summary: `Moved ${moves.length} card(s)`, updated: moves.map((m) => m.id) };
      }),
    ),
  log: "coalesce",
  humanEntry: "canvas:drag",
  agent: "native",
};

export const deleteCards: ActionDef<{ cardIds?: string[] }> = {
  name: "delete_cards",
  description: "Delete cards from the board.",
  parameters: { type: "object", properties: { cardIds: cardIdsParam } },
  isAvailable: needTargets(1),
  run: (_args, ctx) =>
    of(null).pipe(
      map(() => {
        const ids = new Set(ctx.targets.map((t) => t.id));
        ctx.items$.next(ctx.items$.value.filter((item) => !ids.has(item.id)));
        return { summary: `Deleted ${ids.size} card(s)`, deleted: [...ids] };
      }),
    ),
  log: "record",
  humanEntry: "canvas:delete",
  agent: "native",
};

export const clearCanvas: ActionDef<{ confirm: boolean }> = {
  name: "clear_canvas",
  description: "Delete every card on the board. Requires confirm: true. Destructive.",
  parameters: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] },
  isAvailable: ({ state }) => (state.cards.length > 0 ? true : { reason: "The board is already empty" }),
  run: (args, ctx) =>
    of(null).pipe(
      map(() => {
        if (args.confirm !== true) throw new ActionError("invalid_args", "confirm must be true");
        const deleted = ctx.items$.value.map((item) => item.id);
        ctx.items$.next([]);
        return { summary: `Cleared ${deleted.length} card(s)`, deleted };
      }),
    ),
  log: "record",
  humanEntry: "tray:Canvas/Destroy",
  agent: "native",
};

export const duplicateCards: ActionDef<{ cardIds?: string[] }> = {
  name: "duplicate_cards",
  description: "Duplicate cards (equivalent of copy + paste). The copies become the selection.",
  parameters: { type: "object", properties: { cardIds: cardIdsParam } },
  isAvailable: needTargets(1),
  run: (_args, ctx) =>
    of(null).pipe(
      switchMap(() => {
        const sources = ctx.targets;
        const positions = ctx.place(sources.length);
        const copies: CanvasItem[] = sources.map((source, index) => ({
          ...source,
          id: ctx.newId("copy"),
          x: positions[index].x,
          y: positions[index].y,
          zIndex: positions[index].z,
          isSelected: true,
        }));
        ctx.items$.next([...ctx.items$.value.map((item) => ({ ...item, isSelected: false })), ...copies]);
        const ids = copies.map((c) => c.id);
        return ctx.settle$(ids).pipe(map(() => ({ summary: `Duplicated ${copies.length} card(s)`, created: ids })));
      }),
    ),
  log: "record",
  humanEntry: "canvas:copy-paste",
  agent: "equivalent",
};

export const editCard: ActionDef<{ cardId: string; title?: string; body?: string; imagePrompt?: string }> = {
  name: "edit_card",
  description:
    "Edit a card's title, body or image prompt. Missing text is auto-filled; a card with an image prompt but no image gets rendered.",
  parameters: {
    type: "object",
    properties: {
      cardId: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      imagePrompt: { type: "string" },
    },
    required: ["cardId"],
  },
  isAvailable: () => true,
  run: (args, ctx) => {
    const [card] = ctx.cards([args.cardId]);
    const patch: Partial<CanvasItem> = {};
    for (const field of ["title", "body", "imagePrompt"] as const) {
      if (args[field] !== undefined && args[field] !== card[field]) patch[field] = args[field];
    }
    if (Object.keys(patch).length === 0) return of({ summary: "No changes", updated: [] });
    ctx.updateCard(card.id, patch);
    return ctx.settle$([card.id]).pipe(
      map(() => ({ summary: `Edited ${Object.keys(patch).join(", ")} of ${card.title || card.id}`, updated: [card.id] })),
    );
  },
  log: "record",
  humanEntry: "dialog:edit",
  agent: "native",
};

export const addCard: ActionDef<{ text: string }> = {
  name: "add_card",
  description:
    "Add a text card. Short text (under 5 words, single line) becomes the title; longer text becomes the body. Missing title/body/image are auto-filled.",
  parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  isAvailable: () => true,
  run: (args, ctx) => {
    const text = args.text.trim();
    if (!text) throw new ActionError("invalid_args", "text must not be empty");
    const isTitle = text.split(/\s+/).length < 5 && !text.includes("\n");
    const [pos] = ctx.place(1, []);
    const id = ctx.newId("text");
    ctx.addCards([
      {
        id,
        title: isTitle ? text : undefined,
        body: isTitle ? undefined : text,
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 300,
        zIndex: pos.z,
        isSelected: false,
      },
    ]);
    return ctx.settle$([id]).pipe(map(() => ({ summary: `Added card "${text.slice(0, 40)}"`, created: [id] })));
  },
  log: "record",
  humanEntry: "tray:New/Write",
  agent: "native",
};

export interface IncomingMedia {
  kind: "image" | "video";
  src: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export const addMedia: ActionDef<{ _media?: IncomingMedia[]; _items?: CanvasItem[] }> = {
  name: "add_media",
  description: "Bring outside media (camera capture, uploaded files, pasted images or cards) onto the board.",
  parameters: { type: "object", properties: {} },
  humanArgs: ["_media", "_items"],
  isAvailable: () => true,
  run: (args, ctx) => {
    const media = args._media ?? [];
    const pasted = args._items ?? [];
    const total = media.length + pasted.length;
    if (!total) throw new ActionError("invalid_args", "Nothing to add");
    const positions = ctx.place(total, []);
    const fromMedia: CanvasItem[] = media.map((entry, index) => ({
      id: ctx.newId(entry.kind),
      ...(entry.kind === "image" ? { imageSrc: entry.src } : { videoSrc: entry.src, videoMimeType: entry.mimeType }),
      x: positions[index].x,
      y: positions[index].y,
      width: 200,
      height: 300,
      zIndex: positions[index].z,
      isSelected: false,
      metadata: entry.metadata,
    }));
    const fromItems: CanvasItem[] = pasted.map((item, index) => {
      const pos = positions[media.length + index];
      return { ...item, id: ctx.newId("paste"), x: pos.x, y: pos.y, zIndex: pos.z, isSelected: true };
    });
    const created = [...fromMedia, ...fromItems];
    ctx.items$.next([
      ...ctx.items$.value.map((item) => (fromItems.length ? { ...item, isSelected: false } : item)),
      ...created,
    ]);
    const ids = created.map((c) => c.id);
    return ctx.settle$(ids).pipe(map(() => ({ summary: `Added ${ids.length} media card(s)`, created: ids })));
  },
  log: "record",
  humanEntry: "tray:New/Capture",
  agent: { unsupported: "Input is the user's physical world or local files; use search_references or render_image for imagery." },
};

export const exportCards: ActionDef<{ cardIds?: string[] }> = {
  name: "export_cards",
  description: "Open the selected cards in Studio (new browser tab).",
  parameters: { type: "object", properties: { cardIds: cardIdsParam } },
  isAvailable: needTargets(1),
  run: (_args, ctx) =>
    of(ctx.targets).pipe(
      switchMap((targets) =>
        of({
          summary: `Exported ${targets.length} card(s) to Studio`,
          data: targets.map(({ isSelected: _isSelected, ...item }) => item),
        }),
      ),
    ),
  log: "record",
  humanEntry: "tray:Export",
  agent: { unsupported: "Output opens a new Studio browser tab for the user; the agent reads cards via observe/view_cards." },
};

export const boardActions = [
  selectCards,
  moveCards,
  deleteCards,
  clearCanvas,
  duplicateCards,
  editCard,
  addCard,
  addMedia,
  exportCards,
];
