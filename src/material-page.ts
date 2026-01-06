import { html, render } from "lit-html";
import { library, type ComponentType } from "./assets/library/index";
import "./main-page.css";

// State
const selectedComponents: Record<ComponentType, string | null> = {
  shape: null,
  cap: null,
  material: null,
  surface: null,
};

// DOM references
const dialog = document.getElementById("picker-dialog") as HTMLDialogElement;
const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;
const pickerButtons = document.querySelectorAll(".image-picker") as NodeListOf<HTMLButtonElement>;

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
  const items = library[componentType];
  const selected = selectedComponents[componentType];

  const template = html`
    <div class="dialog-header">
      <h2>Select ${componentType}</h2>
      <button commandfor="picker-dialog" command="close">Close</button>
    </div>
    <div class="dialog-grid">
      ${items.map(
        (url, index) => html`
          <button
            class="dialog-item"
            data-url="${url}"
            data-selected="${url === selected}"
            @click="${() => selectItem(componentType, url)}"
          >
            <img src="${url}" alt="${componentType} ${index + 1}" />
          </button>
        `,
      )}
    </div>
  `;

  render(template, dialogContent);
}

// Handle item selection
function selectItem(componentType: ComponentType, url: string) {
  selectedComponents[componentType] = url;

  // Update the button
  const button = Array.from(pickerButtons).find((btn) => btn.dataset.component === componentType);
  if (button) {
    updateButton(button, url);
  }

  // Close dialog
  dialog.close();
}

// Setup button click handlers
pickerButtons.forEach((button) => {
  const componentType = button.dataset.component as ComponentType;

  // Store original label
  button.setAttribute("data-label", (button.textContent || "").trim());

  button.addEventListener("click", () => {
    renderDialog(componentType);
  });

  // Initialize button appearance
  updateButton(button, selectedComponents[componentType]);
});
