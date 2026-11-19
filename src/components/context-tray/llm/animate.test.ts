import { describe, expect, it } from "vitest";
import type { CanvasItem } from "../../canvas/canvas.component";
import {
  buildAnimateMacro,
  buildAnimateRequest,
  combineAnimateInstruction,
  extractAnimateVideo,
  getAnimateImageTokens,
  getAnimatePreflightErrors,
  prepareAnimateContents,
  resolveAnimateDefaultRoles,
  resolveAnimateInputs,
  setAnimateImageRole,
} from "./animate";

const item = (overrides: Partial<CanvasItem>): CanvasItem => ({
  id: crypto.randomUUID(),
  x: 0,
  y: 0,
  width: 200,
  height: 300,
  ...overrides,
});

describe("animate request model", () => {
  it("resolves one input per card using video, image, then text precedence", () => {
    const resolved = resolveAnimateInputs([
      item({ id: "video", videoSrc: "data:video/mp4;base64,AAA", imageSrc: "image", body: "ignored" }),
      item({ id: "image", imageSrc: "data:image/png;base64,BBB", body: "ignored" }),
      item({ id: "text", title: "Chair", body: "A compact chair", imagePrompt: "Red upholstery" }),
      item({ id: "empty" }),
    ]);

    expect(resolved.inputs).toEqual([
      expect.objectContaining({ kind: "video", cardId: "video" }),
      expect.objectContaining({ kind: "image", cardId: "image", imageId: "Image1" }),
      expect.objectContaining({
        kind: "text",
        cardId: "text",
        text: "Title: Chair\nBody: A compact chair\nImage prompt: Red upholstery",
      }),
    ]);
    expect(resolved.omitted.map(({ id }) => id)).toEqual(["empty"]);
  });

  it("keeps image IDs stable in resolved order", () => {
    const { inputs } = resolveAnimateInputs([
      item({ id: "one", imageSrc: "one.png" }),
      item({ id: "text", body: "between" }),
      item({ id: "two", imageSrc: "two.png" }),
    ]);
    expect(inputs.filter((input) => input.kind === "image").map((input) => input.imageId)).toEqual([
      "Image1",
      "Image2",
    ]);
  });

  it("reassigns the unique starting frame and builds natural-language role instructions", () => {
    const { inputs } = resolveAnimateInputs([
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
      item({ imageSrc: "three.png" }),
    ]);
    let roles = { Image1: "starting-frame", Image2: "reference", Image3: "reference" } as const;
    roles = setAnimateImageRole(roles, "Image3", "starting-frame") as typeof roles;

    expect(roles.Image1).toBe("auto");
    expect(buildAnimateMacro(inputs, roles)).toBe(
      "Use Image3 as the starting frame. Use Image2 as a visual reference, not as a starting frame.",
    );
    expect(combineAnimateInstruction(buildAnimateMacro(inputs, roles), "  Orbit around the product. ")).toContain(
      "Orbit around the product.",
    );
  });

  it("keeps copyable positional image tokens aligned with annotated starting-frame prompts", () => {
    const { inputs } = resolveAnimateInputs([
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
      item({ imageSrc: "three.png" }),
    ]);
    const roles = { Image1: "auto", Image2: "starting-frame", Image3: "reference" } as const;
    const annotated = new Set(["Image2"]);

    expect(getAnimateImageTokens(inputs, roles, annotated)).toEqual({
      Image1: { primary: "Image1" },
      Image2: { primary: "Image2", annotation: "Image4" },
      Image3: { primary: "Image3" },
    });
    expect(buildAnimateMacro(inputs, roles, annotated)).toBe(
      "Use Image2 as the starting frame. Use Image3 as a visual reference, not as a starting frame. Use Image4 as the annotated sketch guide for Image2, not as a literal frame.",
    );
  });

  it("validates API key, empty input, image limit, extend duration limit, multiple videos, and unsupported video MIME types", () => {
    expect(getAnimatePreflightErrors([], false)).toEqual([
      "A Gemini API key is required.",
      "Select at least one card with video, image, or text content.",
    ]);

    const { inputs } = resolveAnimateInputs([
      item({ title: "One", videoSrc: "one", videoMimeType: "video/mp4" }),
      item({ title: "Two", videoSrc: "two", videoMimeType: "application/octet-stream" }),
    ]);
    expect(getAnimatePreflightErrors(inputs, true)).toEqual([
      "Animate supports one video input at a time.",
      "Card “Two” has an unsupported video type.",
    ]);

    const inlineVideo = resolveAnimateInputs([
      item({ title: "Inline", videoSrc: "data:video/mp4;base64,AAA", videoMimeType: "application/octet-stream" }),
    ]).inputs;
    expect(getAnimatePreflightErrors(inlineVideo, true)).toEqual([]);
    expect(getAnimatePreflightErrors(inlineVideo, true, { task: "extend", duration: "15s" })).toEqual([
      "Video extension supports durations up to 10 seconds.",
    ]);
    expect(getAnimatePreflightErrors(inlineVideo, true, { task: "extend", duration: "8s" })).toEqual([]);

    const sixImages = resolveAnimateInputs(
      Array.from({ length: 6 }, (_, index) => item({ imageSrc: `img-${index + 1}.png` })),
    ).inputs;
    expect(getAnimatePreflightErrors(sixImages, true)).toEqual([]);
    expect(
      getAnimatePreflightErrors(sixImages, true, {
        roles: { Image1: "starting-frame" },
        annotatedImageIds: new Set(["Image1"]),
      }),
    ).toEqual(["Animate supports up to 6 image inputs."]);
  });

  it("builds one explicit user input step and controls output option omission", () => {
    const base = {
      contents: [{ type: "text" as const, text: "Card text" }],
      instruction: "Animate this",
      duration: "default" as const,
      task: "default" as const,
    };
    const defaultRequest = buildAnimateRequest({ ...base, aspectRatio: "default" });
    const portraitRequest = buildAnimateRequest({ ...base, aspectRatio: "9:16" });
    const fourSecondRequest = buildAnimateRequest({ ...base, aspectRatio: "default", duration: "4s" });
    const eightSecondRequest = buildAnimateRequest({ ...base, aspectRatio: "default", duration: "8s" });
    const fifteenSecondRequest = buildAnimateRequest({ ...base, aspectRatio: "default", duration: "15s" });

    expect(defaultRequest.input).toEqual([
      {
        type: "user_input",
        content: [
          { type: "text", text: "Card text" },
          { type: "text", text: "Animate this" },
        ],
      },
    ]);
    expect(defaultRequest.response_format).toEqual({ type: "video", delivery: "inline" });
    expect(portraitRequest.response_format).toEqual({ type: "video", delivery: "inline", aspect_ratio: "9:16" });
    expect(fourSecondRequest.response_format).toEqual({ type: "video", delivery: "inline", duration: "4s" });
    expect(eightSecondRequest.response_format).toEqual({ type: "video", delivery: "inline", duration: "8s" });
    expect(fifteenSecondRequest.response_format).toEqual({ type: "video", delivery: "inline", duration: "15s" });
    expect(defaultRequest.generation_config).toBeUndefined();
    for (const task of ["text_to_video", "image_to_video", "reference_to_video", "edit", "extend"] as const) {
      expect(buildAnimateRequest({ ...base, aspectRatio: "default", task }).generation_config).toEqual({
        video_config: { task },
      });
    }
    expect(defaultRequest.api_version).toBe("v1beta");
    expect(defaultRequest.model).toBe("gemini-omni-1.2-flash");
    expect(defaultRequest.store).toBe(false);
  });

  it("assigns reference roles to additional selected images and all images when video is present", () => {
    const singleImage = resolveAnimateInputs([item({ imageSrc: "one.png" })]).inputs;
    expect(resolveAnimateDefaultRoles(singleImage)).toEqual({ Image1: "auto" });

    const multiImages = resolveAnimateInputs([
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
      item({ imageSrc: "three.png" }),
    ]).inputs;
    expect(resolveAnimateDefaultRoles(multiImages)).toEqual({
      Image1: "auto",
      Image2: "reference",
      Image3: "reference",
    });

    const videoWithImages = resolveAnimateInputs([
      item({ videoSrc: "data:video/mp4;base64,AAA" }),
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
    ]).inputs;
    expect(resolveAnimateDefaultRoles(videoWithImages)).toEqual({
      Image1: "reference",
      Image2: "reference",
    });

    const textWithImages = resolveAnimateInputs([
      item({ title: "Prompt card" }),
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
    ]).inputs;
    expect(resolveAnimateDefaultRoles(textWithImages)).toEqual({
      Image1: "auto",
      Image2: "reference",
    });

    const emptyRoles = resolveAnimateInputs([item({ title: "Only text" })]).inputs;
    expect(resolveAnimateDefaultRoles(emptyRoles)).toEqual({});
  });

  it("prepares every inline card in order without re-encoding unannotated media", async () => {
    const inputs = resolveAnimateInputs([
      item({ imageSrc: "data:image/jpeg;base64,IMAGE" }),
      item({ body: "Direction" }),
      item({ videoSrc: "data:video/mp4;base64,VIDEO" }),
    ]).inputs;

    await expect(prepareAnimateContents(inputs, new Map(), {})).resolves.toEqual([
      { type: "image", mime_type: "image/jpeg", data: "IMAGE" },
      { type: "text", text: "Body: Direction" },
      { type: "video", mime_type: "video/mp4", data: "VIDEO" },
    ]);
  });

  it("prepares inline video data URLs with codec parameters", async () => {
    const webmVp9 = resolveAnimateInputs([
      item({
        title: "Mint Tumbler Showcase",
        videoSrc: "data:video/webm;codecs=vp9;base64,VIDEO_VP9",
        videoMimeType: "video/webm;codecs=vp9",
      }),
    ]).inputs;

    expect(getAnimatePreflightErrors(webmVp9, true)).toEqual([]);
    await expect(prepareAnimateContents(webmVp9, new Map(), {})).resolves.toEqual([
      { type: "video", mime_type: "video/webm", data: "VIDEO_VP9" },
    ]);

    const webmVp9Opus = resolveAnimateInputs([
      item({
        videoSrc: "data:video/webm;codecs=vp9,opus;base64,VIDEO_AV",
      }),
    ]).inputs;

    expect(getAnimatePreflightErrors(webmVp9Opus, true)).toEqual([]);
    await expect(prepareAnimateContents(webmVp9Opus, new Map(), {})).resolves.toEqual([
      { type: "video", mime_type: "video/webm", data: "VIDEO_AV" },
    ]);
  });

  it("extracts the first inline model-output video, supports output_video fallback, and rejects missing output", () => {
    expect(
      extractAnimateVideo([
        { type: "model_output", content: [{ type: "video", data: "AAA", mime_type: "video/webm" }] },
      ]),
    ).toEqual({ data: "AAA", mimeType: "video/webm" });
    expect(
      extractAnimateVideo([], {
        type: "video",
        data: "BBB",
        mime_type: "video/mp4",
      }),
    ).toEqual({ data: "BBB", mimeType: "video/mp4" });
    expect(() => extractAnimateVideo([{ type: "model_output", content: [{ type: "text", text: "none" }] }])).toThrow(
      "Gemini returned no video.",
    );
  });
});
