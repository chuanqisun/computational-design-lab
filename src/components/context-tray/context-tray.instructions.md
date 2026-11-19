---
applyTo: "**/context-tray/**"
---

## Action layer

Tray tools are thin forms. Each one calls `runUserAction(runtime, "<action>", { ...args, cardIds })` and never generates content or mutates `items$` itself. Section visibility comes from `isTrayVisible(runtime, action)`, which is the same `isAvailable` predicate the agent uses. See `.github/copilot-instructions.md` → Action layer.

## Layout

Sections: New, Visualize, Scan, Blend, Design (**Create** = `design_concepts`, **Iterate** = `iterate_designs`, sharing one requirements/feedback box, brand guide and count), User testing, Media (**Sketch** = `edit_image`, **Animate** = `animate`), Canvas, Export, Workflow.

Vertical stack of tools. Each tool can expand/collapse like an accordion.
The left edge can be dragged to resize the width of the tray. Initial width is 240px.

Animate output controls reset on each dialog open. Duration offers Default, 4 sec, 8 sec, and 15 sec; Default omits the request duration, and `extend` enforces `<= 10s`.
Animate task type resets to Default and also offers `text_to_video`, `image_to_video`, `reference_to_video`, `edit`, and `extend`; Default omits task configuration.
Animate uses `gemini-omni-1.2-flash` on `v1beta` with `delivery: "inline"` and `store: false` (supporting up to 6 image inputs). When multiple images or a video with images are selected on the board, non-primary / additional images default to the Reference role.
Animate requests increment `progress$.videoGen` on subscription and decrement it on every termination path.
Animate sketches replace Auto and Reference image inputs with their annotated versions. For Starting frame, submit the original as `ImageN` and append the annotated version as `Image{total+1}`.
Animate role prompts and copy controls use positional natural-language image labels (`Image1`, `Image2`, ...), including both `ImageN` and `Image{total+1}` for an annotated starting frame.
Animate output cards omit title and body, so the action layer's card fill (`settle$`) derives both fields from the generated video. Animate is an `async` action: it adds a `pending: "video"` placeholder card and returns immediately.
The Animate dialog is capped to the visible viewport and scrolls vertically when its content is taller.
The Capture dialog lists available webcams after permission is granted and lets the user switch the active preview camera when not recording.
New combines capture/upload and a shared prompt box with three action buttons below (**Render**, **Write**, **Search**). Search runs a two-step streaming pipeline: Step 1 streams up to 9 structured `{ title, details }` results via `gemini-4-hydrogen` + `google_search` (parsed incrementally with `@streamparser/json`), immediately placing each `200x300` card on the canvas with `metadata.pending = "search"`, and Step 2 immediately fires per-card grounded image generation in parallel via `mergeMap` using `gemini-nano-banana-2.1` (`1K`, `thinking_level: "minimal"`, `web_search` + `image_search`).
User testing tags generated synthetic user cards with `metadata.kind = "synthetic-user"`, `gender` (`"female" | "male" | "neutral"`), and a gender-matched Gemini Live `voiceName` (and recognizes legacy `persona-*` cards). Selecting exactly one synthetic user card plus zero or more non-user cards enables the **Interview** button, which mints a single-use `v1beta` ephemeral token via `authTokens.create` and opens a `gemini-3.8-live` voice session using the persona's assigned `voiceName` (`speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`) and all selected cards' images and text as context; clicking **Stop** summarizes the transcript with `gemini-4-hydrogen` into a standard `200x300` canvas card with only `title` and `body`, then settles it, so the action layer's card fill derives `imagePrompt` and renders the image. The agent's equivalent is `interview_persona` with text `questions` (`llm/interview-text.ts`), which produces the same summary card. Active interview state persists across selection changes and keeps the User testing section visible so the **Stop** button is always accessible and recoverable even if the user deselects and reselects cards during an interview.
