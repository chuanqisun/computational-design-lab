import { describe, expect, it } from "vitest";
import type { CanvasItem } from "../../canvas/canvas.component";
import {
  buildAnimateMacro,
  buildAnimateRequest,
  combineAnimateInstruction,
  extractAnimateVideo,
  getAnimatePreflightErrors,
  getAnimateImageTokens,
  prepareAnimateContents,
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

  it("reassigns the unique starting frame and builds contiguous reference macros", () => {
    const { inputs } = resolveAnimateInputs([
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
      item({ imageSrc: "three.png" }),
    ]);
    let roles = { Image1: "starting-frame", Image2: "reference", Image3: "reference" } as const;
    roles = setAnimateImageRole(roles, "Image3", "starting-frame") as typeof roles;

    expect(roles.Image1).toBe("auto");
    expect(buildAnimateMacro(inputs, roles)).toBe(
      "[# Sources <FIRST_FRAME>@Image3] [# References <IMAGE_REF_0>@Image2]",
    );
    expect(combineAnimateInstruction(buildAnimateMacro(inputs, roles), "  Orbit around the product. ")).toContain(
      "Orbit around the product.",
    );
  });

  it("keeps copyable role tags aligned with annotated starting-frame macros", () => {
    const { inputs } = resolveAnimateInputs([
      item({ imageSrc: "one.png" }),
      item({ imageSrc: "two.png" }),
      item({ imageSrc: "three.png" }),
    ]);
    const roles = { Image1: "auto", Image2: "starting-frame", Image3: "reference" } as const;
    const annotated = new Set(["Image2"]);

    expect(getAnimateImageTokens(inputs, roles, annotated)).toEqual({
      Image1: { primary: "<IMAGE_REF_1>" },
      Image2: { primary: "<FIRST_FRAME>", annotation: "<IMAGE_REF_2>" },
      Image3: { primary: "<IMAGE_REF_0>" },
    });
    expect(buildAnimateMacro(inputs, roles, annotated)).toBe(
      "[# Sources <FIRST_FRAME>@Image2] [# References <IMAGE_REF_0>@Image3 <IMAGE_REF_2>@Image4]",
    );
  });

  it("validates API key, empty input, multiple videos, and unsupported video MIME types", () => {
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
  });

  it("builds one explicit user input step and controls output option omission", () => {
    const base = {
      contents: [{ type: "text", text: "Card text" }] as const,
      instruction: "Animate this",
      duration: "default" as const,
      task: "default" as const,
    };
    const defaultRequest = buildAnimateRequest({ ...base, aspectRatio: "default" });
    const portraitRequest = buildAnimateRequest({ ...base, aspectRatio: "9:16" });
    const fourSecondRequest = buildAnimateRequest({ ...base, aspectRatio: "default", duration: "4s" });
    const eightSecondRequest = buildAnimateRequest({ ...base, aspectRatio: "default", duration: "8s" });

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
    expect(defaultRequest.generation_config).toBeUndefined();
    for (const task of ["text_to_video", "image_to_video", "reference_to_video", "edit"] as const) {
      expect(buildAnimateRequest({ ...base, aspectRatio: "default", task }).generation_config).toEqual({
        video_config: { task },
      });
    }
    expect(defaultRequest.store).toBe(false);
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

  it("extracts the first inline model-output video and rejects missing output", () => {
    expect(
      extractAnimateVideo([
        { type: "model_output", content: [{ type: "video", data: "AAA", mime_type: "video/webm" }] },
      ]),
    ).toEqual({ data: "AAA", mimeType: "video/webm" });
    expect(() => extractAnimateVideo([{ type: "model_output", content: [{ type: "text", text: "none" }] }])).toThrow(
      "Gemini returned no video.",
    );
  });
});
