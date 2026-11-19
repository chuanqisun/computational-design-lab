<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Rate Scan Lenses

Gemini Decisions API (ai.decisions.create) call, not a chat prompt: one `choice` question whose options are the Scan lenses, evaluated against the selected cards. The lenses compete for probability mass, and the returned per-lens probabilities drive the Scan tool's meter bars (lengths are relative to the top lens). Rendered here as the question instructions, one `key: description` line per option, then the card text input parts.

- **Template:** `src/prompt-templates/canvas-rate-lenses.ts`
- **Model:** `gemini-decision-1`
- **Input → output:** mixed → json
- **Sources:** `src/components/context-tray/llm/rate-lenses.ts`, `src/lib/actions/defs/generate.ts`, `src/components/context-tray/tools/conceptual-scan.tool.ts`
- **Categories:** canvas, mixed-to-json, decision

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `cardTexts` | text | yes | yes | One text input part per selected card that has a title or body, formatted as `<title>: <body>` (each part ends with a newline). A card's image, if any, is sent as an image input part just before its text. |

## Example: Shampoo Bottle Pair

Which scan lens fits two shampoo bottle cards best?

### User

```text
A designer will run exactly one of the following analyses on the provided items. Which analysis would yield the richest, most specific, non-obvious design insight for these particular items?

emotions: Analyze the selected items and describe how people feel when interacting with them. Focus on emotional responses, moods, and psychological impact.
associations: Identify what concepts, objects, memories, or cultural references people associate with the selected items.
symbolism: Extract symbols, icons, and abstract meanings from the selected items. What do these elements represent metaphorically?
shape: Analyze the geometric shapes, contours, silhouettes, and profiles present in the selected items.
material: Identify the materials involved in or inspired by the selected items. Focus on physical properties and material expression.
color: Analyze the color palette present in the selected items and any colors associated with the underlying concepts.
tactility: Describe how the selected items would feel to the touch. Focus on texture, temperature, hardness, and surface finish.
acoustics: Imagine the sounds associated with the selected items. What do people hear when using or interacting with them?
interactions: Describe how people interact with the selected items. Focus on gestures, ergonomics, and functional usage patterns.
narrative: Create a narrative based on the selected items. Weave together the visual and textual elements into a cohesive story or scenario.

Matte Eucalyptus: Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.

Gloss Botanica: Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "choice"
      ]
    },
    "choice": {
      "type": "string",
      "description": "Lens key with the highest probability."
    },
    "probabilities": {
      "type": "object",
      "description": "Calibrated probability per lens key, summing to 1.",
      "additionalProperties": {
        "type": "number"
      }
    },
    "confidence": {
      "type": "number",
      "description": "Probability of the chosen lens."
    }
  },
  "required": [
    "type",
    "choice",
    "probabilities",
    "confidence"
  ]
}
```

## Presets

- **Shampoo Bottle Pair** — Which scan lens fits two shampoo bottle cards best?
- **Mouthwash Dosage Cap** — Rate lenses for a single mouthwash concept card.
- **Refill Ritual** — Rate lenses for a refill pouch and countertop bottle system.
