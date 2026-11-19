<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Generate Personas

Generate synthetic user personas (name, age, gender, occupation, description, Gemini Live voice) that vary along a chosen trait within an optional segment.

- **Template:** `src/prompt-templates/canvas-generate-personas.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → json
- **Sources:** `src/components/context-tray/llm/synthetic-users.ts`, `src/lib/actions/defs/media.ts`, `src/lib/gemini-voices.ts`
- **Categories:** canvas, text-to-json, persona-generation

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `trait` | text | yes | no | Trait to vary across personas. |
| `segment` | text | no | no | Optional market or demographic segment ("All" or empty means no segment). |
| `numUsers` | number | yes | no | How many personas to generate. |

## Example: Salon-Lite Shoppers

Generate personas for a premium botanical shampoo segment.

### User

```text
Generate 3 synthetic user personas in the segment: Premium shampoo shoppers, urban professionals. Each persona should have varying levels of "ingredient consciousness". Give them realistic names, ages, genders ("female", "male", or "neutral" for non-binary / gender-neutral personas), occupations, a brief 2-3 sentence description of their personality and how "ingredient consciousness" manifests in their life, and a matching Gemini Live voiceName.

Assign each persona a distinct voiceName from the Gemini Live catalog below, matching female personas to female voices, male personas to male voices, and gender-neutral ("neutral") personas to a balanced or personality-fitting voice:
Female voices: Zephyr (Bright), Kore (Firm), Leda (Youthful), Aoede (Breezy), Callirrhoe (Easy-going), Autonoe (Bright), Despina (Smooth), Erinome (Clear), Laomedeia (Upbeat), Achernar (Soft), Gacrux (Mature), Vindemiatrix (Gentle), Sulafat (Warm)
Male voices: Puck (Upbeat), Charon (Informative), Fenrir (Excitable), Orus (Firm), Enceladus (Breathy), Iapetus (Clear), Umbriel (Easy-going), Algieba (Smooth), Algenib (Gravelly), Rasalgethi (Informative), Alnilam (Firm), Schedar (Even), Achird (Friendly), Zubenelgenubi (Casual), Sadachbia (Lively), Sadaltager (Knowledgeable)
Gender-neutral voice: Pulcherrima (Forward)
Additional balanced voices well-suited for gender-neutral / non-binary personas: Zephyr (Bright), Puck (Upbeat), Aoede (Breezy), Callirrhoe (Easy-going), Umbriel (Easy-going), Schedar (Even), Achird (Friendly), Sulafat (Warm) (or any voice above that best fits the persona's tone)
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "personas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "age": {
            "type": "number"
          },
          "gender": {
            "type": "string",
            "enum": [
              "female",
              "male",
              "neutral"
            ]
          },
          "occupation": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "voiceName": {
            "type": "string",
            "enum": [
              "Zephyr",
              "Puck",
              "Charon",
              "Kore",
              "Fenrir",
              "Leda",
              "Orus",
              "Aoede",
              "Callirrhoe",
              "Autonoe",
              "Enceladus",
              "Iapetus",
              "Umbriel",
              "Algieba",
              "Despina",
              "Erinome",
              "Algenib",
              "Rasalgethi",
              "Laomedeia",
              "Achernar",
              "Alnilam",
              "Schedar",
              "Gacrux",
              "Pulcherrima",
              "Achird",
              "Zubenelgenubi",
              "Vindemiatrix",
              "Sadachbia",
              "Sadaltager",
              "Sulafat"
            ]
          }
        },
        "required": [
          "name",
          "age",
          "gender",
          "occupation",
          "description",
          "voiceName"
        ]
      }
    }
  },
  "required": [
    "personas"
  ]
}
```

## Presets

- **Salon-Lite Shoppers** — Generate personas for a premium botanical shampoo segment.
- **Family Oral Care** — Create personas for approachable mouthwash packaging decisions.
- **Eco Refill Buyers** — Generate refill-oriented packaging personas.
