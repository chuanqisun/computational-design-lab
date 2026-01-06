import { html, render } from "lit-html";
import { BehaviorSubject } from "rxjs";
import { library, type ComponentType, type LibraryItem } from "./assets/library/index";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { getRenderPrompt, type ViewType } from "./components/virtual-design-system/render";
import "./main-page.css";
import "./material-page.css";

// Shared state for API keys
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: apiKeys$.value.together || "" },
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

// State
const selectedComponents: Record<ComponentType, LibraryItem | null> = {
  shape: null,
  cap: null,
  material: null,
  surface: null,
};

// DOM references
const dialog = document.getElementById("picker-dialog") as HTMLDialogElement;
const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;
const setupDialog = document.getElementById("setup-dialog") as HTMLDialogElement;
const setupDialogContent = setupDialog.querySelector(".dialog-content") as HTMLElement;
const pickerButtons = document.querySelectorAll(".image-picker") as NodeListOf<HTMLButtonElement>;
const renderButtons = document.querySelectorAll(".render-perspective") as NodeListOf<HTMLButtonElement>;
const setupButton = document.getElementById("setup-button") as HTMLButtonElement;
const previewsGrid = document.querySelector(".previews-grid") as HTMLElement;
const capColorPicker = document.getElementById("cap-color") as HTMLInputElement;

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

    previewsGrid.prepend(genImage);
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
