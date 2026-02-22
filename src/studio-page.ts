import type { Content } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, EMPTY, from, mergeMap, scan, Subject } from "rxjs";
import { CenterPanelComponent } from "./components/center-panel/center-panel.component";
import { loadApiKeys } from "./components/connections/storage";
import { useSetupDialog } from "./components/connections/use-setup-dialog";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { LeftPanelComponent } from "./components/left-panel/left-panel.component";
import { clearPersistenceExcept, persistSubject } from "./lib/persistence";
import { runScanAI } from "./lib/studio-ai";
import type { PhotoCard, ScannedPhoto } from "./lib/studio-types";
import { createComponent } from "./sdk/create-component";
import "./studio-page.css";

// Shared state
const pickedColors$ = new BehaviorSubject<string[]>([]);
const pickedMaterials$ = new BehaviorSubject<string[]>([]);
const pickedSurfaceOptions$ = new BehaviorSubject<string[]>([]);
const pickedMechanisms$ = new BehaviorSubject<string[]>([]);
const pickedShapes$ = new BehaviorSubject<string[]>([]);
const filterText$ = new BehaviorSubject<string>("");
const customInstructions$ = new BehaviorSubject<string>("");
const synthesisOutput$ = new BehaviorSubject<string>("");
const isSynthesizing$ = new BehaviorSubject<boolean>(false);
const editInstructions$ = new BehaviorSubject<string>("");
const conversationHistory$ = new BehaviorSubject<Content[]>([]);
const photoScene$ = new BehaviorSubject<string>("Product stand by itself");
const photoGallery$ = new BehaviorSubject<PhotoCard[]>([]);
const scannedPhotos$ = new BehaviorSubject<ScannedPhoto[]>([]);
const apiKeys$ = new BehaviorSubject(loadApiKeys());

const clearInputs = () => {
  pickedColors$.next([]);
  pickedMaterials$.next([]);
  pickedSurfaceOptions$.next([]);
  pickedMechanisms$.next([]);
  pickedShapes$.next([]);
  filterText$.next("");
  customInstructions$.next("");
  editInstructions$.next("");
  scannedPhotos$.next([]);
};

// Persist state
const persistenceReady = Promise.all([
  persistSubject(pickedColors$, "studio:pickedColors"),
  persistSubject(pickedMaterials$, "studio:pickedMaterials"),
  persistSubject(pickedSurfaceOptions$, "studio:pickedSurfaceOptions"),
  persistSubject(pickedMechanisms$, "studio:pickedMechanisms"),
  persistSubject(pickedShapes$, "studio:pickedShapes"),
  persistSubject(customInstructions$, "studio:customInstructions"),
  persistSubject(synthesisOutput$, "studio:synthesisOutput"),
  persistSubject(editInstructions$, "studio:editInstructions"),
  persistSubject(photoScene$, "studio:photoScene"),
  persistSubject(photoGallery$, "studio:photoGallery"),
]);

// Scan pipeline: parallel scans are additive-only with auto-dedup
const scanTrigger$ = new Subject<ScannedPhoto>();

scanTrigger$
  .pipe(
    mergeMap((photo) =>
      from(
        runScanAI(photo, scannedPhotos$).then((result) => {
          scannedPhotos$.next(
            scannedPhotos$.value.map((p) => (p.id === photo.id ? { ...p, label: "photo", isScanning: false } : p)),
          );
          return result;
        }),
      ).pipe(mergeMap((result) => (result ? from([result]) : EMPTY))),
    ),
    scan(
      (acc, result) => ({
        shapes: [...new Set([...acc.shapes, ...result.shapes])],
        materials: [...new Set([...acc.materials, ...result.materials])],
        mechanisms: [...new Set([...acc.mechanisms, ...result.mechanisms])],
        colors: [...new Set([...acc.colors, ...result.colors])],
      }),
      { shapes: [] as string[], materials: [] as string[], mechanisms: [] as string[], colors: [] as string[] },
    ),
  )
  .subscribe((accumulated) => {
    const mergeUnique = (current: string[], additions: string[]) => [...new Set([...current, ...additions])];
    pickedShapes$.next(mergeUnique(pickedShapes$.value, accumulated.shapes));
    pickedMaterials$.next(mergeUnique(pickedMaterials$.value, accumulated.materials));
    pickedMechanisms$.next(mergeUnique(pickedMechanisms$.value, accumulated.mechanisms));
    pickedColors$.next(mergeUnique(pickedColors$.value, accumulated.colors));
  });

// Register custom elements
GenerativeImageElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

// Main layout
const Main = createComponent(() => {
  return html`
    <aside class="panel-left">
      ${LeftPanelComponent({
        pickedColors$,
        pickedMaterials$,
        pickedSurfaceOptions$,
        pickedMechanisms$,
        pickedShapes$,
        filterText$,
        scanDialogProps: { scannedPhotos$, scanTrigger$ },
      })}
    </aside>
    <main class="panel-center">
      ${CenterPanelComponent({
        pickedColors$,
        pickedMaterials$,
        pickedSurfaceOptions$,
        pickedMechanisms$,
        pickedShapes$,
        customInstructions$,
        synthesisOutput$,
        isSynthesizing$,
        editInstructions$,
        conversationHistory$,
        photoScene$,
        photoGallery$,
        scannedPhotos$,
      })}
    </main>
  `;
});

// Reset button
const resetButton = document.getElementById("reset-button");
if (resetButton) {
  resetButton.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear input? All input data will be lost.")) return;
    clearInputs();
    synthesisOutput$.next("");
    isSynthesizing$.next(false);
    conversationHistory$.next([]);
    photoScene$.next("Product stand by itself");
    await clearPersistenceExcept(["studio:photoGallery"]);
  });
}

// Observe generative-image status changes to update imageReady
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "attributes" && mutation.attributeName === "status") {
      const el = mutation.target as HTMLElement;
      if (el.tagName.toLowerCase() !== "generative-image") continue;
      const card = el.closest("[data-photo-id]") as HTMLElement;
      if (!card) continue;
      const photoId = card.dataset.photoId;
      if (!photoId) continue;
      const status = el.getAttribute("status");
      if (status === "success") {
        const gallery = photoGallery$.value;
        const item = gallery.find((p) => p.id === photoId);
        if (item && !item.imageReady) {
          photoGallery$.next(gallery.map((p) => (p.id === photoId ? { ...p, imageReady: true } : p)));
        }
      }
    }
  }
});
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["status"] });

useSetupDialog({
  dialogElement: document.getElementById("setup-dialog") as HTMLDialogElement,
  apiKeys$,
});

render(Main(), document.getElementById("app")!);

// Handle import from canvas via fromCanvasBlob query param
const fromCanvasBlob = new URLSearchParams(window.location.search).get("fromCanvasBlob");
if (fromCanvasBlob) {
  persistenceReady.then(async () => {
    const isDirty =
      scannedPhotos$.value.length > 0 ||
      pickedShapes$.value.length > 0 ||
      pickedMaterials$.value.length > 0 ||
      pickedColors$.value.length > 0 ||
      pickedMechanisms$.value.length > 0;

    if (isDirty && !confirm("Importing from canvas will replace all current Studio input. Continue?")) return;

    try {
      const response = await fetch(fromCanvasBlob);
      const items: Array<{ title?: string; body?: string; imageSrc?: string; imagePrompt?: string }> =
        await response.json();

      clearInputs();

      for (const item of items) {
        if (!item.imageSrc) continue;
        const photo: ScannedPhoto = {
          id: `canvas-${crypto.randomUUID()}`,
          thumbnailUrl: item.imageSrc,
          fullDataUrl: item.imageSrc,
          label: "scanning...",
          isScanning: true,
        };
        scannedPhotos$.next([...scannedPhotos$.value, photo]);
        scanTrigger$.next(photo);
      }

      const cardDescriptions = items
        .filter((item) => item.title || item.body)
        .map((item) => [item.title, item.body].filter(Boolean).join("\n"))
        .join("\n\n");

      if (cardDescriptions) {
        customInstructions$.next(
          `Design a bottle inspired by the following design concept(s):\n\n${cardDescriptions}\n\nUse these concepts to guide the bottle's form, material, texture, color, and overall aesthetic.`,
        );
      }
    } catch (e) {
      console.error("Failed to import from canvas:", e);
    }
  });
}
