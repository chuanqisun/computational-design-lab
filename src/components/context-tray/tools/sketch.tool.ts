import { html } from "lit-html";
import { BehaviorSubject, combineLatest, map, switchMap, tap, type Observable } from "rxjs";
import { createComponent } from "../../../sdk/create-component";
import { type CanvasItem } from "../../canvas/canvas.component";
import { getNextPositions } from "../../canvas/layout";
import { type ApiKeys } from "../../connections/storage";
import { imageToimage } from "../../semantic-scan/image-to-image";
import { generateRefinedCardText } from "../../canvas/ai-helpers";
import { submitTask } from "../tasks";
import "./sketch.tool.css";

const getSketchStrokeColor = () => {
  return getComputedStyle(document.documentElement).getPropertyValue("--color-sketch-stroke").trim() || "#ff0000";
};
const SKETCH_LINE_WIDTH = 4;

export const SketchTool = createComponent(
  ({
    selected$,
    items$,
    apiKeys$,
  }: {
    selected$: Observable<CanvasItem[]>;
    items$: BehaviorSubject<CanvasItem[]>;
    apiKeys$: BehaviorSubject<ApiKeys>;
  }) => {
    const isDrawing$ = new BehaviorSubject(false);
    let strokeColor = "#ff0000";
    let imageAspect = 1.5; // height / width, defaults to standard card aspect ratio (300/200)
    let dialogEl: HTMLDialogElement | null = null;

    const getDialog = () => {
      if (!dialogEl) {
        dialogEl = document.getElementById("sketch-tool-dialog") as HTMLDialogElement | null;
      }
      return dialogEl;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const canvas = e.currentTarget as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      isDrawing$.next(true);

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      ctx.beginPath();
      ctx.moveTo(x, y);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = SKETCH_LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing$.value) return;

      const canvas = e.currentTarget as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleMouseUpOrLeave = (e: MouseEvent) => {
      if (!isDrawing$.value) return;
      isDrawing$.next(false);
      const canvas = e.currentTarget as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.closePath();
      }
    };

    const openSketchDialog = (imageSrc: string) => {
      const dialog = getDialog();
      if (!dialog) return;

      strokeColor = getComputedStyle(document.documentElement).getPropertyValue("--color-sketch-stroke").trim() || "#ff0000";

      dialog.showModal();

      const textarea = dialog.querySelector(".sketch-feedback-textarea") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = "";
      }

      requestAnimationFrame(() => {
        const canvas = dialog.querySelector("#sketch-canvas") as HTMLCanvasElement | null;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          imageAspect = img.height / img.width;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = imageSrc;
      });
    };

    const handleClear = (imageSrc: string) => {
      const dialog = getDialog();
      if (!dialog) return;

      const canvas = dialog.querySelector("#sketch-canvas") as HTMLCanvasElement | null;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = imageSrc;
    };

    const handleCancel = () => {
      const dialog = getDialog();
      if (dialog) {
        dialog.close();
      }
    };

    const handleSubmit = (imageSrc: string) => {
      const dialog = getDialog();
      if (!dialog) return;

      const canvas = dialog.querySelector("#sketch-canvas") as HTMLCanvasElement | null;
      if (!canvas) return;

      const textarea = dialog.querySelector(".sketch-feedback-textarea") as HTMLTextAreaElement | null;
      const feedbackText = textarea?.value || "";

      const illustratedImage = canvas.toDataURL("image/png");

      dialog.close();

      const selected = items$.value.filter((item) => item.isSelected);
      const apiKeys = apiKeys$.value;

      if (!apiKeys.gemini) {
        alert("Gemini API key is required to use the sketch feedback.");
        return;
      }

      const selectedItem = items$.value.find((item) => item.isSelected && item.imageSrc);
      const oldTitle = selectedItem?.title || "";
      const oldBody = selectedItem?.body || "";
      const oldImageSrc = selectedItem?.imageSrc || "";

      const positionGenerator = getNextPositions(selected);
      const cardWidth = 200;
      const cardHeight = Math.round(cardWidth * imageAspect);

      const task$ = imageToimage({
        instruction: feedbackText.trim() || "Apply the changes indicated by the sketch annotations on this image",
        image: illustratedImage,
        apiKey: apiKeys.gemini,
      }).pipe(
        switchMap((resultImageSrc) => {
          if (!resultImageSrc) {
            throw new Error("Failed to generate refined image from sketch. Please verify your API keys and the input image format.");
          }
          return generateRefinedCardText({
            oldImageSrc,
            newImageSrc: resultImageSrc,
            oldTitle,
            oldBody,
            apiKey: apiKeys.gemini,
          }).pipe(
            map((textResult) => ({
              imageSrc: resultImageSrc,
              title: textResult.title,
              body: textResult.body,
            }))
          );
        }),
        tap(({ imageSrc, title, body }) => {
          const nextPos = positionGenerator.next();
          const { x, y, z } = nextPos && nextPos.value ? nextPos.value : { x: 100, y: 100, z: 1 };
          const card: CanvasItem = {
            id: `sketch-result-${crypto.randomUUID()}`,
            imageSrc,
            title,
            body,
            x,
            y,
            width: cardWidth,
            height: cardHeight,
            isSelected: false,
            zIndex: z,
          };
          items$.next([...items$.value, card]);
        }),
      );

      submitTask(task$);
    };

    const selectedImageSrc$ = selected$.pipe(
      map((selected) => {
        const itemWithImage = selected.find((item) => !!item.imageSrc);
        return itemWithImage?.imageSrc || "";
      }),
    );

    const template$ = combineLatest([selectedImageSrc$, apiKeys$]).pipe(
      map(([imageSrc, apiKeys]) => {
        const hasImage = !!imageSrc;

        return html`
          <div class="sketch-tool">
            <button
              ?disabled=${!hasImage}
              @click=${() => {
                if (imageSrc) openSketchDialog(imageSrc);
              }}
              title=${!hasImage ? "Please select a card with an image to use the Sketch tool." : "Sketch over the selected image"}
            >
              Sketch
            </button>

            <dialog id="sketch-tool-dialog" class="sketch-dialog">
              <div class="sketch-dialog-body">
                <h3>Sketch Illustration & Feedback</h3>

                <div class="sketch-canvas-container">
                  <canvas
                    id="sketch-canvas"
                    class="sketch-canvas"
                    @mousedown=${handleMouseDown}
                    @mousemove=${handleMouseMove}
                    @mouseup=${handleMouseUpOrLeave}
                    @mouseleave=${handleMouseUpOrLeave}
                  ></canvas>
                </div>

                <div class="sketch-feedback-area">
                  <label for="sketch-feedback">Additional Feedback</label>
                  <textarea
                    id="sketch-feedback"
                    class="sketch-feedback-textarea"
                    rows="2"
                    placeholder="Describe your requested changes here..."
                  ></textarea>
                </div>

                <div class="sketch-dialog-footer">
                  <button @click=${() => handleClear(imageSrc)}>Clear</button>
                  <button @click=${handleCancel}>Cancel</button>
                  <button
                    ?disabled=${!apiKeys.gemini}
                    @click=${() => handleSubmit(imageSrc)}
                    title=${!apiKeys.gemini ? "Gemini API key required" : ""}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </dialog>
          </div>
        `;
      }),
    );

    return template$;
  },
);
