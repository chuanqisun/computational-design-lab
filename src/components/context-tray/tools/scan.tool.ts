import { html } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, mergeWith, tap } from "rxjs";
import type { PendingPhoto } from "../../../lib/studio-types";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import "./scan.tool.css";

const createThumbnail = (fullDataUrl: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 32;
      thumbCanvas.height = 32;
      const ctx = thumbCanvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to create thumbnail context"));
        return;
      }

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 32, 32);
      resolve(thumbCanvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = fullDataUrl;
  });

export const ScanTool = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  const pendingPhotos$ = new BehaviorSubject<PendingPhoto[]>([]);
  const stream$ = new BehaviorSubject<MediaStream | null>(null);

  const closeDialog = () => {
    const dialog = document.getElementById("scan-tool-dialog") as HTMLDialogElement | null;
    if (dialog?.open) {
      dialog.close();
    }
  };

  const stopCamera = () => {
    const stream = stream$.value;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream$.next(null);
    }
  };

  const openFilePicker = () => {
    const input = document.getElementById("scan-tool-file-input") as HTMLInputElement | null;
    input?.click();
  };

  const openDialog = () => {
    const dialog = document.getElementById("scan-tool-dialog") as HTMLDialogElement | null;
    if (!dialog) return;
    if (!dialog.open) {
      pendingPhotos$.next([]);
      dialog.showModal();
    }
  };

  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const nextPending: PendingPhoto[] = [];

    for (const file of Array.from(files)) {
      const fullDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const thumbnailUrl = await createThumbnail(fullDataUrl);
      nextPending.push({
        id: `upload-${crypto.randomUUID()}`,
        fullDataUrl,
        thumbnailUrl,
      });
    }

    pendingPhotos$.next([...pendingPhotos$.value, ...nextPending]);
    input.value = "";
  };

  const startCamera = async () => {
    if (stream$.value) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream$.next(stream);

      requestAnimationFrame(() => {
        const video = document.getElementById("scan-tool-video") as HTMLVideoElement | null;
        if (video) {
          video.srcObject = stream;
        }
      });
    } catch {
      alert("Could not access webcam.");
    }
  };

  const captureFromCamera = async () => {
    const video = document.getElementById("scan-tool-video") as HTMLVideoElement | null;
    if (!video?.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const fullDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const thumbnailUrl = await createThumbnail(fullDataUrl);

    pendingPhotos$.next([
      ...pendingPhotos$.value,
      {
        id: `scan-${crypto.randomUUID()}`,
        fullDataUrl,
        thumbnailUrl,
      },
    ]);
  };

  const removePending = (id: string) => {
    pendingPhotos$.next(pendingPhotos$.value.filter((photo) => photo.id !== id));
  };

  const commitPhotos = () => {
    const pending = pendingPhotos$.value;
    if (pending.length === 0) return;

    const canvasElement = document.querySelector("[data-canvas]") as HTMLElement | null;
    const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
    const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);

    const additions: CanvasItem[] = pending.map((photo, index) => ({
      id: `scan-photo-${Date.now()}-${index}`,
      type: "image",
      src: photo.fullDataUrl,
      x: center.x - 100 + index * 24,
      y: center.y - 100 + index * 24,
      width: 200,
      height: 200,
      isSelected: false,
      zIndex: maxZ + index + 1,
      metadata: {
        source: "scan-tool",
        thumbnailUrl: photo.thumbnailUrl,
      },
    }));

    items$.next([...items$.value, ...additions]);
    pendingPhotos$.next([]);
    stopCamera();
    closeDialog();
  };

  const stopCameraEffect$ = stream$.pipe(
    tap((stream) => {
      if (stream) return;
      const video = document.getElementById("scan-tool-video") as HTMLVideoElement | null;
      if (video) {
        video.srcObject = null;
      }
    }),
    ignoreElements(),
  );

  const template$ = combineLatest([pendingPhotos$, stream$]).pipe(
    map(([pendingPhotos, stream]) => {
      return html`
        <div class="scan-tool">
          <button @click=${openDialog}>Capture</button>

          <dialog id="scan-tool-dialog" @close=${stopCamera}>
            <div class="scan-tool-dialog-body">
              <header class="scan-tool-header">
                <h3>Capture</h3>
              </header>

              <input
                id="scan-tool-file-input"
                type="file"
                accept="image/*"
                multiple
                @change=${handleFileUpload}
                hidden
              />

              <section class="scan-tool-content">
                <menu class="scan-tool-menu">
                  <button @click=${openFilePicker}>Upload</button>
                  ${stream
                    ? html`<button @click=${captureFromCamera}>Capture</button>
                        <button @click=${stopCamera}>Stop camera</button>`
                    : html`<button @click=${startCamera}>Start camera</button>`}
                </menu>

                ${stream
                  ? html`<video id="scan-tool-video" autoplay playsinline class="scan-tool-video"></video>`
                  : html``}
                ${pendingPhotos.length > 0
                  ? html`
                      <div class="scan-tool-previews">
                        ${pendingPhotos.map(
                          (photo) => html`
                            <div class="scan-tool-preview">
                              <img src=${photo.thumbnailUrl} alt="Pending scan" />
                              <button @click=${() => removePending(photo.id)}>Remove</button>
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html``}
              </section>

              <footer class="scan-tool-footer">
                <menu class="scan-tool-menu">
                  <button ?disabled=${pendingPhotos.length === 0} @click=${commitPhotos}>Confirm</button>
                  <button @click=${closeDialog}>Close</button>
                </menu>
              </footer>
            </div>
          </dialog>
        </div>
      `;
    }),
  );

  return template$.pipe(mergeWith(stopCameraEffect$));
});
