<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Canvas to Studio conversion

Convert imported canvas concept cards (title and body) into the Studio custom instructions, which are later sent to Gemini as "Additional instructions" in the scene XML synthesis prompt.

- **Template:** `src/prompt-templates/studio-import-canvas-instructions.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → text
- **Sources:** `src/studio-page.ts`, `src/lib/studio-ai.ts`
- **Categories:** studio, text-to-text, input-prep

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `cardDescriptions` | text | no | yes | One entry per imported canvas card that has a title or body, formatted as title and body joined by a newline. |

## Example: Import Shampoo Cards

Import two shampoo concept cards into studio instructions.

### User

```text
Design a bottle inspired by the following design concept(s):

Eucalyptus Repair
A rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.

Soft Shoulder Ritual
A palm-friendly silhouette that makes restorative care feel premium and tactile.

Use these concepts to guide the bottle's form, material, texture, color, and overall aesthetic.
```

## Presets

- **Import Shampoo Cards** — Import two shampoo concept cards into studio instructions.
- **Import Mouthwash Cards** — Import mouthwash concept cards into studio instructions.
- **Import Refill Cards** — Import refill-led packaging concepts into studio instructions.
