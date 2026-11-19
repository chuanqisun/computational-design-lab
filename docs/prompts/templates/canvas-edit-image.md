<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Edit Image

Edit a card's image with the image model (Sketch tool / edit_image action). The image is sent first: the Sketch tool's flattened drawing, or for agent calls the source image with labeled regions drawn on it (or the plain source image). The instruction follows as a single text part.

- **Template:** `src/prompt-templates/canvas-edit-image.ts`
- **Model:** `gemini-nano-banana-2.1`
- **Input → output:** mixed → image
- **Sources:** `src/components/semantic-scan/image-to-image.ts`, `src/lib/actions/defs/generate.ts`, `src/components/context-tray/tools/sketch.tool.ts`
- **Categories:** canvas, mixed-to-image, image-editing

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `instruction` | text | no | no | Edit feedback typed in the Sketch dialog (or the agent's instruction argument), trimmed. When empty the edit_image action falls back to "Apply the changes indicated by the sketch annotations on this image". |

## Example: Shampoo Cap Material Swap

Sketch circles the cap of a shampoo bottle render and asks for a new finish.

### User

```text
Change the circled cap to brushed copper and keep the warm white matte bottle body unchanged.
```

## Presets

- **Shampoo Cap Material Swap** — Sketch circles the cap of a shampoo bottle render and asks for a new finish.
- **Mouthwash Dosage Ridges** — Sketch marks the dosage cap of a mouthwash bottle for added measurement ridges.
- **Refill Pouch Sketch Only** — No typed feedback, so the default instruction asks the model to follow the drawn annotations.
