<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Refine Card Text

After the Sketch tool (edit_image action) produces an edited image, compare the original and edited images and write a new title and body for the result card. The instruction is sent first, then a caption text part followed by the original image, then a caption text part followed by the edited image. The response is requested as application/json without a schema.

- **Template:** `src/prompt-templates/canvas-refine-card-text.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/canvas/ai-helpers.ts`, `src/lib/actions/defs/generate.ts`, `src/components/context-tray/tools/sketch.tool.ts`
- **Categories:** canvas, mixed-to-json, card-text-refinement

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `oldTitle` | text | no | no | Title of the source card whose image was edited (empty string if none). |
| `oldBody` | text | no | no | Body text of the source card whose image was edited (empty string if none). |
| `hasOldImage` | boolean | no | no | Whether the original (pre-edit) image loaded. If so, its caption text part is sent, followed by the image part. Defaults to true. |
| `hasNewImage` | boolean | no | no | Whether the edited image loaded. If so, its caption text part is sent, followed by the image part. Defaults to true. |

## Example: Shampoo Cap Recolor

Rewrite a shampoo card after a sketch changed the cap to a brushed copper finish.

### User

```text
You are an AI assistant helping to refine a card's content after an image modification.
We modified an original image based on user drawing and feedback to produce a refined image.
Original Card Title: "Eucalyptus Repair"
Original Card Body: "A rounded shampoo bottle with a warm white matte body and eucalyptus green cap, built for a calm spa-like shelf presence."

We will show you the original (old) image and the refined (new) image.
Please analyze the differences and generate a new title and a new body text that match the refined image while preserving the style and context of the original card.

Your output must be a JSON object with two fields:
- "title": a short, catchy title (max 4 words)
- "body": a concise, compelling description (1-2 sentences)

Return ONLY the JSON object. Do not include any other text or markdown formatting.
Example: {"title": "...", "body": "..."}

This is the original (old) image before modification.

This is the refined (new) image after modification.
```

## Presets

- **Shampoo Cap Recolor** — Rewrite a shampoo card after a sketch changed the cap to a brushed copper finish.
- **Mouthwash Dosage Cap Edit** — Refresh a mouthwash card after the sketch added measurement ridges to the dosage cap.
- **Refill Pouch Window** — Update a refill pouch card after the sketch enlarged the translucent product window.
