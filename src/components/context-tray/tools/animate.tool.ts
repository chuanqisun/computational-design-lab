import { html, nothing } from "lit-html";
import { BehaviorSubject, combineLatest, map, tap, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import type { ApiKeys } from "../../connections/storage";
import {
  buildAnimateMacro,
  combineAnimateInstruction,
  generateAnimatedVideo,
  getAnimatePreflightErrors,
  prepareAnimateContents,
  resolveAnimateInputs,
  setAnimateImageRole,
  type AnimateAspectRatio,
  type AnimateDuration,
  type AnimateImageRole,
  type AnimateInput,
  type AnimateTask,
} from "../llm/animate";
import { submitTask } from "../tasks";
import "./animate.tool.css";

interface AnimateDialogState {
  snapshot: CanvasItem[];
  inputs: AnimateInput[];
  omitted: CanvasItem[];
  roles: Record<string, AnimateImageRole>;
  instruction: string;
  aspectRatio: AnimateAspectRatio;
  duration: AnimateDuration;
  task: AnimateTask;
  preparing: boolean;
  preparationError: string;
  copiedImageId: string;
}

const DIALOG_ID = "animate-tool-dialog";
const STROKE_WIDTH = 4;

export const AnimateTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const dialogState$ = new BehaviorSubject<AnimateDialogState | null>(null);
    let activePointerId: number | null = null;

    const getDialog = () => document.getElementById(DIALOG_ID) as HTMLDialogElement | null;

    const closeDialog = () => {
      const dialog = getDialog();
      if (dialog?.open) dialog.close();
      else dialogState$.next(null);
    };

    const handleDialogClose = () => {
      activePointerId = null;
      dialogState$.next(null);
      requestAnimationFrame(() => document.getElementById("animate-tool-button")?.focus());
    };

    const openDialog = () => {
      const snapshot = items$.value.filter((item) => item.isSelected);
      const { inputs, omitted } = resolveAnimateInputs(snapshot);
      const roles = Object.fromEntries(
        inputs.filter((input) => input.kind === "image").map((input) => [input.imageId, "auto" as const]),
      );
      dialogState$.next({
        snapshot,
        inputs,
        omitted,
        roles,
        instruction: "",
        aspectRatio: "default",
        duration: "default",
        task: "default",
        preparing: false,
        preparationError: "",
        copiedImageId: "",
      });
      requestAnimationFrame(() => getDialog()?.showModal());
    };

    const updateState = (update: Partial<AnimateDialogState>) => {
      const state = dialogState$.value;
      if (state) dialogState$.next({ ...state, ...update });
    };

    const updateRole = (imageId: string, role: AnimateImageRole) => {
      const state = dialogState$.value;
      if (!state) return;
      updateState({ roles: setAnimateImageRole(state.roles, imageId, role) });
    };

    const initializeCanvas = (event: Event) => {
      const image = event.currentTarget as HTMLImageElement;
      const canvas = image.parentElement?.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    };

    const getPoint = (event: PointerEvent, canvas: HTMLCanvasElement) => {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
        y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
      };
    };

    const startStroke = (event: PointerEvent) => {
      const canvas = event.currentTarget as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) return;
      activePointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      const point = getPoint(event, canvas);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--color-sketch-stroke").trim() || "#d73a49";
      context.lineWidth = STROKE_WIDTH;
      context.lineCap = "round";
      context.lineJoin = "round";
      canvas.dataset.annotated = "true";
    };

    const continueStroke = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      const canvas = event.currentTarget as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return;
      const point = getPoint(event, canvas);
      context.lineTo(point.x, point.y);
      context.stroke();
    };

    const endStroke = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      const canvas = event.currentTarget as HTMLCanvasElement;
      canvas.getContext("2d")?.closePath();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      activePointerId = null;
    };

    const clearAnnotations = (imageId: string) => {
      const canvas = getDialog()?.querySelector(`canvas[data-image-id="${imageId}"]`);
      if (!(canvas instanceof HTMLCanvasElement)) return;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      delete canvas.dataset.annotated;
    };

    const copyImageId = async (imageId: string) => {
      try {
        await navigator.clipboard.writeText(imageId);
        updateState({ copiedImageId: imageId });
      } catch {
        updateState({ preparationError: `${imageId} could not be copied.` });
      }
    };

    const handleGenerate = async () => {
      const state = dialogState$.value;
      const apiKey = apiKeys$.value.gemini;
      if (!state || !apiKey || getAnimatePreflightErrors(state.inputs, true).length) return;
      updateState({ preparing: true, preparationError: "" });

      const annotatedImages = new Map<string, HTMLCanvasElement>();
      getDialog()
        ?.querySelectorAll<HTMLCanvasElement>("canvas[data-annotated='true']")
        .forEach((canvas) => annotatedImages.set(canvas.dataset.imageId || "", canvas));

      try {
        const contents = await prepareAnimateContents(state.inputs, annotatedImages);
        if (dialogState$.value !== state && !dialogState$.value?.preparing) return;

        const macro = buildAnimateMacro(state.inputs, state.roles);
        const instruction = combineAnimateInstruction(macro, state.instruction) || "Animate the selected content.";
        const position = getNextPositions(state.snapshot).next().value || { x: 100, y: 100, z: 1 };
        const cardId = `animate-result-${crypto.randomUUID()}`;
        const task$ = generateAnimatedVideo({
          contents,
          instruction,
          aspectRatio: state.aspectRatio,
          duration: state.duration,
          task: state.task,
          apiKey,
        }).pipe(
          tap((video) => {
            const card: CanvasItem = {
              id: cardId,
              videoSrc: `data:${video.mimeType};base64,${video.data}`,
              videoMimeType: video.mimeType,
              title: "Animated video",
              body: state.instruction.trim(),
              x: position.x,
              y: position.y,
              width: 200,
              height: 300,
              isSelected: false,
              zIndex: position.z,
            };
            items$.next([...items$.value, card]);
          }),
        );

        closeDialog();
        submitTask(task$);
      } catch (error) {
        updateState({
          preparing: false,
          preparationError: error instanceof Error ? error.message : "Animate could not prepare the selected media.",
        });
      }
    };

    return combineLatest([selected$, apiKeys$, dialogState$]).pipe(
      map(([selected, apiKeys, state]) => {
        const selectedInputs = resolveAnimateInputs(selected).inputs;
        const macro = state ? buildAnimateMacro(state.inputs, state.roles) : "";
        const preflightErrors = state ? getAnimatePreflightErrors(state.inputs, !!apiKeys.gemini) : [];

        return html`
          <div class="animate-tool">
            <button
              id="animate-tool-button"
              ?disabled=${!selectedInputs.length || !apiKeys.gemini}
              title=${!apiKeys.gemini
                ? "Gemini API key required"
                : !selectedInputs.length
                  ? "Select a card with video, image, or text content"
                  : "Animate selected cards"}
              @click=${openDialog}
            >
              Animate
            </button>

            ${state
              ? html`<dialog
                  id=${DIALOG_ID}
                  aria-labelledby="animate-dialog-title"
                  @close=${handleDialogClose}
                  @cancel=${(event: Event) => {
                    event.preventDefault();
                    closeDialog();
                  }}
                >
                  <div class="animate-dialog-body">
                    <header><h3 id="animate-dialog-title">Animate selection</h3></header>

                    <div class="animate-inputs">
                      ${state.inputs.map((input) => {
                        if (input.kind === "image") {
                          return html`<section class="animate-input">
                            <header class="animate-input-header">
                              <strong>${input.imageId}</strong>
                              <button class="small" @click=${() => void copyImageId(input.imageId)}>Copy</button>
                              <span class="animate-copy-status" aria-live="polite">
                                ${state.copiedImageId === input.imageId ? "Copied" : nothing}
                              </span>
                            </header>
                            <fieldset class="animate-segments">
                              <legend>Role for ${input.imageId}</legend>
                              ${(["auto", "starting-frame", "reference"] as const).map(
                                (role) =>
                                  html`<label>
                                    <input
                                      type="radio"
                                      name="animate-role-${input.imageId}"
                                      .checked=${state.roles[input.imageId] === role}
                                      @change=${() => updateRole(input.imageId, role)}
                                    />
                                    ${role === "starting-frame"
                                      ? "Starting frame"
                                      : `${role[0].toUpperCase()}${role.slice(1)}`}
                                  </label>`,
                              )}
                            </fieldset>
                            <div class="animate-image-stage">
                              <img
                                src=${input.src}
                                alt=${`${input.imageId}: ${input.title || "selected image"}`}
                                @load=${initializeCanvas}
                              />
                              <canvas
                                data-image-id=${input.imageId}
                                aria-label=${`Draw temporary annotations on ${input.imageId}`}
                                @pointerdown=${startStroke}
                                @pointermove=${continueStroke}
                                @pointerup=${endStroke}
                                @pointercancel=${endStroke}
                              ></canvas>
                            </div>
                            <button class="small animate-clear" @click=${() => clearAnnotations(input.imageId)}>
                              Clear annotations
                            </button>
                          </section>`;
                        }
                        if (input.kind === "video") {
                          return html`<section class="animate-input">
                            <strong>${input.title || "Selected video"}</strong>
                            <video src=${input.src} controls playsinline preload="metadata"></video>
                          </section>`;
                        }
                        return html`<section class="animate-input">
                          <strong>${input.title || "Selected text"}</strong>
                          <pre>${input.text}</pre>
                        </section>`;
                      })}
                    </div>

                    ${state.omitted.length
                      ? html`<p class="animate-warning">
                          ${state.omitted.length} selected ${state.omitted.length === 1 ? "card has" : "cards have"} no
                          usable content and will be omitted.
                        </p>`
                      : nothing}

                    <label class="animate-instruction">
                      Instruction
                      <span class="animate-macro" aria-label="Generated image-role instruction">${macro}</span>
                      <textarea
                        rows="3"
                        placeholder="Describe the motion, camera, pacing, and audio..."
                        .value=${state.instruction}
                        @input=${(event: Event) =>
                          updateState({ instruction: (event.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </label>

                    <fieldset class="animate-segments">
                      <legend>Aspect ratio</legend>
                      ${(["default", "16:9", "9:16"] as const).map(
                        (aspectRatio) =>
                          html`<label>
                            <input
                              type="radio"
                              name="animate-aspect-ratio"
                              .checked=${state.aspectRatio === aspectRatio}
                              @change=${() => updateState({ aspectRatio })}
                            />
                            ${aspectRatio === "default" ? "Default" : aspectRatio}
                          </label>`,
                      )}
                    </fieldset>

                    <fieldset class="animate-segments">
                      <legend>Duration</legend>
                      ${(["default", "4s", "8s"] as const).map(
                        (duration) =>
                          html`<label>
                            <input
                              type="radio"
                              name="animate-duration"
                              .checked=${state.duration === duration}
                              @change=${() => updateState({ duration })}
                            />
                            ${duration === "default" ? "Default" : duration === "4s" ? "4 sec" : "8 sec"}
                          </label>`,
                      )}
                    </fieldset>

                    <fieldset class="animate-segments">
                      <legend>Task type</legend>
                      ${(["default", "text_to_video", "image_to_video", "reference_to_video", "edit"] as const).map(
                        (task) =>
                          html`<label>
                            <input
                              type="radio"
                              name="animate-task"
                              .checked=${state.task === task}
                              @change=${() => updateState({ task })}
                            />
                            ${task === "default" ? "Default" : task}
                          </label>`,
                      )}
                    </fieldset>

                    <div class="animate-errors" aria-live="polite">
                      ${[...preflightErrors, state.preparationError]
                        .filter(Boolean)
                        .map((error) => html`<p>${error}</p>`)}
                    </div>

                    <footer>
                      <button @click=${closeDialog}>Cancel</button>
                      <button
                        ?disabled=${state.preparing || preflightErrors.length > 0}
                        @click=${() => void handleGenerate()}
                      >
                        ${state.preparing ? "Preparing..." : "Generate"}
                      </button>
                    </footer>
                  </div>
                </dialog>`
              : nothing}
          </div>
        `;
      }),
    );
  },
);
