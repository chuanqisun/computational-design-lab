<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Rank Designs As Persona

Rank the selected design cards (text plus attached images) from a persona's perspective against a target trait and return ordered IDs with brief feedback.

- **Template:** `src/prompt-templates/canvas-rank-designs.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/context-tray/llm/synthetic-users.ts`, `src/lib/actions/defs/media.ts`
- **Categories:** canvas, mixed-to-json, ranking

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `personaName` | text | yes | no | Persona name, used in the system instruction. |
| `personaAge` | number | yes | no | Persona age, used in the system instruction. |
| `personaOccupation` | text | yes | no | Persona occupation, used in the system instruction. |
| `personaDescription` | text | yes | no | Persona description, used in the system instruction. |
| `trait` | text | yes | no | Trait used for ranking the designs. |
| `designSummaries` | text | no | yes | One line per design, formatted as `Design N (id: <id>): "<title>" — <body>`. The design count is derived from this list. Design images are attached as separate image parts after the text. |

## Example: Ingredient-Driven Ranking

Rank shampoo concepts for an ingredient-conscious shopper.

### System instruction

```text
You are Maya Chen, 34 years old, product designer. She shops for shampoo based on ingredient transparency, calm aesthetics, and whether the pack looks credible in a premium bathroom.
```

### User

```text
Here are 3 design concepts:

Design 1 (id: A1): "Matte Eucalyptus" — Rounded matte shampoo bottle with eucalyptus green cap and minimal recessed label.

Design 2 (id: B2): "Gloss Botanica" — Glossy shampoo bottle with high-contrast botanical graphics and metallic cap.

Design 3 (id: C3): "Refill Duo" — Refill pouch plus reusable countertop bottle system with soft neutral labeling.

Rank these designs from least to most "premium" based on your personal perspective. Return all 3 item IDs in order from least premium (first) to most premium (last). Also write 1-2 sentences of feedback explaining your ranking.
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "rankedItemIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "feedback": {
      "type": "string"
    }
  },
  "required": [
    "rankedItemIds",
    "feedback"
  ]
}
```

## Presets

- **Ingredient-Driven Ranking** — Rank shampoo concepts for an ingredient-conscious shopper.
- **Clinical Trust Ranking** — Rank mouthwash concepts for a trust-seeking oral care buyer.
- **Sustainability Ranking** — Rank refill concepts for eco-oriented packaging users.
