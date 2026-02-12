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

  const renderDialog = () => {
    const template = html`
      <div class="dialog-header">
        <h2>Scan Product</h2>
        <button @click=${() => { cleanup(); dialog.close(); }}>Close</button>
      </div>
      <video id="scan-video" autoplay playsinline class="scan-video"></video>
      ${pendingPhotos.length > 0
        ? html`<div class="scan-previews">
            ${pendingPhotos.map(
              (p) => html`
                <div class="scan-preview">
                  <img src=${p.thumbnailUrl} alt="" />
                  <button class="scan-preview-delete" @click=${() => {
                    pendingPhotos = pendingPhotos.filter((pp) => pp.id !== p.id);
                    renderDialog();
                  }}>×</button>
                </div>
              `,
            )}
          </div>`
        : null}
      <menu>
        <button @click=${() => {
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

          pendingPhotos = [...pendingPhotos, {
            id: `scan-${crypto.randomUUID()}`,
            thumbnailUrl,
            fullDataUrl,
          }];
          renderDialog();
        }}>Capture</button>
        <button ?disabled=${pendingPhotos.length === 0} @click=${() => {
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
        }}>Submit</button>
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
