<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Stage Photo Scene

Re-stage the current synthesized product XML into a specific photo scene (Take Photo); the result feeds image generation and the sound description step.

- **Template:** `src/prompt-templates/studio-stage-photo-scene.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → xml
- **Sources:** `src/lib/studio-ai.ts`, `src/components/center-panel/center-panel.component.ts`
- **Categories:** studio, text-to-xml, photo-staging

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `currentXml` | xml | yes | no | Current synthesized product scene XML. |
| `scene` | text | yes | yes | Desired photo scene or scenario. |
| `brandGuide` | text | no | yes | Optional photo brand guide; when present it becomes the system prompt, otherwise no system prompt is sent. |

## Example: Bathroom Shelf Shampoo

Place the shampoo bottle in a calm bathroom shelf scene.

### System instruction

```text
You stage product photo scenes as XML. Follow the provided brand guide when choosing styling, materials, atmosphere, prop language, and visual tone. Output only XML, nothing else.

Brand guide:
Luma Vale: calm botanicals, matte restraint, soft green accents.
```

### User

```text
Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.

Current XML:
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

Photo scene: Stage the bottle on a premium bathroom shelf with folded towels, pale stone, and diffused morning light.
```

## Presets

- **Bathroom Shelf Shampoo** — Place the shampoo bottle in a calm bathroom shelf scene.
- **Sinkside Mouthwash** — Place the mouthwash bottle near a sink for a usage-oriented photo scene.
- **Editorial Refill Scene** — Stage a refill pouch in a restrained sustainable editorial environment.
