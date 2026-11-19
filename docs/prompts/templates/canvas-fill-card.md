<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Fill Card Fields

Fill missing canvas card fields (title, body, image prompt) from the card's available text plus its attached image or video, if any. The response schema is built per request from only the missing fields; outputSchema shows the case where all three are missing.

- **Template:** `src/prompt-templates/canvas-fill-card.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/canvas/ai-helpers.ts`, `src/lib/actions/card-fill.ts`
- **Categories:** canvas, mixed-to-json, field-completion

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `title` | text | no | no | Existing card title, if any. |
| `body` | text | no | yes | Existing card body content. |
| `imagePrompt` | text | no | yes | Existing image prompt text. |

## Example: Missing Title

Complete a shampoo concept card missing its title.

### User

```text
I have a card with the following content:
Title: (missing)
Body: A rounded shampoo bottle inspired by eucalyptus leaves and smooth river stones.
The pack should feel restorative, quiet, and premium without leaning overly clinical.
Image Prompt: Studio render of a warm white matte shampoo bottle with a eucalyptus green cap.

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image or video is provided, generate a detailed image generation prompt.
- If image or video is provided, use it to generate the missing text fields.
- Never generate or return video content.

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string"
    },
    "body": {
      "type": "string"
    },
    "imagePrompt": {
      "type": "string"
    }
  },
  "required": [
    "title",
    "body",
    "imagePrompt"
  ]
}
```

## Presets

- **Missing Title** — Complete a shampoo concept card missing its title.
- **Missing Body** — Fill in descriptive copy for a mouthwash design card.
- **Missing Image Prompt** — Generate a missing image prompt from card text for a refill concept.
