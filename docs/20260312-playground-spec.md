# 2026-03-12 Product Design Spec For The Task-Centric Playground App

## 0. Document status

This is the implementation-facing product design spec for the new task-centric playground app.

It consolidates:

- the stakeholder interview in `docs/20260312-design-interview.md`
- the task inventory in `docs/20260312-task-list.md`
- the current reference app behavior in `src/canvas-page.ts`
- the current reference app behavior in `src/studio-page.ts`
- the current reusable data and prompt assets in `src/components/**`, `src/lib/**`, and `src/assets/**`

This spec is intended to remove ambiguity before implementation.

Where the current reference apps already encode useful prompt wording, structured outputs, or domain assets, implementation should preserve those source materials as closely as possible rather than rewriting them.

---

## 1. Final outline

1. Product purpose and audience
2. Source documents and code references
3. Non-negotiable product principles
4. Core domain model
5. Top-level application structure
6. Task model and lifecycle
7. MVP task set
8. Detailed task specifications
9. Shared interaction patterns
10. AI and prompt strategy
11. Persistence and shareability
12. Error handling, concurrency, and retry behavior
13. Accessibility and visual design constraints
14. Technical architecture constraints
15. Reference asset inventory to preserve
16. Deferred work
17. Open questions resolved for prototype
18. Developer handoff checklist

---

## 2. Product purpose and audience

### 2.1 Primary purpose

The app is a guided prompt-building and prompt-running environment for industrial designers, specifically packaging designers, who understand product design deeply but are not comfortable writing prompts or code.

This statement comes directly from `docs/20260312-design-interview.md` and should be treated as the product anchor.

### 2.2 Target users

Primary users are:

- enterprise product designers
- industrial designers
- packaging designers
- users designing products such as shampoo bottles and mouthwash bottles
- users working on large desktop screens in modern browsers

### 2.3 Core job to be done

The product must help users assemble modular prompt parts in predictable, domain-specific ways, then run those prompts live against Gemini-powered generation workflows.

The app is not primarily a general creativity canvas, a general chat tool, or an open-ended AI IDE. It is a focused, task-centric design tool.

### 2.4 Primary value proposition

The app should let users:

1. pick a task
2. supply raw design input or select structured design ingredients
3. see prompt-like output update in a concrete, inspectable form
4. run AI generation without leaving the app
5. keep all work locally persistent and resumable
6. switch between multiple tasks without losing context

---

## 3. Source documents and code references

This spec is grounded in the following source material.

### 3.1 Interview and planning documents

- `docs/20260312-design-interview.md`
- `docs/20260312-task-list.md`

### 3.2 Current reference app entry points

- `src/canvas-page.ts` — current mood-board style reference experience
- `src/studio-page.ts` — current structured packaging prompt builder reference experience
- `src/main-page.ts` — older multi-step system architecture reference

### 3.3 Canvas reference implementation

- `src/components/canvas/canvas.component.ts`
- `src/components/canvas/card.component.ts`
- `src/components/canvas/layout.ts`
- `src/components/canvas/pointer.ts`
- `src/components/context-tray/context-tray.component.ts`
- `src/components/context-tray/tools/*.ts`
- `src/components/context-tray/llm/*.ts`

### 3.4 Studio reference implementation

- `src/components/left-panel/left-panel.component.ts`
- `src/components/center-panel/center-panel.component.ts`
- `src/components/scan-dialog/scan-dialog.component.ts`
- `src/components/photo-gallery/photo-gallery.component.ts`
- `src/lib/studio-ai.ts`
- `src/lib/studio-types.ts`
- `src/lib/studio-utils.ts`
- `src/lib/persistence.ts`

### 3.5 Domain libraries and visual assets

- `src/components/material-library/shapes.ts`
- `src/components/material-library/materials.ts`
- `src/components/material-library/mechanisms.ts`
- `src/components/material-library/colors.ts`
- `src/assets/library/index.ts`

### 3.6 Connection and model integration references

- `src/components/connections/storage.ts`
- `src/components/connections/connections.component.ts`
- `src/components/connections/use-setup-dialog.ts`
- `src/components/connections/test-connections.ts`
- `src/components/connections/gemini.instructions.md`
- `src/components/connections/openai.instructions.md`

### 3.7 Framework and architecture references

- `.github/copilot-instructions.md`
- `.github/instructions/visual-design.instructions.md`
- `src/sdk/create-component.ts`
- `src/sdk/observe-directive.ts`
- `src/sdk/xml-editor.ts`

---

## 4. Non-negotiable product principles

The following principles are explicit requirements from the interview and task inventory.

### 4.1 Task-centric UI

- The app is organized around tasks, not around permanent sidebars, tools, or modes.
- One task fills the screen at a time.
- Task creation happens in a modal.
- Task switching happens in a modal.
- Multiple tasks may exist in parallel.
- A task does not need a special “finished” state to remain accessible.

### 4.2 Minimal visual design

- Keep the UI simple, light, monochrome, and efficient.
- No emoji.
- Avoid decorative styling.
- Use large-screen space efficiently.
- Use intrinsic HTML controls wherever possible.

These constraints align with `.github/instructions/visual-design.instructions.md`.

### 4.3 Prompt transparency

- The user should be able to inspect prompt-like outputs.
- Prompt outputs should be copyable with a consistent interaction pattern.
- For image generation tasks, the app should expose not just the generated image but also the prompt or structured prompt artifact when feasible.

### 4.4 Resumability

- Inputs, outputs, credentials, and in-progress task state must persist locally.
- Refresh must not wipe work.
- Errors must not wipe work.
- Users must be able to return to old tasks and use them as references for new tasks.

### 4.5 User-controlled concurrency

- Do not aggressively disable generation controls.
- Users should be able to run multiple generations from the same input.
- The system must not auto-retry failures.
- Retry is always user initiated.

### 4.6 Preserve existing prompt logic

- Existing prompt wording from the reference apps should be preserved whenever possible.
- If prompts must be refactored into templates, preserve the original language and structure.
- Structured outputs already implemented in reference code should remain the baseline.

---

## 5. Core domain model

### 5.1 Shared card model

The shared `card` model is the central abstraction of the new app.

This direction is mandated by `docs/20260312-task-list.md` and is already partially embodied in the current `CanvasItem` type in `src/components/canvas/canvas.component.ts` and the studio-specific `PhotoCard` / `ScannedPhoto` types in `src/lib/studio-types.ts`.

### 5.2 Required card fields

The cross-app card schema must include at minimum:

- `id`
- `title`
- `description`
- `imagePrompt`
- `image`
- `metadata`

For implementation planning, the current `CanvasItem` fields should be treated as the closest existing source model:

- `title`
- `body` -> rename conceptually to `description`
- `imageSrc` -> rename conceptually to `image`
- `imagePrompt`
- `metadata`

The new app may keep compatibility helpers during migration, but the product-level spec should standardize on `description` and `image` terminology.

### 5.3 Metadata traits

`metadata` must stay lightweight and purposeful. It is not a dumping ground.

It should support traits such as:

- source provenance
- originating task ID
- scan lens
- prompt revision history
- structured attributes
- render settings
- generation status
- scene type
- selected domain library references
- imported-from-task references

### 5.4 Card categories

Nearly all task input and output should be representable as one of these card families:

- reference cards
- text cards
- concept cards
- attribute cards
- prompt cards
- scene cards
- image cards
- persona cards
- feedback cards
- video cards (deferred for MVP, but compatible with the model)

### 5.5 Selection and collection model

Every task operates on:

- a task-local card collection
- an optional current selection
- optional task-local raw inputs that can be materialized into cards

This aligns directly with the canvas selection model in `src/components/canvas/canvas.component.ts` and the task inventory section “Shared task model implications” in `docs/20260312-task-list.md`.

---

## 6. Top-level application structure

### 6.1 Shell model

The app shell should have three states:

1. no active task yet -> task picker modal shown
2. active task open -> focused full-screen task view
3. task switch request -> task switcher modal shown over current view

### 6.2 No permanent navigation sidebar

The interview explicitly rejects a permanently visible, space-consuming sidebar as the primary navigation mechanism.

Therefore:

- do not make the main architecture depend on a persistent side rail
- do not keep task creation controls permanently visible
- do not make old task lists consume permanent horizontal space

### 6.3 Task hub modal

The shell must provide a modal that shows:

- all tasks
- active task
- historical tasks
- task type
- last updated time
- short title
- lightweight status summary

This is the canonical place for:

- creating a new task
- switching tasks
- optionally duplicating a task
- optionally seeding a new task from selected cards in another task

### 6.4 Focused task page

Once inside a task, the task occupies the main interface in a single-column, top-to-bottom layout.

Each task page should have consistent sections:

1. task header
2. input area
3. current card collection / selection area
4. generated outputs
5. prompt or structured artifact inspection area
6. reusable actions area

This follows the stakeholder request for a linear, immersive, single-task layout.

---

## 7. Task model and lifecycle

### 7.1 Task types

The system should reduce most task flows into three task classes from `docs/20260312-task-list.md`:

1. `lift` — convert raw input into cards
2. `transform` — generate cards from cards
3. `view` — organize, filter, inspect, select, switch, and hand off cards

### 7.2 Task lifecycle

Each task should support:

- create
- resume
- update inputs
- generate additional outputs
- inspect outputs
- hand off selected cards into another task
- remain stored indefinitely unless explicitly deleted

### 7.3 Task identity

Each task must have:

- stable ID
- task type ID
- user-editable title or generated title
- created timestamp
- updated timestamp
- local persistence key
- current card collection
- current selection state
- task-specific UI state

### 7.4 Task state philosophy

Tasks are never assumed to be “complete” in a hard workflow sense.

Instead, a task is a resumable work container.

This matches the interview direction that all created tasks can effectively be treated as past tasks once they exist.

---

## 8. MVP task set

The first prototype should implement the narrow, high-confidence subset recommended by `docs/20260312-task-list.md`, with one refinement: task switching and task creation are shell capabilities, not content tasks, but they still must ship in the MVP.

### 8.1 MVP lift tasks

1. Capture reference material (`T01`)
2. Write textual inspiration (`T02`) or merge into a generic “add text card” action within the task shell where appropriate
3. Create attribute cards from a library (`T12`)
4. Scan product photos into attribute cards (`T13`)

### 8.2 MVP transform tasks

5. Synthesize prompt card (`T14`)
6. Revise prompt card (`T15`)
7. Stage scene cards (`T16`)
8. Generate product image cards (`T17`)

### 8.3 MVP view and platform capabilities

9. Organize and curate cards (`T03`)
10. Manage API connections (`T20`)
11. Resume prior work (`T21`)
12. Switch between tasks (`T22`)
13. Hand off selected cards to another task (`T11`)

### 8.4 Discovery tasks retained in spec but not required for first build

- Scan references into concept cards (`T04`)
- Visualize cards (`T05`)
- Blend cards (`T06`)
- Generate design concept cards (`T07`)
- Iterate on cards (`T08`)
- Simulate user feedback (`T09`)
- Render cards into imagery (`T10`)

These are still valuable and have strong source implementations in the current canvas app, but they are second-wave tasks after the packaging-focused MVP shell is stable.

---

## 9. Detailed task specifications

This section defines the final product behavior for each task family and explicitly ties them to reference code.

### 9.1 T03 — Organize and curate cards

#### Purpose

Provide the main shared workspace behavior for viewing, selecting, arranging, and curating card collections before running downstream transformations.

#### Source references

- `src/components/canvas/canvas.component.ts`
- `src/components/canvas/pointer.ts`
- `src/components/canvas/layout.ts`
- `src/components/canvas/clipboard.ts`
- `src/components/context-tray/context-tray.component.ts`

#### Required behaviors

- zero, one, or multi-selection
- click to select
- click empty area to deselect
- modifier-based multi-select
- marquee selection
- drag to reposition cards
- maintain z-order
- delete selected cards
- copy/paste compatible card data when feasible
- preserve selection state per task session

#### Product interpretation for new app

The new app does not need to reproduce the full mood-board canvas as the only UI, but it must preserve the core curatorial capabilities:

- selection
- arrangement
- deletion
- inspection
- cross-task handoff of selected cards

For the packaging-oriented MVP, this may be implemented as a simpler card board rather than an infinite canvas, but the canvas behaviors remain the behavioral reference standard.

### 9.2 T01 — Capture reference material

#### Purpose

Let users import inspiration imagery directly into a task.

#### Source references

- `src/components/context-tray/tools/capture.tool.ts`
- `src/components/canvas/canvas.component.ts`
- `src/lib/studio-types.ts`

#### Supported inputs

- file upload
- camera capture
- clipboard paste of images

#### Required outputs

- reference cards containing `image`
- source metadata, such as `source: upload`, `source: camera`, or `source: clipboard`

#### MVP behavior

- support multi-image import
- show lightweight pending previews before commit
- allow removing pending items before commit
- commit imported items into the current task card collection

### 9.3 T02 — Write textual inspiration

#### Purpose

Allow users to add freeform intent, notes, labels, or prompt fragments.

#### Source reference

- `src/components/context-tray/tools/writer.tool.ts`

#### Required behavior

- accept freeform English text
- if the input is very short, it may become a title-only card
- otherwise create a text card with body content

#### Product note

Even though the existing `WriterTool` checks for a configured Gemini key before creating a text card, the new product should not require an API key to create local text cards. Text entry is a local authoring action, not an AI action.

### 9.4 T12 — Create attribute cards from a library

#### Purpose

Allow users to construct prompts through structured packaging-domain choices rather than freeform prompting.

#### Source references

- `src/components/left-panel/left-panel.component.ts`
- `src/components/material-library/shapes.ts`
- `src/components/material-library/materials.ts`
- `src/components/material-library/mechanisms.ts`
- `src/components/material-library/colors.ts`

#### Required library groups

- shapes
- materials
- surface options
- mechanisms
- colors

#### Required behaviors

- filter library items by text
- select and deselect multiple attribute items
- display compatibility hints, especially between materials and surface options
- material selections should influence visible or suggested surface options

#### Output model

The new app should create explicit attribute cards or attribute-trait cards, not just hidden array state.

That is the main product-level shift from the current studio app.

### 9.5 T13 — Scan product photos into attribute cards

#### Purpose

Let users start from existing product photos and infer structured prompt ingredients.

#### Source references

- `src/components/scan-dialog/scan-dialog.component.ts`
- `src/lib/studio-ai.ts` (`runScanAI`)
- `src/components/material-library/*.ts`

#### AI behavior to preserve

The current implementation in `runScanAI` uses Gemini structured JSON output constrained to known library options for:

- shapes
- materials
- mechanisms
- colors

This is the correct product behavior for MVP and should be preserved.

#### Required output

- source photo cards
- suggested attribute cards derived from recognized library values
- source provenance linking inferred attributes back to the scanned photo

### 9.6 T14 — Synthesize prompt card

#### Purpose

Generate a structured prompt artifact from selected attribute cards, optional references, and optional custom instructions.

#### Source references

- `src/lib/studio-ai.ts` (`systemPrompt`, `synthesize`)
- `src/components/center-panel/center-panel.component.ts`
- `src/sdk/xml-editor.ts`

#### Prompt format

The current studio flow outputs XML with explicit sections for:

- subject
- setting
- camera
- lighting
- style / medium
- color / grade

This XML output should remain the default structured prompt format for the packaging-focused MVP.

#### Required behavior

- accept selected attribute cards
- accept scanned reference photo cards
- accept optional custom instructions
- stream output progressively into the UI
- store the full prompt artifact as a prompt card
- keep the prompt editable after generation

#### Prompt preservation requirement

The `systemPrompt` in `src/lib/studio-ai.ts` is a curated prompt asset and should be preserved verbatim or near-verbatim during migration.

### 9.7 T15 — Revise prompt card

#### Purpose

Let the user improve or edit the current prompt without rebuilding from scratch.

#### Source references

- `src/lib/studio-ai.ts` (`revise`)
- `src/components/center-panel/center-panel.component.ts`

#### Required behavior

- accept edit instructions in plain English
- operate on existing prompt card history
- preserve conversational context for revisions
- output an updated prompt card
- clear only the revision input after successful revision, not the underlying prompt

#### Product requirement from interview

This task directly satisfies the explicit requirement for a generic “improve my prompt” capability.

### 9.8 T16 — Stage scene cards

#### Purpose

Turn a base product prompt into scene-specific prompt variants.

#### Source references

- `src/lib/studio-ai.ts` (`takePhoto`)
- `src/components/center-panel/center-panel.component.ts`
- `src/components/material-library/mechanisms.ts` (`genericInteractionOptions`, mechanism `interactionOptions`)

#### Required inputs

- current synthesized prompt card
- freeform scene instruction
- optionally suggested scene presets from selected mechanism interactions

#### Required outputs

- scene cards storing scene-specific prompt artifacts

#### Product note

The current implementation combines scene staging and image generation initiation quite tightly. In the new product model, staging should be explicit as its own transform task state even if the UI lets the user continue directly into rendering.

### 9.9 T17 — Generate product image cards

#### Purpose

Produce render outputs from staged scene cards or prompt cards.

#### Source references

- `src/components/generative-image/generative-image.ts`
- `src/components/design/generate-image-gemini.ts`
- `src/components/photo-gallery/photo-gallery.component.ts`
- `src/lib/studio-ai.ts`

#### Required behavior

- users can trigger repeated generation runs
- generated images persist in the task-local gallery
- image cards retain their source prompt linkage
- right-click save/copy should remain possible by relying on native image rendering

#### Product note

The prompt and the output image are both first-class artifacts. The image should not be stored without source prompt context.

### 9.10 T20 — Manage API connections

#### Purpose

Let users configure and validate their Gemini API key for live AI tasks.

#### Source references

- `src/components/connections/storage.ts`
- `src/components/connections/connections.component.ts`
- `src/components/connections/use-setup-dialog.ts`
- `src/components/connections/test-connections.ts`

#### Required behavior

- store keys locally
- let users update keys at any time
- support explicit connection testing
- expose setup through a modal dialog
- keep key state persistent across refreshes

#### Product note

The interview centers on Gemini. OpenAI remains relevant in the reference apps for some text-generation helpers, but the new product should present Gemini as the required user-facing setup unless a task explicitly uses another provider.

### 9.11 T21 — Resume prior work

#### Purpose

Restore tasks, cards, inputs, and generated assets after refresh or reopen.

#### Source references

- `src/components/connections/storage.ts`
- `src/lib/persistence.ts`
- `src/studio-page.ts`
- `src/canvas-page.ts`

#### Required behavior

- all task state restores locally
- generated images and prompt artifacts persist
- credentials persist locally
- card arrangement or selection state restores where relevant

### 9.12 T22 — Switch between tasks

#### Purpose

Move between multiple tasks while preserving context for each.

#### Source basis

This is mandated by the interview and not yet fully realized in the current codebase.

#### Required behavior

- open task switcher modal from anywhere
- show all tasks as resumable entries
- switch without discarding current task state
- allow creating a new task from current task context or from scratch

### 9.13 T11 — Hand off selected cards to another task

#### Purpose

Allow cross-task composition without format translation.

#### Source references

- `src/components/context-tray/tools/export.tool.ts`
- `src/studio-page.ts` (`fromCanvasBlob` import flow)

#### Required behavior

- selected cards from one task can seed another task
- transfer should carry card data and lightweight metadata
- destination task should interpret cards in its own task model without destructive conversion

#### Product-level upgrade

The current blob URL handoff is a useful prototype reference, but the new app should treat handoff as an internal task-to-task operation rather than a page-to-page hack.

### 9.14 Discovery tasks retained for phase two

The following should remain explicitly documented because they already exist in the reference apps and may become presets or subtypes later:

- conceptual scan: `src/components/context-tray/tools/conceptual-scan.tool.ts`, `src/components/context-tray/llm/scan-concepts.ts`
- visualize: `src/components/context-tray/tools/visualize.tool.ts`, `src/components/context-tray/llm/visualize-concept.ts`
- blend: `src/components/context-tray/tools/blend.tool.ts`, `src/components/context-tray/llm/blend-images.ts`
- generate design concepts: `src/components/context-tray/tools/design.tool.ts`, `src/components/context-tray/llm/design-concepts.ts`
- iterate: `src/components/context-tray/tools/iterate.tool.ts`
- simulate user feedback: `src/components/context-tray/tools/user-testing.tool.ts`, `src/components/context-tray/llm/synthetic-users.ts`
- generic render from board context: `src/components/context-tray/tools/render.tool.ts`

These tasks should inform the extensible task system design now, even if they are not all built in the first round.

---

## 10. Shared interaction patterns

### 10.1 Input pattern

Every task should expose raw input using intrinsic HTML controls:

- `textarea` for instructions and prompt edits
- `input type="search"` for filtering
- `input type="file"` for image uploads
- `dialog` for modal flows
- native buttons for actions

### 10.2 Copy pattern

Any prompt-bearing output should have the same copy interaction pattern across the app.

Preferred behavior:

- prompt text remains selectable in a normal text field or editor
- if a copy button exists, it should use the same placement and label everywhere
- avoid bespoke copy interactions per task

### 10.3 Download / export pattern

- images should be rendered as plain images so browser save/copy behavior works naturally
- text should remain selectable
- only add custom export UI when clearly necessary

### 10.4 Modal pattern

Use modal dialogs for:

- task creation
- task switching
- API setup
- optional advanced inspect or edit flows

Do not overuse modals inside normal task work unless they meaningfully protect focus.

---

## 11. AI and prompt strategy

### 11.1 Provider strategy

The interview says Gemini is the core user-provided runtime provider.

Current reference apps use:

- Gemini for product scan, synthesis, revision, image generation, and other live generation paths
- OpenAI in some legacy or auxiliary paths such as structured text generation in older or supporting features

For the new product:

- Gemini should be the primary runtime dependency for user-facing MVP tasks
- OpenAI-backed helpers may remain internal only if already required by existing features being migrated, but should not complicate the user mental model

### 11.2 Streaming and structure

Structured streaming is a core requirement, not a nice-to-have.

The product should preserve the reference approach already present in:

- `src/lib/studio-ai.ts`
- `src/components/context-tray/llm/scan-concepts.ts`
- `src/components/context-tray/llm/design-concepts.ts`
- `src/components/context-tray/llm/synthetic-users.ts`
- `src/components/context-tray/llm/visualize-concept.ts`

Implementation requirements:

- use structured response schemas when possible
- parse streaming JSON incrementally
- surface partial outputs early
- retain final canonical output in task state

### 11.3 Prompt asset preservation

The following prompt-bearing source files are curated assets and must be preserved as close to verbatim as possible when migrated:

- `src/lib/studio-ai.ts` (`systemPrompt`, scan prompt text, scene prompt text)
- `src/components/context-tray/llm/design-concepts.ts`
- `src/components/context-tray/llm/scan-concepts.ts`
- `src/components/context-tray/llm/synthetic-users.ts`
- `src/components/context-tray/llm/visualize-concept.ts`
- `src/components/design/generate-designs.ts`

### 11.4 English-only language model UX

The interview explicitly says to keep the product in English.

Therefore:

- prompts
- labels
- task templates
- placeholder text
- revision instructions

should all assume English for the prototype.

---

## 12. Persistence and shareability

### 12.1 Local persistence

Local persistence is mandatory.

Current persistence references:

- `src/components/connections/storage.ts`
- `src/lib/persistence.ts`

The new app should persist at least:

- task list
- active task ID
- task-local card collections
- task-local raw inputs
- prompt outputs
- generated assets
- selection state where useful
- connection settings

### 12.2 Storage model

Use IndexedDB for durable task and asset state.

`localStorage` may still be used for lightweight settings or compatibility, but core task state should live in IndexedDB.

### 12.3 Shareable URL state

The interview expresses a desire to share prompt state by URL when feasible, but not heavyweight assets.

Therefore the prototype should adopt this product rule:

- shareable URLs may encode task configuration and prompt state
- generated images, uploaded images, and other large assets should not be embedded in the URL
- URL sharing is secondary to local persistence for MVP

If URL state is not built in round one, the architecture must still keep task state serializable enough that it can be added later.

---

## 13. Error handling, concurrency, and retry behavior

### 13.1 Universal error principle

Errors must be visible, non-destructive, and retryable.

### 13.2 Required UX behavior

- never clear user input because a generation failed
- never auto-retry without explicit user intent
- always show the user that an error happened
- preserve partial results when available
- keep the task resumable

### 13.3 Error presentation

The interview asks for one generic error presentation solution, preferably a toast or bubble.

For the prototype:

- use one app-wide lightweight toast/error notice pattern
- optionally also show task-local inline status when the failure is tightly tied to a specific output block

### 13.4 Concurrency model

The product should let users submit multiple runs.

That means:

- do not treat “in progress” as a full-screen lock state
- do not disable unrelated actions when one run is active
- allow additive result generation
- model generation jobs as independent task outputs when appropriate

This is already conceptually aligned with RxJS-driven additive flows in `src/components/context-tray/tasks.ts` and the studio scan pipeline in `src/studio-page.ts`.

---

## 14. Accessibility and visual design constraints

### 14.1 Accessibility

The product should achieve accessibility primarily through intrinsic web features.

This means:

- semantic HTML
- real buttons
- real form fields
- `dialog` for modal semantics
- keyboard-reachable controls
- light DOM rendering

### 14.2 Layout

Per the visual instructions and interview:

- single-column task layout
- clamp task content width to roughly 90rem
- top-to-bottom sections
- minimal padding
- parent-managed spacing
- monospace aesthetics
- 14px main text sizing

### 14.3 Styling constraints

- light theme
- monochrome palette
- avoid decorative borders
- use spacing over ornament
- no emoji
- no gratuitous icons

### 14.4 Web component and DOM strategy

The interview explicitly requires:

- TypeScript
- Web Component style organization when needed
- no React
- no shadow DOM
- flat, light DOM rendering

The current codebase already uses `createComponent` plus lit-html reactive rendering in light DOM. That pattern should remain the foundation.

---

## 15. Technical architecture constraints

### 15.1 Stack

The implementation must use:

- TypeScript
- Vite
- RxJS
- lit-html
- intrinsic HTML
- IndexedDB

The implementation must not depend on React.

### 15.2 File organization philosophy

The interview and repo instructions align on a top-down organization style:

- constants and orchestrators first
- lower-level helpers later
- pure functions near the bottom

This matches `.github/copilot-instructions.md`.

### 15.3 Reactive behavior

Use RxJS to handle:

- streaming outputs
- multiple concurrent runs
- non-destructive retries
- cancellation and stop behavior where needed
- UI reactivity without imperative sprawl

### 15.4 Component model

Continue using:

- `src/sdk/create-component.ts`
- `src/sdk/observe-directive.ts`

for reactive, light-DOM component composition.

### 15.5 Testing

The interview explicitly requires test-driven development with Vitest.

Therefore the final implementation plan must include:

- granular unit tests for pure helpers
- tests for task-state reducers or transformations
- tests for prompt templating helpers
- tests for card conversion and handoff logic
- tests for persistence serialization

---

## 16. Reference asset inventory to preserve

The following assets are domain-critical and should be reused rather than reinvented.

### 16.1 Packaging taxonomy assets

- `src/components/material-library/shapes.ts`
- `src/components/material-library/materials.ts`
- `src/components/material-library/mechanisms.ts`
- `src/components/material-library/colors.ts`

These files already encode domain semantics for:

- shape names and descriptions
- material visuals, haptics, acoustics, and finish compatibility
- closure and dispensing mechanism interactions
- color options

### 16.2 Visual library assets

- `src/assets/library/index.ts`

This contains image-backed library items for shape, cap, material, and surface references.

These asset URLs and descriptions should be treated as reusable design-system content for future structured selection tasks and visual guidance.

### 16.3 Existing prompt assets

Preserve prompt texts from:

- `src/lib/studio-ai.ts`
- `src/components/context-tray/llm/*.ts`
- `src/components/design/generate-designs.ts`

---

## 17. Deferred work

The following features are valid but deferred for the first prototype unless stakeholder priorities change.

### 17.1 Deferred task flows

- product animation / video generation
- editing an existing generated output and re-running from that output card
- full discovery suite from the canvas app as first-class tasks

### 17.2 Existing source references for deferred features

- `src/lib/studio-ai.ts` (`generateAnimation`, `generateEdit`)
- `src/components/generative-video/*`
- `src/components/photo-gallery/photo-gallery.component.ts`

These should remain architecturally compatible with the shared card model but do not need first-pass implementation.

---

## 18. Open questions resolved for prototype

This section intentionally resolves ambiguous items from the task inventory for the first implementation round.

### 18.1 Is the canvas the main app?

No.

The infinite canvas is a behavioral reference for card organization and ideation tasks, but the new product shell should be task-centric and modal-driven, not canvas-first.

### 18.2 Are T16 and T17 one task or two?

They are two conceptual transforms:

- `Stage scene cards`
- `Generate product image cards`

But the MVP UI may present them as one continuous task page with two consecutive sections.

### 18.3 Are T04-T10 separate tasks or presets?

For the prototype architecture, they should be modeled as distinct task definitions that can later be grouped under a broader “transform cards” family.

This preserves clarity while still allowing future consolidation.

### 18.4 Must URL sharing ship in round one?

No.

But task state must be serializable enough that URL-based sharing of prompt/input state can be added later.

### 18.5 Which prompts must be preserved verbatim?

At minimum, preserve wording from:

- `src/lib/studio-ai.ts`
- `src/components/context-tray/llm/design-concepts.ts`
- `src/components/context-tray/llm/scan-concepts.ts`
- `src/components/context-tray/llm/synthetic-users.ts`
- `src/components/context-tray/llm/visualize-concept.ts`
- `src/components/design/generate-designs.ts`

---

## 19. Developer handoff checklist

Before implementation starts, the developer should confirm that the new app design satisfies all of the following:

- [ ] One focused task fills the screen at a time.
- [ ] Task creation uses a modal.
- [ ] Task switching uses a modal.
- [ ] Multiple tasks are persisted and resumable.
- [ ] The shared card model is implemented and used across tasks.
- [ ] Packaging-domain attribute libraries are reused from existing source files.
- [ ] Existing prompt texts are preserved from source wherever possible.
- [ ] Prompt outputs remain inspectable and copyable.
- [ ] Errors are visible, non-destructive, and retryable.
- [ ] Users can run multiple generations without destructive blocking.
- [ ] Local persistence covers inputs, outputs, and credentials.
- [ ] The app uses TypeScript, RxJS, lit-html, Vite, and intrinsic HTML.
- [ ] The MVP focuses first on the packaging-oriented guided prompt builder flow.
- [ ] Deferred canvas-discovery tasks remain compatible with the architecture.

---

## 20. Final product summary

The new playground app should be a locally persistent, task-centric, packaging-focused prompt builder and runner.

Its MVP is not “all current demos combined visually.”

Instead, it is a coherent shell that:

1. uses a shared card model
2. lets users start and switch tasks through modals
3. supports structured packaging prompt assembly from domain libraries and scanned references
4. exposes prompt artifacts clearly
5. generates images live with the user’s Gemini key
6. preserves all in-progress work locally
7. stays visually minimal, accessible, and implementation-friendly

The current canvas and studio apps are reference implementations and prompt asset repositories. The new app should unify their strongest behaviors, but the new product experience should follow the interview’s task-centric shell, not the old page boundaries.
