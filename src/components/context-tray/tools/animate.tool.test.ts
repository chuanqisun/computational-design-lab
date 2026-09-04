import { nothing, type TemplateResult } from "lit-html";
import { BehaviorSubject, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import * as animateLlm from "../llm/animate";
import { taskRunner$ } from "../tasks";
import { AnimateTool, AnimateToolView } from "./animate.tool";

const item = (overrides: Partial<CanvasItem>): CanvasItem => ({
  id: crypto.randomUUID(),
  x: 100,
  y: 100,
  width: 200,
  height: 300,
  isSelected: true,
  ...overrides,
});

describe("AnimateTool component", () => {
  beforeEach(() => {
    if (typeof globalThis.requestAnimationFrame === "undefined") {
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        return setTimeout(() => cb(Date.now()), 0) as unknown as number;
      };
    }
  });
  it("computes button disabled and title properties accurately", () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    // Case 1: No key, no items
    expect(latest?.values[0]).toBe(true);
    expect(latest?.values[1]).toBe("Gemini API key required");
    expect(latest?.values[3]).toBe(nothing);

    // Case 2: Has key, no items
    apiKeys$.next({ gemini: "test-key", openai: "" });
    expect(latest?.values[0]).toBe(true);
    expect(latest?.values[1]).toBe("Select a card with video, image, or text content");

    // Case 3: Has key, has selected image
    const card = item({ imageSrc: "data:image/png;base64,AAA" });
    selected$.next([card]);
    items$.next([card]);

    expect(latest?.values[0]).toBe(false);
    expect(latest?.values[1]).toBe("Animate selected cards");
    expect(typeof latest?.values[2]).toBe("function"); // openDialog click handler

    sub.unsubscribe();
  });

  it("opens dialog with default reference roles for additional selected images on the board", () => {
    const img1 = item({ id: "card-1", imageSrc: "data:image/png;base64,ONE" });
    const img2 = item({ id: "card-2", imageSrc: "data:image/png;base64,TWO" });
    const img3 = item({ id: "card-3", imageSrc: "data:image/png;base64,THREE" });
    const items$ = new BehaviorSubject<CanvasItem[]>([img1, img2, img3]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([img1, img2, img3]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    // Click animate button (invoke openDialog)
    const openDialog = latest?.values[2] as () => void;
    openDialog();

    // Dialog should now be open
    const dialogTmpl = latest?.values[3] as TemplateResult;
    expect(dialogTmpl).not.toBe(nothing);
    expect(dialogTmpl).toBeDefined();

    const values = dialogTmpl.values;
    const macroValue = values.find((v) => typeof v === "string" && v.includes("[# References"));
    expect(macroValue).toBe("[# References <IMAGE_REF_0>@Image2 <IMAGE_REF_1>@Image3]");

    sub.unsubscribe();
  });

  it("sets all images to reference when video is selected with images", () => {
    const video = item({ id: "vid-1", videoSrc: "data:video/mp4;base64,VID" });
    const img1 = item({ id: "img-1", imageSrc: "data:image/png;base64,ONE" });
    const items$ = new BehaviorSubject<CanvasItem[]>([video, img1]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([video, img1]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    const openDialog = latest?.values[2] as () => void;
    openDialog();

    const dialogTmpl = latest?.values[3] as TemplateResult;
    expect(dialogTmpl).not.toBe(nothing);

    const values = dialogTmpl.values;
    const macroValue = values.find((v) => typeof v === "string" && v.includes("[# References"));
    expect(macroValue).toBe("[# References <IMAGE_REF_0>@Image1]");

    sub.unsubscribe();
  });

  it("allows updating image roles and recomputes the macro dynamically", () => {
    const img1 = item({ id: "card-1", imageSrc: "data:image/png;base64,ONE" });
    const img2 = item({ id: "card-2", imageSrc: "data:image/png;base64,TWO" });
    const items$ = new BehaviorSubject<CanvasItem[]>([img1, img2]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([img1, img2]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    const openDialog = latest?.values[2] as () => void;
    openDialog();

    let dialogTmpl = latest?.values[3] as TemplateResult;
    expect(dialogTmpl).not.toBe(nothing);

    // Find the input sections in dialog template (values[3])
    const inputsList = dialogTmpl.values[3] as TemplateResult[];
    expect(inputsList.length).toBe(2);

    // img1 input template contains role change handlers in the role choices array
    const img1Tmpl = inputsList[0];
    const roleTemplates = img1Tmpl.values.find(
      (v) => Array.isArray(v) && v.length === 3 && (v[0] as TemplateResult)?.strings?.[0]?.includes("animate-role-"),
    ) as TemplateResult[];
    expect(roleTemplates).toBeDefined();

    // roleTemplates[1] is the starting-frame option, values[2] is its @change callback
    const setStartingFrame = roleTemplates[1].values[2] as () => void;
    setStartingFrame();

    dialogTmpl = latest?.values[3] as TemplateResult;
    let macroValue = dialogTmpl.values.find((v) => typeof v === "string" && v.includes("[# Sources"));
    expect(macroValue).toBe("[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2]");

    // Now set Image2 as starting-frame: Image1 returns to auto, Image2 becomes starting-frame
    const img2Tmpl = (dialogTmpl.values[3] as TemplateResult[])[1];
    const role2Templates = img2Tmpl.values.find(
      (v) => Array.isArray(v) && v.length === 3 && (v[0] as TemplateResult)?.strings?.[0]?.includes("animate-role-"),
    ) as TemplateResult[];
    const setImg2StartingFrame = role2Templates[1].values[2] as () => void;
    setImg2StartingFrame();

    dialogTmpl = latest?.values[3] as TemplateResult;
    macroValue = dialogTmpl.values.find((v) => typeof v === "string" && v.includes("[# Sources"));
    expect(macroValue).toBe("[# Sources <FIRST_FRAME>@Image2]");

    sub.unsubscribe();
  });

  it("updates aspect ratio, duration, and task type options", () => {
    const img = item({ id: "card-1", imageSrc: "data:image/png;base64,ONE" });
    const items$ = new BehaviorSubject<CanvasItem[]>([img]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([img]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    (latest?.values[2] as () => void)();

    let dialogTmpl = latest?.values[3] as TemplateResult;
    expect(dialogTmpl).not.toBe(nothing);

    // values[8]: aspect ratio templates array ["default", "16:9", "9:16"]
    const aspectTmpls = dialogTmpl.values[8] as TemplateResult[];
    expect(aspectTmpls.length).toBe(3);
    const setPortrait = aspectTmpls[2].values[1] as () => void;
    setPortrait();

    // values[9]: duration templates array ["default", "4s", "8s"]
    dialogTmpl = latest?.values[3] as TemplateResult;
    const durationTmpls = dialogTmpl.values[9] as TemplateResult[];
    expect(durationTmpls.length).toBe(3);
    const setFourSec = durationTmpls[1].values[1] as () => void;
    setFourSec();

    // values[10]: task templates array ["default", "text_to_video", "image_to_video", "reference_to_video", "edit", "extend"]
    dialogTmpl = latest?.values[3] as TemplateResult;
    const taskTmpls = dialogTmpl.values[10] as TemplateResult[];
    expect(taskTmpls.length).toBe(6);
    const setExtend = taskTmpls[5].values[1] as () => void;
    setExtend();

    dialogTmpl = latest?.values[3] as TemplateResult;
    expect(dialogTmpl).toBeDefined();

    sub.unsubscribe();
  });

  it("displays warnings for omitted empty cards and preflight errors for multiple videos", () => {
    const vid1 = item({ id: "v1", videoSrc: "data:video/mp4;base64,VID1" });
    const vid2 = item({ id: "v2", videoSrc: "data:video/mp4;base64,VID2" });
    const emptyCard = item({ id: "empty", isSelected: true });
    const items$ = new BehaviorSubject<CanvasItem[]>([vid1, vid2, emptyCard]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([vid1, vid2, emptyCard]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    (latest?.values[2] as () => void)();

    const dialogTmpl = latest?.values[3] as TemplateResult;
    // values[4] is the omitted cards warning template
    const omittedWarning = dialogTmpl.values[4] as TemplateResult;
    expect(omittedWarning).not.toBe(nothing);

    // values[11] is preflight error template list
    const preflightErrors = dialogTmpl.values[11] as TemplateResult[];
    expect(preflightErrors.length).toBeGreaterThan(0);

    // Generate button is disabled (values[13])
    expect(dialogTmpl.values[13]).toBe(true);

    sub.unsubscribe();
  });

  it("handles dialog close and resets dialog state", () => {
    const img = item({ id: "card-1", imageSrc: "data:image/png;base64,ONE" });
    const items$ = new BehaviorSubject<CanvasItem[]>([img]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([img]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    (latest?.values[2] as () => void)();
    expect(latest?.values[3]).not.toBe(nothing);

    const dialogTmpl = latest?.values[3] as TemplateResult;
    // @close handler on dialog is values[1]
    const handleClose = dialogTmpl.values[1] as () => void;
    handleClose();

    // After close, dialogState$ is null so dialog template is `nothing`
    expect(latest?.values[3]).toBe(nothing);

    sub.unsubscribe();
  });

  it("submits generation task and appends video result to items$", async () => {
    const img = item({ id: "card-1", imageSrc: "data:image/png;base64,ONE" });
    const items$ = new BehaviorSubject<CanvasItem[]>([img]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([img]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "test-key", openai: "" });

    vi.spyOn(animateLlm, "prepareAnimateContents").mockResolvedValue([
      { type: "image", mime_type: "image/png", data: "ONE" },
    ]);
    vi.spyOn(animateLlm, "generateAnimatedVideo").mockReturnValue(
      of({ data: "GENERATED_VIDEO_BASE64", mimeType: "video/mp4" }),
    );

    const runnerSub = taskRunner$.subscribe();
    const template$ = AnimateToolView({ selected$, items$, apiKeys$ });

    let latest: TemplateResult | undefined;
    const sub = template$.subscribe((t) => {
      latest = t;
    });

    (latest?.values[2] as () => void)();

    const dialogTmpl = latest?.values[3] as TemplateResult;
    // Generate button click handler is at values[14]
    const handleGenerate = dialogTmpl.values[14] as () => void;
    handleGenerate();

    // Allow async prepareAnimateContents and task pipeline to run
    await new Promise((resolve) => setTimeout(resolve, 20));

    const currentItems = items$.value;
    expect(currentItems.length).toBe(2);
    expect(currentItems[1].id).toMatch(/^animate-result-/);
    expect(currentItems[1].videoSrc).toBe("data:video/mp4;base64,GENERATED_VIDEO_BASE64");
    expect(currentItems[1].videoMimeType).toBe("video/mp4");

    sub.unsubscribe();
    runnerSub.unsubscribe();
  });

  it("creates component wrapper via AnimateTool", () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([]);
    const selected$ = new BehaviorSubject<CanvasItem[]>([]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "key", openai: "" });

    const result = AnimateTool({ selected$, items$, apiKeys$ });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
