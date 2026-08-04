---
applyTo: "**/context-tray/**"
---

## Layout

Vertical stack of tools. Each tool can expand/collapse like an accordion.
The left edge can be dragged to resize the width of the tray. Initial width is 240px.

Animate output controls reset on each dialog open. Duration offers Default, 4 sec, and 8 sec; Default omits the request duration.
Animate task type resets to Default and also offers `text_to_video`, `image_to_video`, `reference_to_video`, and `edit`; Default omits task configuration.
Animate requests increment `progress$.videoGen` on subscription and decrement it on every termination path.
Animate sketches replace Auto and Reference image inputs with their annotated versions. For Starting frame, submit the original as the first frame and append the annotated version as a reference.
Animate image copy controls use Gemini prompt tags such as `<FIRST_FRAME>` and `<IMAGE_REF_0>`, including both tags for an annotated starting frame.
Animate output cards omit title and body so the card auto-fill flow derives both fields from the generated video.
The Animate dialog is capped to the visible viewport and scrolls vertically when its content is taller.
The Capture dialog lists available webcams after permission is granted and lets the user switch the active preview camera when not recording.
