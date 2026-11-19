<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Visualize Concept

Generate up to 3 image-generation prompts that visualize the selected cards' text in an abstract or concrete style; each prompt is then rendered with the image model.

- **Template:** `src/prompt-templates/canvas-visualize-concept.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → json
- **Sources:** `src/components/context-tray/llm/visualize-concept.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, text-to-json, image-prompt-generation

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `conceptTitle` | text | yes | no | Concept title. The visualize_concept action always passes "Selected Concept". |
| `conceptDescription` | text | yes | no | Body text of all selected cards that have text, joined with a single space. |
| `instruction` | text | yes | no | Style instruction from VISUALIZE_STYLES in src/lib/actions/defs/generate.ts (abstract or concrete), chosen by the action's style argument. |

## Example: Visualize Shampoo Concept

Create render prompts from a botanical shampoo concept.

### User

```text
Create detailed prompts for image generation based on the following concept and instruction.

Concept: Selected Concept
Description: A rounded shampoo bottle with a soft shoulder profile, matte warm white body, and eucalyptus green cap. The concept should feel restorative, calm, and premium with subtle spa references.
Instruction: Create concrete, realistic visualizations that depict the concept in literal, tangible forms. Focus on detailed, lifelike representations that show the concept as it might appear in reality.

Generate up to 3 vivid, detailed descriptions suitable for an AI image generator. Capture diverse elements of the concept following the instruction. Each prompt covers subject, scene, style.

Respond in JSON format:
{
  "prompts": ["prompt1", "prompt2", "prompt3"]
}
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "prompts": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "maxItems": 3
    }
  },
  "required": [
    "prompts"
  ]
}
```

## Presets

- **Visualize Shampoo Concept** — Create render prompts from a botanical shampoo concept.
- **Visualize Mouthwash Concept** — Create prompts from a clinical mouthwash concept.
- **Visualize Refill Concept** — Create prompts from a refill-first packaging concept.
