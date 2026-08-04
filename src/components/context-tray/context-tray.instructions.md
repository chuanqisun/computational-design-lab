---
applyTo: "**/context-tray/**"
---

## Layout

Vertical stack of tools. Each tool can expand/collapse like an accordion.
The left edge can be dragged to resize the width of the tray. Initial width is 240px.

Animate output controls reset on each dialog open. Duration offers Default, 4 sec, and 8 sec; Default omits the request duration.
Animate task type resets to Default and also offers `text_to_video`, `image_to_video`, `reference_to_video`, and `edit`; Default omits task configuration.
Animate requests increment `progress$.videoGen` on subscription and decrement it on every termination path.
