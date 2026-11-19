<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Scan Concepts

Distill 3-5 key concepts from the selected canvas items (text and images) through a chosen scan lens.

- **Template:** `src/prompt-templates/canvas-scan-concepts.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/context-tray/llm/scan-concepts.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, mixed-to-json, concept-extraction

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `instruction` | text | yes | no | Scan lens instruction (one of SCAN_LENSES in src/lib/actions/defs/generate.ts: emotions, associations, symbolism, shape, material, color, tactility, acoustics, interactions, narrative). |
| `itemTexts` | text | no | yes | One text part per selected item that has a body, formatted as `<title>: <body>`. Item images are sent as separate image parts, each placed before that item's text. |

## Example: Extract Bottle Cues

Pull key form concepts from shampoo packaging references (shape lens).

### System instruction

```text
Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.
```

### User

```text
Analyze the geometric shapes, contours, silhouettes, and profiles present in the selected items.

Eucalyptus Repair: A rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.

Soft Shoulder Ritual: A palm-friendly silhouette that makes restorative care feel premium and tactile.
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "concepts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "title",
          "description"
        ]
      }
    }
  },
  "required": [
    "concepts"
  ]
}
```

## Presets

- **Extract Bottle Cues** — Pull key form concepts from shampoo packaging references (shape lens).
- **Extract Oral Care Signals** — Identify how mouthwash packaging makes people feel (emotions lens).
- **Extract Refill Ideas** — Focus concept extraction on refill behavior and ritual (interactions lens).
