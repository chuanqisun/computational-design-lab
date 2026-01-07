import { html, render } from "lit-html";
import { BehaviorSubject, debounceTime, skip } from "rxjs";
import { library, type ComponentType, type LibraryItem } from "./assets/library/index";
import { ConnectionsComponent } from "./components/connections/connections.component";
import {
  loadApiKeys,
  loadMaterialPageState,
  saveMaterialPageState,
  type ApiKeys,
  type MaterialPageState,
} from "./components/connections/storage";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import { generateAnimationPrompt } from "./components/virtual-design-system/animator";
import { getRenderPrompt, type ViewType } from "./components/virtual-design-system/render";
import "./main-page.css";
import "./material-page.css";

// Shared state for API keys
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

// Observable for triggering persistence
const saveState$ = new BehaviorSubject<void>(undefined);

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: apiKeys$.value.together || "" },
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

// State
const selectedComponents: Record<ComponentType, LibraryItem | null> = {
  shape: null,
  cap: null,
  material: null,
  surface: null,
};

// Load persisted state
const persistedState = loadMaterialPageState();
if (persistedState) {
  // Restore selections
  for (const [type, itemUrl] of Object.entries(persistedState.selectedComponents)) {
    if (itemUrl) {
      const item = library.find((i) => i.url === itemUrl);
      if (item) {
        selectedComponents[type as ComponentType] = item;
      }
    }
  }
}

// DOM references
const dialog = document.getElementById("picker-dialog") as HTMLDialogElement;
const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;
const setupDialog = document.getElementById("setup-dialog") as HTMLDialogElement;
const setupDialogContent = setupDialog.querySelector(".dialog-content") as HTMLElement;
const pickerButtons = document.querySelectorAll(".image-picker") as NodeListOf<HTMLButtonElement>;
const renderButtons = document.querySelectorAll(".render-perspective") as NodeListOf<HTMLButtonElement>;
const setupButton = document.getElementById("setup-button") as HTMLButtonElement;
const resetComponentsButton = document.getElementById("reset-components-button") as HTMLButtonElement;
const resetPreviewsButton = document.getElementById("reset-previews-button") as HTMLButtonElement;
const previewsGrid = document.querySelector(".previews-grid") as HTMLElement;
const capColorPicker = document.getElementById("cap-color") as HTMLInputElement;

// Restore cap color
if (persistedState?.capColor) {
  capColorPicker.value = persistedState.capColor;
}

// Helper to serialize preview elements for persistence
function serializePreview(element: HTMLElement): MaterialPageState["previews"][0] | null {
  const componentIds = element.getAttribute("data-components")?.split(",").map(Number);

  if (element.tagName.toLowerCase() === "generative-image") {
    return {
      type: "image",
      prompt: element.getAttribute("prompt") || "",
      model: element.getAttribute("model") || "",
      width: element.getAttribute("width") || undefined,
      height: element.getAttribute("height") || undefined,
      aspectRatio: element.getAttribute("aspect-ratio") || undefined,
      componentIds,
    };
  } else if (element.tagName.toLowerCase() === "generative-video") {
    return {
      type: "video",
      prompt: element.getAttribute("prompt") || "",
      model: element.getAttribute("model") || "",
      aspectRatio: element.getAttribute("aspect-ratio") || undefined,
      startFrame: element.getAttribute("start-frame") || undefined,
      componentIds,
    };
  }
  return null;
}

// Helper to collect current state
function getCurrentState(): MaterialPageState {
  const previews: MaterialPageState["previews"] = [];
  const previewItems = previewsGrid.querySelectorAll(".preview-item");

  previewItems.forEach((item) => {
    const element = item.querySelector("generative-image, generative-video") as HTMLElement;
    if (element) {
      const serialized = serializePreview(element);
      if (serialized) {
        previews.push(serialized);
      }
    }
  });

  return {
    selectedComponents: {
      shape: selectedComponents.shape?.url || null,
      cap: selectedComponents.cap?.url || null,
      material: selectedComponents.material?.url || null,
      surface: selectedComponents.surface?.url || null,
    },
    capColor: capColorPicker.value,
    previews,
  };
}

// Auto-save with debouncing
saveState$.pipe(skip(1), debounceTime(250)).subscribe(() => {
  const state = getCurrentState();
  saveMaterialPageState(state).catch((error) => {
    console.error("Failed to save material page state:", error);
  });
});

// Trigger save on cap color change
capColorPicker.addEventListener("input", () => saveState$.next());

// Render Setup Dialog
function renderSetup() {
  const template = html`
    <div class="dialog-header">
      <h2>Connections</h2>
      <button @click=${() => setupDialog.close()}>Close</button>
    </div>
    <div class="setup-form">${ConnectionsComponent({ apiKeys$ })}</div>
  `;
  render(template, setupDialogContent);
  setupDialog.showModal();
}

setupButton.addEventListener("click", renderSetup);

// Reset components handler
resetComponentsButton.addEventListener("click", () => {
  // Clear all selections
  for (const type of Object.keys(selectedComponents) as ComponentType[]) {
    selectedComponents[type] = null;
  }

  // Reset all picker buttons
  pickerButtons.forEach((button) => {
    updateButton(button, null);
  });

  // Reset cap color to default
  capColorPicker.value = "#ffffff";

  // Trigger save
  saveState$.next();
});

// Reset previews handler
resetPreviewsButton.addEventListener("click", () => {
  // Clear all preview items
  previewsGrid.innerHTML = "";

  // Trigger save
  saveState$.next();
});

// Update button appearance based on selection
function updateButton(button: HTMLButtonElement, imageUrl: string | null) {
  if (imageUrl) {
    button.style.backgroundImage = `url("${imageUrl}")`;
    button.setAttribute("data-picked", "true");
    button.textContent = "";
  } else {
    button.style.backgroundImage = "";
    button.removeAttribute("data-picked");
  }
}

// Render dialog content
function renderDialog(componentType: ComponentType) {
  const items = library.filter((item) => item.type === componentType);
  const selected = selectedComponents[componentType];

  const template = html`
    <div class="dialog-header">
      <h2>Select ${componentType}</h2>
      <button commandfor="picker-dialog" command="close">Close</button>
    </div>
    <div class="dialog-grid">
      ${items.map(
        (item) => html`
          <button
            class="dialog-item"
            data-url="${item.url}"
            data-selected="${item === selected}"
            @click="${() => selectItem(componentType, item)}"
          >
            <img src="${item.url}" alt="${item.name}" />
            <div class="item-name">${item.name}</div>
          </button>
        `,
      )}
    </div>
  `;

  render(template, dialogContent);
}

// Handle item selection
function selectItem(componentType: ComponentType, item: LibraryItem) {
  selectedComponents[componentType] = item;

  // Update the button
  const button = Array.from(pickerButtons).find((btn) => btn.dataset.component === componentType);
  if (button) {
    updateButton(button, item.url);
  }

  // Close dialog
  dialog.close();

  // Trigger save
  saveState$.next();
}

function createPreviewItem(element: HTMLElement) {
  const container = document.createElement("div");
  container.className = "preview-item";

  const actions = document.createElement("div");
  actions.className = "preview-actions";

  const animateBtn = document.createElement("button");
  animateBtn.className = "action";
  animateBtn.textContent = "Animate";
  animateBtn.addEventListener("click", async () => {
    const status = element.getAttribute("status");
    if (status !== "success") {
      alert("Please wait for the generation to complete before animating.");
      return;
    }

    const img = element.querySelector("img");
    if (!img || !img.src) return;

    try {
      // Get the component IDs stored on the element itself
      const rawIds = element.getAttribute("data-components");
      if (!rawIds) {
        alert("Could not find the original components used for this image.");
        return;
      }

      const componentIds = rawIds.split(",").map(Number);
      const components = componentIds
        .map((id) => library.find((item) => item.id === id))
        .filter((c): c is LibraryItem => c !== undefined);

      if (components.length < 4) {
        alert("Failed to resolve some of the original components.");
        return;
      }

      animateBtn.textContent = "Scripting...";
      animateBtn.disabled = true;

      const videoPrompt = await generateAnimationPrompt({ apiKey: apiKeys$.value.gemini || "" }, components);

      const genVideo = document.createElement("generative-video");
      genVideo.setAttribute("prompt", videoPrompt);
      genVideo.setAttribute("start-frame", img.src);
      genVideo.setAttribute("model", "veo-3.1-fast-generate-preview");
      genVideo.setAttribute("aspect-ratio", "9:16");
      genVideo.setAttribute("data-components", rawIds);

      const newItem = createPreviewItem(genVideo);
      container.before(newItem);
    } catch (error) {
      console.error("Failed to generate animation prompt:", error);
      alert("Failed to generate animation prompt. Please check your connection and configuration.");
    } finally {
      animateBtn.textContent = "Animate";
      animateBtn.disabled = false;
    }
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    container.remove();
    saveState$.next();
  });

  if (element.tagName.toLowerCase() === "generative-image") {
    actions.appendChild(animateBtn);
  }

  actions.appendChild(deleteBtn);
  container.appendChild(actions);
  container.appendChild(element);

  return container;
}

// Render button logic
renderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view as ViewType;
    if (
      !selectedComponents.shape ||
      !selectedComponents.material ||
      !selectedComponents.cap ||
      !selectedComponents.surface
    ) {
      alert("Please select all components (Shape, Cap, Material, Surface) before rendering.");
      return;
    }

    const prompt = getRenderPrompt(
      selectedComponents.shape,
      selectedComponents.material,
      selectedComponents.cap,
      selectedComponents.surface,
      view,
      capColorPicker.value,
    );

    const genImage = document.createElement("generative-image");
    genImage.setAttribute("prompt", prompt);
    genImage.setAttribute("width", "720");
    genImage.setAttribute("height", "1280");
    genImage.setAttribute("aspect-ratio", "9:16");
    genImage.setAttribute("model", "gemini-2.5-flash-image");

    // Store component IDs on the element
    const ids = [
      selectedComponents.shape.id,
      selectedComponents.cap.id,
      selectedComponents.material.id,
      selectedComponents.surface.id,
    ];
    genImage.setAttribute("data-components", ids.join(","));

    previewsGrid.prepend(createPreviewItem(genImage));
    saveState$.next();
  });
});

// Setup button click handlers
pickerButtons.forEach((button) => {
  const componentType = button.dataset.component as ComponentType;

  // Store original label
  button.setAttribute("data-label", (button.textContent || "").trim());

  button.addEventListener("click", () => {
    renderDialog(componentType);
  });

  // Initialize button appearance
  updateButton(button, selectedComponents[componentType]?.url ?? null);
});

// Restore previews from persisted state
if (persistedState?.previews) {
  persistedState.previews.forEach((previewData) => {
    let element: HTMLElement;

    if (previewData.type === "image") {
      element = document.createElement("generative-image");
      element.setAttribute("prompt", previewData.prompt);
      element.setAttribute("model", previewData.model);
      if (previewData.width) element.setAttribute("width", previewData.width);
      if (previewData.height) element.setAttribute("height", previewData.height);
      if (previewData.aspectRatio) element.setAttribute("aspect-ratio", previewData.aspectRatio);
      if (previewData.componentIds) element.setAttribute("data-components", previewData.componentIds.join(","));
    } else {
      element = document.createElement("generative-video");
      element.setAttribute("prompt", previewData.prompt);
      element.setAttribute("model", previewData.model);
      if (previewData.aspectRatio) element.setAttribute("aspect-ratio", previewData.aspectRatio);
      if (previewData.startFrame) element.setAttribute("start-frame", previewData.startFrame);
      if (previewData.componentIds) element.setAttribute("data-components", previewData.componentIds.join(","));
    }

    previewsGrid.appendChild(createPreviewItem(element));
  });
}
