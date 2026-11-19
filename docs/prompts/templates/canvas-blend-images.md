<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Blend Images

Blend two or more canvas cards into a single generated image: the instruction is sent first, followed by each card's image and body text as separate parts.

- **Template:** `src/prompt-templates/canvas-blend-images.ts`
- **Model:** `gemini-nano-banana-2.1`
- **Input → output:** mixed → image
- **Sources:** `src/components/context-tray/llm/blend-images.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, mixed-to-image, image-blending

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `instruction` | text | yes | yes | Blend instruction from the user (sent as the first text part). |
| `itemBodies` | text | no | yes | Body text of each selected card, sent verbatim as its own text part after that card's image (cards without body text send only their image). |

## Example: Shampoo Botanical Merge

Blend a hero bottle render with botanical references for a natural care concept.

### User

```text
Blend the uploaded shampoo bottle render with the botanical reference image into one cohesive hero shot.
Keep the bottle silhouette readable and let eucalyptus leaves influence only the supporting composition.

Rounded shampoo bottle with a matte off-white body and eucalyptus green cap.

Dewy eucalyptus leaves on a pale stone surface with soft morning light.
```

## Presets

- **Shampoo Botanical Merge** — Blend a hero bottle render with botanical references for a natural care concept.
- **Mouthwash Clinical Fusion** — Combine a mouthwash packshot with clean bathroom material cues.
- **Refill Pouch Editorial Composite** — Merge a refill pouch concept with sustainability cues for a calm editorial image.
