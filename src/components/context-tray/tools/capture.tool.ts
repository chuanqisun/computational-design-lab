import { html } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, mergeWith, tap } from "rxjs";
import type { PendingPhoto } from "../../../lib/studio-types";
import { createComponent } from "../../../sdk/create-component";
import type { CanvasItem } from "../../canvas/canvas.component";
import { getViewportCenter } from "../../canvas/layout";
import "./capture.tool.css";

type CaptureMode = "image" | "video";

type CapturedMedia =
  | { kind: "image"; src: string; mimeType: string; thumbnailUrl?: string }
  | { kind: "video"; src: string; mimeType: string };

const VIDEO_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read media"));
    reader.readAsDataURL(blob);
  });

const getSupportedVideoMimeType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return VIDEO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || null;
};

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

export const CaptureTool = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  const pendingPhotos$ = new BehaviorSubject<PendingPhoto[]>([]);
  const pendingVideo$ = new BehaviorSubject<{ src: string; mimeType: string } | null>(null);
  const stream$ = new BehaviorSubject<MediaStream | null>(null);
  const captureMode$ = new BehaviorSubject<CaptureMode>("image");
  const isRecording$ = new BehaviorSubject(false);
  const cameras$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  const selectedCameraId$ = new BehaviorSubject("");

  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let keepRecordingResult = false;

  const commitMedia = (media: CapturedMedia[], source: "upload" | "capture-tool") => {
    if (media.length === 0) return;

    const canvasElement = document.querySelector("[data-canvas]") as HTMLElement | null;
    const center = canvasElement ? getViewportCenter(canvasElement) : { x: 400, y: 300 };
    const maxZ = items$.value.reduce((max, item) => Math.max(max, item.zIndex || 0), 0);
    const additions: CanvasItem[] = media.map((item, index) => ({
      id: `${item.kind}-${crypto.randomUUID()}`,
      ...(item.kind === "image" ? { imageSrc: item.src } : { videoSrc: item.src, videoMimeType: item.mimeType }),
      x: center.x - 100 + index * 24,
      y: center.y - 150 + index * 24,
      width: 200,
      height: 300,
      isSelected: false,
      zIndex: maxZ + index + 1,
      metadata: {
        source,
        ...(item.kind === "image" && item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
      },
    }));

    items$.next([...items$.value, ...additions]);
  };

  const closeDialog = () => {
    const dialog = document.getElementById("capture-tool-dialog") as HTMLDialogElement | null;
    if (dialog?.open) {
      dialog.close();
    }
  };

  const stopVideoRecording = (keepResult: boolean) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;
    keepRecordingResult = keepResult;
    mediaRecorder.stop();
  };

  const stopCamera = () => {
    stopVideoRecording(false);
    const stream = stream$.value;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream$.next(null);
    }
  };

  const openFilePicker = () => {
    const input = document.getElementById("capture-tool-file-input") as HTMLInputElement | null;
    input?.click();
  };

  const openDialog = () => {
    const dialog = document.getElementById("capture-tool-dialog") as HTMLDialogElement | null;
    if (!dialog) return;
    if (!dialog.open) {
      pendingPhotos$.next([]);
      pendingVideo$.next(null);
      captureMode$.next("image");
      dialog.showModal();
      void refreshCameras();
    }
  };

  const refreshCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(({ kind }) => kind === "videoinput");
      cameras$.next(cameras);
      if (selectedCameraId$.value && !cameras.some(({ deviceId }) => deviceId === selectedCameraId$.value)) {
        selectedCameraId$.next("");
      }
    } catch {
      cameras$.next([]);
    }
  };

  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const uploadedMedia: CapturedMedia[] = [];
    const skippedFiles: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const src = await blobToDataUrl(file);
        if (file.type.startsWith("image/")) {
          uploadedMedia.push({
            kind: "image",
            src,
            mimeType: file.type,
            thumbnailUrl: await createThumbnail(src),
          });
        } else if (file.type.startsWith("video/")) {
          uploadedMedia.push({ kind: "video", src, mimeType: file.type });
        } else {
          skippedFiles.push(file.name);
        }
      } catch {
        skippedFiles.push(file.name);
      }
    }

    commitMedia(uploadedMedia, "upload");
    input.value = "";
    if (skippedFiles.length > 0) alert(`Could not upload: ${skippedFiles.join(", ")}`);
  };

  const startCamera = async (deviceId = selectedCameraId$.value) => {
    if (stream$.value) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream$.next(stream);
      selectedCameraId$.next(stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId);
      await refreshCameras();

      requestAnimationFrame(() => {
        const video = document.getElementById("capture-tool-video") as HTMLVideoElement | null;
        if (video) {
          video.srcObject = stream;
        }
      });
    } catch {
      alert("Could not access webcam.");
    }
  };

  const selectCamera = async (deviceId: string) => {
    if (deviceId === selectedCameraId$.value) return;
    selectedCameraId$.next(deviceId);
    if (!stream$.value) return;
    stopCamera();
    await startCamera(deviceId);
  };

  const captureFromCamera = async () => {
    const video = document.getElementById("capture-tool-video") as HTMLVideoElement | null;
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

  const setCaptureMode = (mode: CaptureMode) => {
    if (mode === captureMode$.value) return;
    stopVideoRecording(false);
    pendingPhotos$.next([]);
    pendingVideo$.next(null);
    captureMode$.next(mode);
  };

  const startVideoRecording = () => {
    const stream = stream$.value;
    const mimeType = getSupportedVideoMimeType();
    if (!stream || !mimeType || isRecording$.value) return;

    pendingVideo$.next(null);
    recordedChunks = [];
    keepRecordingResult = false;
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder = recorder;

    recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      recordedChunks = [];
      isRecording$.next(false);
      alert("Video recording failed.");
    });
    recorder.addEventListener("stop", () => {
      const chunks = recordedChunks;
      const shouldKeep = keepRecordingResult;
      recordedChunks = [];
      keepRecordingResult = false;
      mediaRecorder = null;
      if (!shouldKeep || chunks.length === 0) {
        isRecording$.next(false);
        return;
      }

      const blob = new Blob(chunks, { type: recorder.mimeType });
      void blobToDataUrl(blob)
        .then((src) => pendingVideo$.next({ src, mimeType: recorder.mimeType }))
        .catch(() => alert("Could not prepare the recorded video."))
        .finally(() => isRecording$.next(false));
    });

    recorder.start();
    isRecording$.next(true);
  };

  const commitPhotos = () => {
    const pending = pendingPhotos$.value;
    if (pending.length === 0) return;

    commitMedia(
      pending.map((photo) => ({
        kind: "image",
        src: photo.fullDataUrl,
        mimeType: "image/jpeg",
        thumbnailUrl: photo.thumbnailUrl,
      })),
      "capture-tool",
    );
    pendingPhotos$.next([]);
    stopCamera();
    closeDialog();
  };

  const commitVideo = () => {
    const pendingVideo = pendingVideo$.value;
    if (!pendingVideo) return;
    commitMedia([{ kind: "video", ...pendingVideo }], "capture-tool");
    pendingVideo$.next(null);
    stopCamera();
    closeDialog();
  };

  const handleDialogClose = () => {
    stopCamera();
    pendingPhotos$.next([]);
    pendingVideo$.next(null);
    captureMode$.next("image");
  };

  const stopCameraEffect$ = stream$.pipe(
    tap((stream) => {
      if (stream) return;
      const video = document.getElementById("capture-tool-video") as HTMLVideoElement | null;
      if (video) {
        video.srcObject = null;
      }
    }),
    ignoreElements(),
  );

  const template$ = combineLatest([
    pendingPhotos$,
    pendingVideo$,
    stream$,
    captureMode$,
    isRecording$,
    cameras$,
    selectedCameraId$,
  ]).pipe(
    map(([pendingPhotos, pendingVideo, stream, captureMode, isRecording, cameras, selectedCameraId]) => {
      const videoMimeType = getSupportedVideoMimeType();
      return html`
        <div class="capture-tool">
          <menu class="capture-tool-menu">
            <button @click=${openFilePicker}>Upload</button>
            <button @click=${openDialog}>Capture</button>
          </menu>

          <input
            id="capture-tool-file-input"
            type="file"
            accept="image/*,video/*"
            multiple
            @change=${handleFileUpload}
            hidden
          />

          <dialog id="capture-tool-dialog" @close=${handleDialogClose}>
            <div class="capture-tool-dialog-body">
              <header class="capture-tool-header">
                <h3>Capture</h3>
                <div class="capture-tool-mode" role="group" aria-label="Capture type">
                  <label>
                    <input
                      type="radio"
                      name="capture-tool-mode"
                      value="image"
                      .checked=${captureMode === "image"}
                      ?disabled=${isRecording}
                      @change=${() => setCaptureMode("image")}
                    />
                    Image
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="capture-tool-mode"
                      value="video"
                      .checked=${captureMode === "video"}
                      ?disabled=${isRecording || !videoMimeType}
                      @change=${() => setCaptureMode("video")}
                    />
                    Video
                  </label>
                </div>
              </header>

              <section class="capture-tool-content">
                <menu class="capture-tool-menu">
                  ${stream
                    ? captureMode === "image"
                      ? html`<button @click=${captureFromCamera}>Capture image</button>
                          <button @click=${stopCamera}>Stop camera</button>`
                      : html`<button @click=${() => stopVideoRecording(true)} ?disabled=${!isRecording}>
                            Stop recording
                          </button>
                          <button @click=${startVideoRecording} ?disabled=${isRecording}>Start recording</button>
                          <button @click=${stopCamera} ?disabled=${isRecording}>Stop camera</button>`
                    : html`<button @click=${() => void startCamera()}>Start camera</button>`}
                </menu>

                ${cameras.length > 1
                  ? html`<label class="capture-tool-camera-select">
                      Camera
                      <select
                        .value=${selectedCameraId}
                        ?disabled=${isRecording}
                        @change=${(event: Event) => void selectCamera((event.target as HTMLSelectElement).value)}
                      >
                        ${cameras.map(
                          (camera, index) =>
                            html`<option value=${camera.deviceId}>${camera.label || `Camera ${index + 1}`}</option>`,
                        )}
                      </select>
                    </label>`
                  : html``}
                ${captureMode === "video" && !videoMimeType
                  ? html`<p>Video recording is not supported by this browser.</p>`
                  : html``}
                ${stream
                  ? html`<video id="capture-tool-video" autoplay playsinline class="capture-tool-video"></video>`
                  : html``}
                ${captureMode === "image" && pendingPhotos.length > 0
                  ? html`
                      <div class="capture-tool-previews">
                        ${pendingPhotos.map(
                          (photo) => html`
                            <div class="capture-tool-preview">
                              <img src=${photo.thumbnailUrl} alt="Pending scan" />
                              <button @click=${() => removePending(photo.id)}>Remove</button>
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html``}
                ${captureMode === "video" && pendingVideo
                  ? html`<div class="capture-tool-recording-preview">
                      <video src=${pendingVideo.src} controls playsinline preload="metadata"></video>
                      <button @click=${() => pendingVideo$.next(null)}>Retry</button>
                    </div>`
                  : html``}
              </section>

              <footer class="capture-tool-footer">
                <menu class="capture-tool-menu">
                  ${captureMode === "image"
                    ? html`<button ?disabled=${pendingPhotos.length === 0} @click=${commitPhotos}>Confirm</button>`
                    : html`<button ?disabled=${!pendingVideo || isRecording} @click=${commitVideo}>Confirm</button>`}
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
