# 2026-03-12 Product Design Spec For The Prompt Template Playground

## 1. Product summary

The app is a prompt templating system.

Users do not build workflows, manage task graphs, or generate media inside the app.

They do one simple thing:

1. select a task-specific prompt template
2. fill in the template variables
3. copy the final generated prompt text
4. paste that prompt into another system

That is the whole product.

---

## 2. Core product definition

### 2.1 What the app is

The app is a guided prompt-writing tool for designers who are not comfortable writing prompts from scratch.

It helps them complete structured prompt templates using plain form inputs.

### 2.2 What the app is not

The app is not:

- a canvas
- a multi-step studio workflow
- a task container system
- an AI generation runtime
- an image generation app
- a card-based ideation tool
- a prompt streaming environment

### 2.3 Primary job to be done

Help a user turn a known design task into a finished prompt by filling in template slots.

---

## 3. User flow

The product flow should stay extremely small.

1. user opens the app
2. user selects a template for a task
3. app shows the template title, description, and variable slots
4. user fills in text slots and image slots
5. app renders the final prompt in real time
6. user copies the final prompt text

Optional secondary actions:

- clear all slot values
- duplicate a template into a custom working copy later if needed
- save local draft state so refresh does not wipe the form

---

## 4. Task model

The word “task” now means only this:

> a template for a specific prompt-writing job

Examples:

- packaging concept prompt
- packaging photo staging prompt
- reference analysis prompt
- prompt revision prompt

Tasks are not long-running entities.
They are just named prompt templates.

---

## 5. Template model

Each template should include at minimum:

- `id`
- `title`
- `description`
- `promptTemplate`
- `slots`

### 5.1 `promptTemplate`

The prompt template is plain text with variable placeholders.

Example shape:

`Design a ${productType} for ${brandContext}. Use ${material}. Reference image ${referenceImageName}.`

### 5.2 `slots`

Each slot defines a variable the user can fill in.

Each slot should include at minimum:

- `id`
- `label`
- `type`
- `required`
- `placeholder`
- `helpText`

Supported slot types for MVP:

- `text`
- `longText`
- `image`

### 5.3 Slot cardinality rules

Slot definitions must explicitly declare whether they accept one value or many values.

Each slot should include a cardinality field such as:

- `single`
- `multiple`

Default product rule:

- most slots should be `multiple`
- a slot should only be `single` when the task genuinely requires one value

This is important because most prompt-writing tasks benefit from collecting several items per slot, not one.

Examples of slots that should usually support multiple values:

- references
- materials
- colors
- adjectives
- visual cues
- constraints
- inspiration notes
- composition ideas
- target audiences
- image references

Examples of slots that may reasonably stay single when the task demands it:

- product type
- primary brand name
- output language
- aspect ratio
- a required hero object when the template is specifically about one subject

### 5.4 Multi-value slot behavior

When a slot is `multiple`, the interface should let users add, remove, and reorder items in that slot.

Required behavior for multi-value slots:

- start with one empty item row when appropriate
- allow adding another item with a clear action
- allow removing any item
- preserve entered order
- treat each item as an intentional separate entry
- render the final prompt using all provided items

The app should not force users to manually format comma-separated values inside one text field when the slot is intended to support multiple items.

Instead, multi-value structure should be explicit in the UI and explicit in the template resolution logic.

### 5.5 Template writing rule for plural-friendly output

Templates must be authored to handle plural values elegantly.

That means the final prompt should still read naturally when a slot contains:

- one item
- two items
- several items

Template authors should avoid writing templates that only read correctly for exactly one value unless the slot is intentionally `single`.

Examples:

Good plural-friendly phrasing:

- `Use these material cues: ${materials}.`
- `Incorporate the following reference images: ${referenceImages}.`
- `Reflect these brand traits: ${brandTraits}.`

Less robust phrasing to avoid for multi-value slots:

- `Use material ${materials}.`
- `Match the reference image ${referenceImages}.`

### 5.6 Multi-value formatting rules

The template system should define one consistent text formatting strategy for multi-value slots.

At minimum, multi-value text rendering should support natural language joining such as:

- one item -> `glass`
- two items -> `glass and brushed aluminum`
- three or more items -> `glass, brushed aluminum, and matte plastic`

For some templates, newline or bullet-style formatting may be more appropriate than inline joining.

Therefore each slot should also be able to specify a preferred output format such as:

- `inline-list`
- `newline-list`
- `bulleted-list`

The chosen format must be part of the slot definition, not improvised ad hoc in the UI.

### 5.7 Empty value rules

Template behavior must be clear when slots are partially or fully empty.

Required rules:

- required slots must be visually marked
- optional slots may be left empty
- empty optional slots should resolve cleanly without leaving broken placeholder text
- the final prompt should not contain unresolved variable markers
- the final prompt should not contain awkward leftover punctuation caused by missing optional values

This means template design must consider omission cases up front.

### 5.8 Singular slots must be intentional

If a slot is `single`, that should be a deliberate template-level decision.

Do not use single-value slots merely because they are easier to implement.

A slot should be singular only when multiple values would weaken, confuse, or contradict the task itself.

---

## 6. Image slot rules

Images are not directly executable inside the final output.
They are reference inputs for the user.

If a template includes an image slot, the user must be able to:

1. upload or paste an image
2. assign a human-readable name to that image

Example:

- uploaded image file: bottle-photo.png
- user-entered image name: `Reference Bottle A`

The generated prompt should reference the image by that user-provided name in text.

Example output:

`Use Reference Bottle A as the primary silhouette reference.`

### 6.1 Required behavior for image slots

- image slots must support local image selection
- each image slot must also include a text field for the image name
- the final prompt must only contain text
- the final prompt should never depend on binary image embedding
- if no image name is provided, the app should use a simple fallback such as `Reference Image 1`

### 6.2 Multi-image slot rules

Image slots should also follow the default cardinality rule.

That means image slots should usually support multiple image entries unless the template truly requires exactly one image reference.

Each image entry should include:

- the local image file or pasted image
- a user-provided image name
- optional helper text if the template needs the user to describe what the image contributes

For multi-image slots, the interface should let users:

- add another image entry
- remove an image entry
- reorder image entries

The final prompt must refer to the image names in a natural plural-aware way.

Example:

- one image -> `Use Reference Bottle A as the silhouette reference.`
- two images -> `Use Reference Bottle A and Cap Detail B as reference images.`
- several images -> `Use Reference Bottle A, Cap Detail B, and Surface Finish C as reference images.`

### 6.3 Image naming rules

Image names are part of prompt authoring, not just file metadata.

Required behavior:

- every image item should have a name field near the file input
- users should be encouraged to provide meaningful names
- fallback names should be generated only when the user leaves the field blank
- fallback names should be stable and readable, such as `Reference Image 1`, `Reference Image 2`, and so on
- the template should resolve using the image names, never raw filenames, unless the user intentionally enters that filename as the name

---

## 7. Output model

The only required output is a copiable text prompt.

Requirements:

- render final prompt as normal selectable text
- provide a single clear copy action
- update output immediately when slot values change
- preserve line breaks and template structure

The app does not need to:

- call Gemini
- call OpenAI
- stream outputs
- validate prompts with a model
- generate images
- generate videos

---

## 8. Interface requirements

The interface should be minimal and linear.

### 8.1 Main layout

Use a simple single-column layout with three sections:

1. template picker
2. slot form
3. final prompt output

### 8.2 Template picker

The template picker should show:

- template title
- short description
- maybe a lightweight category label

### 8.3 Slot form

Use intrinsic HTML controls:

- `select` or button list for template selection
- `input type="text"` for short text slots
- `textarea` for long text slots
- `input type="file"` for image slots
- `input type="text"` for image names

### 8.4 Output area

The output area should:

- show the fully resolved prompt
- allow direct text selection
- include one copy button

---

## 9. Persistence

Persistence can be lightweight.

The app should store locally:

- last selected template
- current slot values
- uploaded image references if practical
- image names

Refresh should not wipe the current working state.

This can use existing local persistence mechanisms already in the repo.

---

## 10. Architecture constraints

The implementation should still use the repo’s existing technical stack:

- TypeScript
- Vite
- RxJS where useful
- lit-html
- intrinsic HTML

But the product behavior should remain simple.

Do not build unnecessary orchestration layers.
Do not preserve older task or canvas complexity unless needed for basic template editing.

---

## 11. Scope guidance

### 11.1 In scope

- task-specific prompt templates
- variable slot rendering
- single-value and multi-value slot handling
- text slot editing
- image upload or paste
- image naming
- text-only prompt generation
- copy-to-clipboard
- local draft persistence

### 11.2 Out of scope

- AI model execution
- prompt streaming
- card systems
- canvas interactions
- task switching architecture
- modal-driven workflow systems
- generation histories
- scene staging pipelines
- library-to-card transformations
- prompt revision with live models
- image generation galleries

---

## 12. Final implementation rule

If there is a choice between preserving old architecture and making the new template flow simpler, choose the simpler template flow.

The app should feel like a structured prompt form, not like a creative workstation.
