import type { Content } from "@google/genai";
import { html, render } from "lit-html";
import { BehaviorSubject, Subject, EMPTY, from, mergeMap, scan } from "rxjs";
import { CenterPanelComponent } from "./components/center-panel/center-panel.component";
import { loadApiKeys } from "./components/connections/storage";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { LeftPanelComponent } from "./components/left-panel/left-panel.component";
import { runScanAI } from "./lib/studio-ai";
import type { PhotoCard, ScannedPhoto } from "./lib/studio-types";
import { clearAllPersistence, persistSubject } from "./lib/persistence";
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

// Persist state
persistSubject(pickedColors$, "studio:pickedColors");
persistSubject(pickedMaterials$, "studio:pickedMaterials");
persistSubject(pickedSurfaceOptions$, "studio:pickedSurfaceOptions");
persistSubject(pickedMechanisms$, "studio:pickedMechanisms");
persistSubject(pickedShapes$, "studio:pickedShapes");
persistSubject(customInstructions$, "studio:customInstructions");
persistSubject(synthesisOutput$, "studio:synthesisOutput");
persistSubject(editInstructions$, "studio:editInstructions");
persistSubject(photoScene$, "studio:photoScene");
persistSubject(photoGallery$, "studio:photoGallery");

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
      ).pipe(
        mergeMap((result) => (result ? from([result]) : EMPTY)),
      ),
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
    const mergeUnique = (current: string[], additions: string[]) => [
      ...new Set([...current, ...additions]),
    ];
    pickedShapes$.next(mergeUnique(pickedShapes$.value, accumulated.shapes));
    pickedMaterials$.next(mergeUnique(pickedMaterials$.value, accumulated.materials));
    pickedMechanisms$.next(mergeUnique(pickedMechanisms$.value, accumulated.mechanisms));
    pickedColors$.next(mergeUnique(pickedColors$.value, accumulated.colors));
  });

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: loadApiKeys().together || "" },
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: loadApiKeys().gemini || "" },
}));

// Main layout
const Main = createComponent(() => {
  return html`
    <aside class="panel-left">${LeftPanelComponent({
      pickedColors$, pickedMaterials$, pickedSurfaceOptions$, pickedMechanisms$, pickedShapes$,
      filterText$,
      scanDialogProps: { scannedPhotos$, scanTrigger$ },
    })}</aside>
    <main class="panel-center">${CenterPanelComponent({
      pickedColors$, pickedMaterials$, pickedSurfaceOptions$, pickedMechanisms$, pickedShapes$,
      customInstructions$, synthesisOutput$, isSynthesizing$, editInstructions$,
      conversationHistory$, photoScene$, photoGallery$, scannedPhotos$,
    })}</main>
  `;
});

// Reset button
const resetButton = document.getElementById("reset-button");
if (resetButton) {
  resetButton.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset? All data will be lost.")) return;
    await clearAllPersistence();
    window.location.reload();
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

render(Main(), document.getElementById("app")!);
