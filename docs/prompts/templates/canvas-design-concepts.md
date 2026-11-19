<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Generate Design Concepts

Generate multiple design concepts (title, description, image prompt) from the selected cards' images and text plus design requirements; used by both Design/Create and Design/Iterate.

- **Template:** `src/prompt-templates/canvas-design-concepts.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/context-tray/llm/design-concepts.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, mixed-to-json, concept-generation

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `numDesigns` | number | yes | no | How many concepts to produce. |
| `requirements` | text | no | yes | Design requirements (Design/Create) or iteration direction (Design/Iterate). Falls back to "Any" when empty. |
| `referenceItems` | text | no | yes | Text part of each selected card, formatted as "Title: <title>\nContent: <body>" and sent before the prompt (each after that card's image, if any). Cards without body text send only their image. |
| `brandGuide` | text | no | no | Optional brand guide, appended inline to the system instruction when non-empty. |

## Example: Botanical Shampoo Range

Concept generation from a natural haircare board.

### System instruction

```text
You generate design concepts from mixed visual and textual references. Follow the provided brand guide when making design decisions.

Brand guide: Luma Vale: calm botanicals, matte restraint, soft green accents.
```

### User

```text
Title: Spa Mood
Content: Eucalyptus leaves, pale stone, soft daylight, calm spa mood.

Title: Rounded Bottle
Content: Compact rounded bottle with generous shoulders and flip-top cap.

Generate 3 unique design concepts based on the provided inputs (images and texts) and the following requirements:
Design a premium shampoo bottle for a botanical repair line.
Use a rounded bottle form, matte surfaces, and restrained green accents.

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "designs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "imagePrompt": {
            "type": "string"
          }
        },
        "required": [
          "title",
          "description",
          "imagePrompt"
        ]
      }
    }
  },
  "required": [
    "designs"
  ]
}
```

## Presets

- **Botanical Shampoo Range** — Concept generation from a natural haircare board.
- **Family Mouthwash Concepts** — Explore approachable but trustworthy oral care concepts.
- **Refill System Concepts** — Generate sustainable packaging concepts for refill-led haircare.
