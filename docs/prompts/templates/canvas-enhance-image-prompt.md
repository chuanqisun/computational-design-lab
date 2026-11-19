<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Enhance Image Prompt

Rewrite a card's image prompt (or a user-supplied prompt) into a higher quality image-generation prompt before re-rendering the card's image.

- **Template:** `src/prompt-templates/canvas-enhance-image-prompt.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → text
- **Sources:** `src/components/canvas/ai-helpers.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, text-to-text, prompt-optimization

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `originalPrompt` | text | yes | no | Prompt passed to regenerate_image, or the card's stored image prompt. |
| `cardContext` | text | yes | no | Context string. The only current caller (regenerate_image) always passes the literal "User regeneration request". |

## Example: Shampoo Hero Upgrade

Rewrite a basic shampoo render prompt into a stronger commercial brief.

### User

```text
You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image. 
      
      Original prompt: 'A shampoo bottle on a white background'
      Context from card: 'User regeneration request'
      
      Keep it descriptive but concise. Return ONLY the enhanced prompt.
```

## Presets

- **Shampoo Hero Upgrade** — Rewrite a basic shampoo render prompt into a stronger commercial brief.
- **Mouthwash Clarity Upgrade** — Improve a mouthwash prompt for transparency and clinical polish.
- **Refill Editorial Upgrade** — Sharpen a refill pouch prompt into an editorial sustainability render.
