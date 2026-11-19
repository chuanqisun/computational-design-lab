import { describe, expect, it } from "vitest";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { buildUiState } from "../actions/ui-state";
import type { ActionRecord } from "../workflows/action-log";
import { buildObservation, diffStates, renderObservationText, type MediaEncoders } from "./observe";

const item = (id: string, extra: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  x: 10,
  y: 20,
  width: 200,
  height: 300,
  title: `Title ${id}`,
  body: `Body of ${id}`,
  ...extra,
});

const state = (items: CanvasItem[]) =>
  buildUiState({ items, running: [], viewport: { x: 0, y: 0, width: 1000, height: 800 }, hasApiKey: true });

const encoders: MediaEncoders = {
  image: async (src) => ({ type: "image", mime_type: "image/jpeg", data: `thumb:${src}` }),
  videoFrames: async () => ({
    frames: [
      { type: "image", mime_type: "image/jpeg", data: "f1" },
      { type: "image", mime_type: "image/jpeg", data: "f2" },
      { type: "image", mime_type: "image/jpeg", data: "f3" },
    ],
    durationS: 8,
  }),
};

describe("diffStates", () => {
  it("reports created, updated and deleted cards", () => {
    const prev = state([item("a"), item("b"), item("c")]);
    const curr = state([item("a"), item("b", { title: "Changed" }), item("d")]);
    expect(diffStates(prev, curr)).toEqual({ created: ["d"], updated: ["b"], deleted: ["c"] });
  });

  it("ignores pure selection changes but reports moves as updates", () => {
    const prev = state([item("a"), item("b")]);
    const curr = state([item("a", { isSelected: true }), item("b", { x: 500 })]);
    expect(diffStates(prev, curr)).toEqual({ created: [], updated: ["b"], deleted: [] });
  });
});

describe("renderObservationText", () => {
  it("renders one line per card with truncated body, selection and pending", () => {
    const longBody = "word ".repeat(60);
    const text = renderObservationText({
      state: state([item("a", { body: longBody, isSelected: true }), item("b", { imagePrompt: "p", metadata: { pending: "image" } })]),
      available: ["render_image"],
      unavailable: [],
    });
    const lineA = text.split("\n").find((line) => line.startsWith("a |"))!;
    expect(lineA).toContain("| mixed |".replace("mixed", "text"));
    expect(lineA).toContain("selected");
    expect(lineA.length).toBeLessThan(220);
    expect(text).toMatch(/^b \| mixed .*pending:image/m);
    expect(text).toContain("Selected: a");
  });

  it("lists available actions and unavailable ones with reasons", () => {
    const text = renderObservationText({
      state: state([]),
      available: ["add_card", "render_image"],
      unavailable: [{ name: "blend_images", reason: "Select at least 2 cards" }],
    });
    expect(text).toContain("Available actions: add_card, render_image");
    expect(text).toContain("blend_images — Select at least 2 cards");
    expect(text).toContain("(board is empty)");
  });

  it("includes the diff and user actions since the last observation", () => {
    const userAction: ActionRecord = {
      id: "r1",
      timestamp: 1,
      actor: "user",
      action: "delete_cards",
      args: { cardIds: ["c"] },
      inputIds: ["c"],
      outputIds: [],
      outputThumbs: [],
      summary: "Deleted 1 card(s)",
      status: "done",
    };
    const text = renderObservationText({
      state: state([item("a"), item("d")]),
      prev: state([item("a"), item("c")]),
      available: [],
      unavailable: [],
      userActions: [userAction],
    });
    expect(text).toContain("+created: d");
    expect(text).toContain("-deleted: c");
    expect(text).toContain("[user] delete_cards: Deleted 1 card(s)");
  });

  it("lists running actions with their actor", () => {
    const s = { ...state([]), running: [{ actionId: "x", name: "animate", actor: "ai" as const }] };
    expect(renderObservationText({ state: s, available: [], unavailable: [] })).toContain("Running: animate (ai)");
  });
});

describe("buildObservation", () => {
  it("adds thumbnails of cards created by the last action, capped at maxThumbs", async () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => item(id, { imageSrc: `img-${id}` }));
    const parts = await buildObservation({
      state: state(items),
      items,
      available: [],
      unavailable: [],
      mediaCardIds: ["a", "b", "c", "d", "e"],
      encoders,
      budget: { maxBytes: 1_000_000, maxThumbs: 4 },
    });
    expect(parts[0].type).toBe("text");
    const images = parts.filter((p) => p.type === "image");
    expect(images).toHaveLength(4);
    expect(parts.some((p) => p.type === "text" && p.text.includes("call view_cards"))).toBe(true);
  });

  it("drops media before text when over the byte budget", async () => {
    const items = [item("a", { imageSrc: "x".repeat(10) })];
    const big: MediaEncoders = {
      ...encoders,
      image: async () => ({ type: "image", mime_type: "image/jpeg", data: "y".repeat(5000) }),
    };
    const parts = await buildObservation({
      state: state(items),
      items,
      available: [],
      unavailable: [],
      mediaCardIds: ["a"],
      encoders: big,
      budget: { maxBytes: 2000, maxThumbs: 4 },
    });
    expect(parts.filter((p) => p.type === "image")).toHaveLength(0);
    expect(parts[0].type).toBe("text");
    expect(parts.map((p) => (p.type === "text" ? p.text : "")).join("")).toContain("1 thumbnail(s) omitted");
  });

  it("sends small videos inline and falls back to keyframes for large ones", async () => {
    const small = item("v1", { videoSrc: `data:video/mp4;base64,${"A".repeat(100)}`, videoMimeType: "video/mp4" });
    const large = item("v2", { videoSrc: `data:video/mp4;base64,${"A".repeat(5000)}`, videoMimeType: "video/mp4" });
    const parts = await buildObservation({
      state: state([small, large]),
      items: [small, large],
      available: [],
      unavailable: [],
      mediaCardIds: ["v1", "v2"],
      encoders,
      budget: { maxBytes: 1_000_000, maxThumbs: 4, maxInlineVideoBytes: 1000 },
    });
    expect(parts.filter((p) => p.type === "video")).toHaveLength(1);
    expect(parts.filter((p) => p.type === "image").map((p) => (p as { data: string }).data)).toEqual(["f1", "f2", "f3"]);
    expect(parts.some((p) => p.type === "text" && p.text.includes("v2") && p.text.includes("8s"))).toBe(true);
  });
});
