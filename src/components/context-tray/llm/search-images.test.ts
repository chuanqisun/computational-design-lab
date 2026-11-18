import { firstValueFrom } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { progress$ } from "../../progress/progress";
import { searchImages } from "./search-images";

const createInteractionMock = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = {
      create: createInteractionMock,
    };
  },
}));

describe("searchImages", () => {
  afterEach(() => {
    createInteractionMock.mockReset();
    progress$.next({ imageGen: 0, textGen: 0, videoGen: 0 });
  });

  it("calls ai.interactions.create with Nano Banana 2.1, google_search grounding, and medium thinking", async () => {
    createInteractionMock.mockResolvedValue({
      id: "interaction-1",
      steps: [
        {
          type: "google_search_result",
          call_id: "call-1",
          result: [{ search_suggestions: "<div class=\"suggestions\">chip</div>" }],
        },
        {
          type: "model_output",
          content: [{ type: "image", mime_type: "image/jpeg", data: "BASE64_GRID" }],
        },
      ],
    });

    const result = await firstValueFrom(searchImages("test-key", "minimalist chair", ["data:image/png;base64,REF1"]));

    expect(createInteractionMock).toHaveBeenCalledTimes(1);
    const [params, requestOptions] = createInteractionMock.mock.calls[0];
    expect(params).toEqual({
      model: "gemini-nano-banana-2.1",
      input: [
        {
          type: "user_input",
          content: [
            { type: "image", mime_type: "image/png", data: "REF1" },
            { type: "text", text: "minimalist chair" },
          ],
        },
      ],
      tools: [{ type: "google_search", search_types: ["web_search", "image_search"] }],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: "1:1",
        image_size: "2K",
      },
      generation_config: { thinking_level: "medium" },
      store: false,
    });
    expect(requestOptions).toEqual({ signal: expect.any(AbortSignal) });
    expect(result).toEqual({
      url: "data:image/jpeg;base64,BASE64_GRID",
      searchSuggestions: ['<div class="suggestions">chip</div>'],
    });
    expect(progress$.value.imageGen).toBe(0);
  });

  it("falls back to output_image when steps do not contain an image block", async () => {
    createInteractionMock.mockResolvedValue({
      id: "interaction-2",
      steps: [],
      output_image: { type: "image", mime_type: "image/png", data: "FALLBACK_GRID" },
    });

    const result = await firstValueFrom(searchImages("test-key", "ceramic vase"));

    expect(result).toEqual({
      url: "data:image/png;base64,FALLBACK_GRID",
      searchSuggestions: [],
    });
    expect(progress$.value.imageGen).toBe(0);
  });

  it("aborts in-flight requests and resets progress$.imageGen on unsubscribe", () => {
    let capturedSignal: AbortSignal | undefined;
    createInteractionMock.mockImplementation((_params: unknown, options: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal;
      return new Promise(() => {});
    });

    const subscription = searchImages("test-key", "lamp").subscribe();
    expect(progress$.value.imageGen).toBe(1);
    expect(capturedSignal?.aborted).toBe(false);

    subscription.unsubscribe();
    expect(capturedSignal?.aborted).toBe(true);
    expect(progress$.value.imageGen).toBe(0);
  });
});
