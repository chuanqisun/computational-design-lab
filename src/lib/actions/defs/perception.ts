import { defer, filter, interval, map, of, race, startWith, take, timer } from "rxjs";
import { buildMediaParts, type MediaEncoders } from "../../agent/observe";
import { ActionError, type ActionDef } from "../types";

export function createPerceptionActions(encoders: MediaEncoders) {
  const observe: ActionDef<Record<string, never>> = {
    name: "observe",
    description:
      "Look at the board. Every tool result already includes the current observation; call this when you only need a fresh look.",
    parameters: { type: "object", properties: {} },
    isAvailable: () => true,
    run: () => of({ summary: "Observed the board" }),
    log: "skip",
    humanEntry: "view:screen",
    agent: "perception",
  };

  const viewCards: ActionDef<{ cardIds: string[]; maxPx?: number }> = {
    name: "view_cards",
    description:
      "See cards in full: complete text plus the actual image or video (videos as inline clip or keyframes). Use before judging anything visual. Up to 6 cards per call.",
    parameters: {
      type: "object",
      properties: {
        cardIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        maxPx: { type: "integer", minimum: 128, maximum: 1024 },
      },
      required: ["cardIds"],
    },
    isAvailable: ({ state }) => (state.cards.length ? true : { reason: "The board is empty" }),
    run: (args, ctx) =>
      defer(async () => {
        const cards = ctx.cards(args.cardIds);
        const text = cards
          .map((card) =>
            [
              `### ${card.id}`,
              `Title: ${card.title || "(untitled)"}`,
              `Body: ${card.body || "(none)"}`,
              card.imagePrompt ? `Image prompt: ${card.imagePrompt}` : "",
              card.metadata?.kind ? `Tag: ${card.metadata.kind}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n");
        const { parts, omitted } = await buildMediaParts({
          items: ctx.items$.value,
          cardIds: args.cardIds,
          encoders,
          budget: { maxBytes: 6_000_000, maxThumbs: 6, thumbPx: args.maxPx ?? 512 },
        });
        return {
          summary: `Viewed ${cards.length} card(s)`,
          data: { text: omitted ? `${text}\n\n(${omitted} media omitted for size)` : text },
          media: parts,
        };
      }),
    log: "skip",
    humanEntry: "dialog:open",
    agent: "perception",
  };

  const waitForIdle: ActionDef<{ timeoutS?: number }> = {
    name: "wait_for_idle",
    description: "Wait until no card is pending and no other action is running (e.g. after animate). Default timeout 60s.",
    parameters: { type: "object", properties: { timeoutS: { type: "integer", minimum: 1, maximum: 600 } } },
    isAvailable: () => true,
    run: (args, ctx) => {
      const isIdle = () => {
        const state = ctx.getState();
        return state.pending.length === 0 && state.running.filter((entry) => entry.name !== "wait_for_idle").length === 0;
      };
      const timeoutMs = (args.timeoutS ?? 60) * 1000;
      return race(
        interval(250).pipe(
          startWith(0),
          filter(isIdle),
          take(1),
          map(() => ({ summary: "Board is idle" })),
        ),
        timer(timeoutMs).pipe(
          map(() => {
            const pending = ctx.getState().pending;
            if (!pending.length) return { summary: "Board is idle" };
            throw new ActionError("timeout", `Still pending after ${args.timeoutS ?? 60}s: ${pending.map((p) => `${p.cardId}(${p.what})`).join(", ")}`);
          }),
        ),
      );
    },
    log: "skip",
    humanEntry: "view:progress",
    agent: "perception",
  };

  return [observe, viewCards, waitForIdle];
}
