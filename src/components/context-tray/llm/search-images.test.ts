import { firstValueFrom, toArray } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { progress$ } from "../../progress/progress";
import { searchImages, streamSearchResults$ } from "./search-images";

const createInteractionMock = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = {
      create: createInteractionMock,
    };
  },
}));

describe("streamSearchResults$", () => {
  afterEach(() => {
    createInteractionMock.mockReset();
    progress$.next({ imageGen: 0, textGen: 0, videoGen: 0 });
  });

  it("streams structured JSON search results incrementally with Gemini 4 Hydrogen and google_search", async () => {
    const payload = JSON.stringify({
      results: [
        { title: "Eames Lounge Chair", details: "Molded plywood shells with black leather cushions." },
        { title: "Wassily Chair", details: "Tubular bent steel frame with taut leather straps." },
      ],
    });
    const chunks = [payload.slice(0, 40), payload.slice(40, 110), payload.slice(110)];

    createInteractionMock.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        for (const text of chunks) {
          yield { event_type: "step.delta", delta: { type: "text", text } };
        }
      },
    });

    const results = await firstValueFrom(
      streamSearchResults$({
        apiKey: "test-key",
        prompt: "iconic modern chairs",
        contextText: "warm wood tones",
        images: ["data:image/png;base64,REF1"],
      }).pipe(toArray()),
    );

    expect(createInteractionMock).toHaveBeenCalledTimes(1);
    const [params, requestOptions] = createInteractionMock.mock.calls[0];
    expect(params.model).toBe("gemini-4-hydrogen");
    expect(params.tools).toEqual([{ type: "google_search" }]);
    expect(params.stream).toBe(true);
    expect(params.store).toBe(false);
    expect(params.generation_config).toEqual({ thinking_level: "low" });
    expect(params.response_format).toEqual({
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                details: { type: "string" },
              },
              required: ["title", "details"],
            },
          },
        },
        required: ["results"],
      },
    });
    expect(requestOptions).toEqual({ signal: expect.any(AbortSignal) });
    expect(results).toEqual([
      { title: "Eames Lounge Chair", details: "Molded plywood shells with black leather cushions." },
      { title: "Wassily Chair", details: "Tubular bent steel frame with taut leather straps." },
    ]);
    expect(progress$.value.textGen).toBe(0);
  });
});

describe("searchImages", () => {
  afterEach(() => {
    createInteractionMock.mockReset();
    progress$.next({ imageGen: 0, textGen: 0, videoGen: 0 });
  });

  it("calls ai.interactions.create with Nano Banana 2.1, google_search grounding, 1K size, and minimal thinking", async () => {
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
          content: [{ type: "image", mime_type: "image/jpeg", data: "BASE64_IMG" }],
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
        image_size: "1K",
      },
      generation_config: { thinking_level: "minimal" },
      store: false,
    });
    expect(requestOptions).toEqual({ signal: expect.any(AbortSignal) });
    expect(result).toEqual({
      url: "data:image/jpeg;base64,BASE64_IMG",
      searchSuggestions: ['<div class="suggestions">chip</div>'],
    });
    expect(progress$.value.imageGen).toBe(0);
  });

  it("falls back to output_image when steps do not contain an image block", async () => {
    createInteractionMock.mockResolvedValue({
      id: "interaction-2",
      steps: [],
      output_image: { type: "image", mime_type: "image/png", data: "FALLBACK_IMG" },
    });

    const result = await firstValueFrom(searchImages("test-key", "ceramic vase"));

    expect(result).toEqual({
      url: "data:image/png;base64,FALLBACK_IMG",
      searchSuggestions: [],
    });
    expect(progress$.value.imageGen).toBe(0);
  });

  it("falls back to web_search only when image_search triggers an upstream 400 error", async () => {
    const badRequest = Object.assign(new Error("Request contains an invalid argument."), { status: 400 });
    createInteractionMock.mockRejectedValueOnce(badRequest).mockResolvedValueOnce({
      id: "interaction-fallback",
      steps: [
        {
          type: "model_output",
          content: [{ type: "image", mime_type: "image/jpeg", data: "RECOVERED_IMG" }],
        },
      ],
    });

    const result = await firstValueFrom(searchImages("test-key", "Starface Hydro-Stars Pimple Patches"));

    expect(createInteractionMock).toHaveBeenCalledTimes(2);
    expect(createInteractionMock.mock.calls[0][0].tools).toEqual([
      { type: "google_search", search_types: ["web_search", "image_search"] },
    ]);
    expect(createInteractionMock.mock.calls[1][0].tools).toEqual([
      { type: "google_search", search_types: ["web_search"] },
    ]);
    expect(result).toEqual({
      url: "data:image/jpeg;base64,RECOVERED_IMG",
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
