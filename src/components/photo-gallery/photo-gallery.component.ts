import { html, render } from "lit-html";
import type { BehaviorSubject } from "rxjs";
import { deletePhoto, generateAnimation, generateEdit } from "../../lib/studio-ai";
import type { PhotoCard } from "../../lib/studio-types";
import "./photo-gallery.component.css";

export interface PhotoGalleryProps {
  photoGallery$: BehaviorSubject<PhotoCard[]>;
}

export function openAnimationDialog(photoId: string, photoGallery$: BehaviorSubject<PhotoCard[]>) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const dialog = document.getElementById("animation-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  const template = html`
    <div class="dialog-header">
      <h2>Animation Instructions</h2>
      <button commandfor="animation-dialog" command="close">Close</button>
    </div>
    <textarea
      id="animation-instructions"
      placeholder="Enter animation instructions..."
      .value=${photo.animationPrompt}
    ></textarea>
    <textarea
      id="sound-description"
      placeholder="Sound description (generating...)"
      .value=${photo.soundDescription}
    ></textarea>
    <menu>
      <button @click=${() => {
        const textarea = dialog.querySelector("#animation-instructions") as HTMLTextAreaElement;
        const instructions = textarea?.value.trim() || photo.animationPrompt;
        const soundTextarea = dialog.querySelector("#sound-description") as HTMLTextAreaElement;
        const soundDesc = soundTextarea?.value.trim() || photo.soundDescription;
        if (!instructions) {
          alert("Please provide animation instructions.");
          return;
        }
        dialog.close();
        generateAnimation(photoId, instructions, soundDesc, photoGallery$);
      }}>Generate Animation</button>
    </menu>
  `;

  render(template, dialogContent);
  dialog.showModal();
}

export function openEditDialog(photoId: string, photoGallery$: BehaviorSubject<PhotoCard[]>) {
  const photo = photoGallery$.value.find((p) => p.id === photoId);
  if (!photo) return;

  const dialog = document.getElementById("edit-dialog") as HTMLDialogElement;
  const dialogContent = dialog.querySelector(".dialog-content") as HTMLElement;

  const template = html`
    <div class="dialog-header">
      <h2>Edit XML</h2>
      <button commandfor="edit-dialog" command="close">Close</button>
    </div>
    <textarea
      id="edit-xml-code"
      placeholder="Edit the XML code..."
      .value=${photo.prompt || photo.sourceXml}
    ></textarea>
    <menu>
      <button @click=${() => {
        const xmlTextarea = dialog.querySelector("#edit-xml-code") as HTMLTextAreaElement;
        const editedXml = xmlTextarea?.value.trim() || "";
        if (!editedXml) {
          alert("Please provide XML code.");
          return;
        }
        dialog.close();
        generateEdit(photoId, editedXml, photoGallery$);
      }}>Apply Edit</button>
    </menu>
  `;

  render(template, dialogContent);
  dialog.showModal();
}

export const renderPhotoGallery = (gallery: PhotoCard[], photoGallery$: BehaviorSubject<PhotoCard[]>) =>
  gallery.length > 0
    ? html`
        <section>
          <h2>Photo gallery</h2>
          <div class="output-cards">
            ${gallery.map(
              (photo) => html`
                <div class="output-card" data-photo-id="${photo.id}">
                  <div class="output-card-image">
                    ${photo.isGenerating || !photo.prompt
                      ? html`<div class="output-placeholder">Generating prompt...</div>`
                      : photo.isVideo
                        ? html`
                            <generative-video
                              prompt=${photo.prompt}
                              aspect-ratio="9:16"
                              model="veo-3.1-generate-preview"
                              start-frame=${photo.startFrameUrl || ""}
                            ></generative-video>
                          `
                        : html`
                            <generative-image
                              prompt=${photo.prompt}
                              width="540"
                              height="960"
                              aspect-ratio="9:16"
                              model="gemini-2.5-flash-image"
                            ></generative-image>
                          `}
                  </div>
                  <div class="output-card-meta">
                    <div class="output-card-caption">${photo.scene}</div>
                    <div class="output-card-actions">
                      <button class="action-btn" @click=${() => deletePhoto(photo.id, photoGallery$)}>Delete</button>
                      ${!photo.isGenerating && photo.prompt && !photo.isVideo && photo.imageReady
                        ? html`
                            <button class="action-btn" @click=${() => openAnimationDialog(photo.id, photoGallery$)}>
                              Animate
                            </button>
                            <button class="action-btn" @click=${() => openEditDialog(photo.id, photoGallery$)}>
                              Edit
                            </button>
                          `
                        : null}
                    </div>
                  </div>
                </div>
              `,
            )}
          </div>
        </section>
      `
    : null;
