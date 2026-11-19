<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Generate Sound Description

Generate a natural-language sound description for a staged product photo, run automatically after Take Photo using the staged scene XML and the photo scene as the animation prompt.

- **Template:** `src/prompt-templates/studio-generate-sound-description.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → text
- **Sources:** `src/lib/studio-ai.ts`, `src/components/center-panel/center-panel.component.ts`
- **Categories:** studio, text-to-text, sound-design

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `sceneXml` | xml | yes | no | Staged photo scene XML returned by the Stage Photo Scene step. |
| `animationPrompt` | text | yes | yes | Animation prompt; at photo time this is the trimmed photo scene text entered for Take Photo. |

## Example: Shampoo Cap Flip Sound

Describe sound for a shampoo product interaction.

### User

```text
Given the following product scene XML and an animation prompt, generate a short sound description that would accompany this animation. Describe the sounds naturally (e.g., mechanical clicks, liquid pouring, material textures). Output ONLY the sound description text, nothing else.

Scene XML:
<scene>
  <subject>
    <product category="shampoo bottle">Tall rounded bottle with a soft shoulder, wide flip-top cap, and subtle front label recess.</product>
    <finish>Warm white PET body with a satin eucalyptus green cap and soft-touch label.</finish>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Minimal, bright, and clean</background>
  </setting>
  <camera lens="85mm" angle="three-quarter front" distance="mid" depth-of-field="shallow" />
  <lighting source="large softbox" direction="front-left" contrast="soft" colorTemperature="neutral daylight" />
  <style medium="Studio keyshot" grade="clean commercial product render" />
</scene>

Animation prompt: The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap.
```

## Presets

- **Shampoo Cap Flip Sound** — Describe sound for a shampoo product interaction.
- **Mouthwash Pour Sound** — Describe sound for a mouthwash dosage motion.
- **Refill Pouch Decant Sound** — Describe sound for a refill pouch transfer.
