---
applyTo: "**/main-page.ts"
---

# System Architecture

A pipeline for mood board based prodcut designs generation.

## Workflow

A Human-AI co-iterative loop. Non-linear progression. End with product requirements documentation (PRD)

| Step          | Human                     | AI                                                     |
| ------------- | ------------------------- | ------------------------------------------------------ |
| Parti         | Write down one "big idea" | Suggest alternatives                                   |
| Conceptualize | Explore related concepts  | Suggest and define concepts                            |
| Visualize     | Steer AI with preference  | Generate artifacts while adhering to latest preference |
| Parameterize  | Provide domain knowledge  | Suggest aspects of product decision making             |
| Design        | Steer AI with preference  | Assign values to produce design decisions              |

## Flow control

- Make sure each step only responds to explicit user action within the step

## Model access

- Gemini only (no OpenAI). Model IDs live in `src/lib/gemini-models.ts`.
- Text gen: `GEMINI_TEXT_MODEL` via `streamGeminiText` / `generateGeminiText` in `src/lib/gemini-text.ts`
- Image gen: `GEMINI_IMAGE_MODEL` (via `<generative-image>` / `generate-image-gemini.ts`)

## Gemini docs

See `src/components/connections/gemini.instructions.md` for Gemini docs.
