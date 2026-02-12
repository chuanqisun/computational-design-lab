import { html, render } from "lit-html";
import type { BehaviorSubject, Subject } from "rxjs";
import type { PendingPhoto, ScannedPhoto } from "../../lib/studio-types";
import "./scan-dialog.component.css";

export interface ScanDialogProps {
  scannedPhotos$: BehaviorSubject<ScannedPhoto[]>;
  scanTrigger$: Subject<ScannedPhoto>;
}

export function openScanDialog(props: ScanDialogProps) {
  const { scannedPhotos$, scanTrigger$ } = props;
  const dialog = document.getElementById("scan-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  let stream: MediaStream | null = null;
  let pendingPhotos: PendingPhoto[] = [];

  const cleanup = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const handleFileUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fullDataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = 32;
          thumbCanvas.height = 32;
          const ctx = thumbCanvas.getContext("2d")!;
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 32, 32);
          const thumbnailUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);

          pendingPhotos = [
            ...pendingPhotos,
            {
              id: `upload-${crypto.randomUUID()}`,
              thumbnailUrl,
              fullDataUrl,
            },
          ];
          renderDialog();
        };
        img.src = fullDataUrl;
      };
      reader.readAsDataURL(file);
    });
    input.value = "";
  };

  const renderDialog = () => {
    const template = html`
      <h2>Scan Product</h2>
      <div class="scan-section">
        <h3>Upload files</h3>
        <button
          @click=${() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = handleFileUpload;
            input.click();
          }}
        >
          Choose files
        </button>
      </div>
      <div class="scan-section">
        <h3>Webcam</h3>
        <video id="scan-video" autoplay playsinline class="scan-video"></video>
        <button
          @click=${() => {
            const video = dialog.querySelector("#scan-video") as HTMLVideoElement;
            if (!video?.videoWidth) return;

            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d")!.drawImage(video, 0, 0);
            const fullDataUrl = canvas.toDataURL("image/jpeg", 0.8);

            const thumbCanvas = document.createElement("canvas");
            thumbCanvas.width = 32;
            thumbCanvas.height = 32;
            const ctx = thumbCanvas.getContext("2d")!;
            const size = Math.min(video.videoWidth, video.videoHeight);
            const sx = (video.videoWidth - size) / 2;
            const sy = (video.videoHeight - size) / 2;
            ctx.drawImage(video, sx, sy, size, size, 0, 0, 32, 32);
            const thumbnailUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);

            pendingPhotos = [
              ...pendingPhotos,
              {
                id: `scan-${crypto.randomUUID()}`,
                thumbnailUrl,
                fullDataUrl,
              },
            ];
            renderDialog();
          }}
        >
          Capture
        </button>
      </div>
      ${pendingPhotos.length > 0
        ? html`<div class="scan-previews">
            ${pendingPhotos.map(
              (p) => html`
                <div class="scan-preview">
                  <img src=${p.thumbnailUrl} alt="" />
                  <button
                    class="scan-preview-delete"
                    @click=${() => {
                      pendingPhotos = pendingPhotos.filter((pp) => pp.id !== p.id);
                      renderDialog();
                    }}
                  >
                    ×
                  </button>
                </div>
              `,
            )}
          </div>`
        : null}
      <menu>
        <button
          ?disabled=${pendingPhotos.length === 0}
          @click=${() => {
            for (const p of pendingPhotos) {
              const photo: ScannedPhoto = {
                id: p.id,
                thumbnailUrl: p.thumbnailUrl,
                fullDataUrl: p.fullDataUrl,
                label: "scanning...",
                isScanning: true,
              };
              scannedPhotos$.next([...scannedPhotos$.value, photo]);
              scanTrigger$.next(photo);
            }
            cleanup();
            dialog.close();
          }}
        >
          Submit
        </button>
        <button
          @click=${() => {
            cleanup();
            dialog.close();
          }}
        >
          Close
        </button>
      </menu>
    `;
    render(template, dialogContent);
  };

  dialog.addEventListener("close", cleanup, { once: true });
  renderDialog();
  dialog.showModal();

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = dialog.querySelector("#scan-video") as HTMLVideoElement;
      if (video) {
        video.srcObject = stream;
      }
    } catch {
      alert("Could not access webcam.");
      dialog.close();
    }
  })();
}
