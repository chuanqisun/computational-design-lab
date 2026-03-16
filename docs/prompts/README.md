# Prompt Inventory

This folder indexes the LLM prompt surfaces reachable from the canvas and studio page workflows.

The reusable prompt template modules live in `src/prompt-templates`.

## Canvas

| Template | Source | Input -> Output | Notes |
| --- | --- | --- | --- |
| `canvas-caption-from-image.ts` | `src/components/canvas/ai-helpers.ts` | image -> text | Short captioning for pasted or referenced images |
| `canvas-enhance-image-prompt.ts` | `src/components/canvas/ai-helpers.ts`, `src/components/canvas/canvas.component.ts` | text -> text | Rewrites user prompts before regeneration |
| `canvas-fill-card.ts` | `src/components/canvas/ai-helpers.ts` | mixed -> json | Fills missing title/body/image prompt slots |
| `canvas-design-concepts.ts` | `src/components/context-tray/llm/design-concepts.ts` | mixed -> json | Generates design concepts plus render prompts |
| `canvas-generate-image-prompt.ts` | `src/components/context-tray/llm/generate-image-prompt-gemini.ts` | text -> text | Converts text into a richer image prompt |
| `canvas-generate-definition.ts` | `src/components/context-tray/llm/generate-definition-gemini.ts` | text -> text | Defines terms or phrases |
| `canvas-generate-title-gemini.ts` | `src/components/context-tray/llm/generate-title-gemini.ts` | text -> text | Gemini title summarizer |
| `canvas-generate-title-openai.ts` | `src/components/context-tray/llm/generate-title-openai.ts` | text -> text | OpenAI title summarizer |
| `canvas-scan-moods.ts` | `src/components/context-tray/llm/scan-moods.ts` | mixed -> json | Unsupervised mood scan |
| `canvas-scan-moods-supervised.ts` | `src/components/context-tray/llm/scan-moods.ts` | mixed -> json | Mood scoring against required mood labels |
| `canvas-scan-concepts.ts` | `src/components/context-tray/llm/scan-concepts.ts` | mixed -> json | Distills concepts from selected items |
| `canvas-generate-personas.ts` | `src/components/context-tray/llm/synthetic-users.ts` | text -> json | Generates synthetic users |
| `canvas-rank-designs.ts` | `src/components/context-tray/llm/synthetic-users.ts` | mixed -> json | Persona-based design ranking |
| `canvas-visualize-concept.ts` | `src/components/context-tray/llm/visualize-concept.ts` | text -> json | Creates up to three render prompts |
| `canvas-blend-images.ts` | `src/components/context-tray/llm/blend-images.ts` | mixed -> image | Raw instruction plus image/text references |

## Studio

| Template | Source | Input -> Output | Notes |
| --- | --- | --- | --- |
| `studio-scan-product-features.ts` | `src/lib/studio-ai.ts`, `src/studio-page.ts` | image -> json | Extracts shapes, materials, mechanisms, colors |
| `studio-synthesize-scene-xml.ts` | `src/lib/studio-ai.ts`, `src/studio-page.ts` | mixed -> xml | Main product scene synthesis prompt |
| `studio-revise-scene-xml.ts` | `src/lib/studio-ai.ts`, `src/studio-page.ts` | text -> xml | Revises prior XML using conversation history |
| `studio-stage-photo-scene.ts` | `src/lib/studio-ai.ts`, `src/studio-page.ts` | text -> xml | Re-stages product XML into a photo scene |
| `studio-generate-sound-description.ts` | `src/lib/studio-ai.ts` | mixed -> text | Creates sound cues for animation prompts |
| `studio-import-canvas-instructions.ts` | `src/studio-page.ts` | text -> text | Converts imported canvas text into studio guidance |

## Coverage notes

- Direct generative-image and generative-video elements are included only when a dedicated LLM-authored prompt exists upstream.
- `generateAnimation` and `generateEdit` in studio currently pass through user-authored text or XML instead of creating a new LLM prompt template.
- Prompt modules default to relaxed metadata: most text slots are optional and allow multiple values unless the runtime flow requires a single value.