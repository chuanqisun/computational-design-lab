<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Revise Scene XML

Revise the synthesized scene XML in a multi-turn conversation: the prior synthesis turn (selections, reference photos, and model XML output) is sent as history, followed by this revision message.

- **Template:** `src/prompt-templates/studio-revise-scene-xml.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → xml
- **Sources:** `src/lib/studio-ai.ts`, `src/components/center-panel/center-panel.component.ts`
- **Categories:** studio, text-to-xml, revision

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `editInstructions` | text | yes | yes | Revision instructions applied to the XML from the previous model turn in the conversation history. |
| `brandGuide` | text | no | yes | Optional synthesis brand guide appended to the system prompt. |

## Example: Revise For Softer Light

Adjust a shampoo scene toward warmer, gentler presentation.

### System instruction

```text
You are a product visualization scene generator. Output valid XML and nothing else. Do not wrap the output in markdown code blocks. Do not include any explanation or commentary.

The XML must cover these scene slots:
- Subject: identity, object class, pose, expression
- Setting: environment, geography, era, background
- Camera: lens, angle, distance, depth-of-field, aspect ratio
- Lighting: source, direction, color temperature, contrast
- Style / Medium: art form, rendering method
- Color / Grade: palette, saturation, tonal curve

XML format rules:
- Be hierarchical and efficient. Add details when asked by user.
- Avoid nesting too much. Prefer simple, obvious tag names.
- Use arbitrary xml tags and attributes. Prefer tags over attributes.
  - Use tags to describe subjects, objects, environments, and entities.
  - Use attributes to describe un-materialized properties such as style, material, lighting.
- Use concise natural language where description is needed.
- Spatial relationships must be explicitly described.
- Include human-readable descriptions throughout.
- Use Studio keyshot on white Infinity cove for rendering style.

For picked materials: infer the most appropriate surface options and color options based on the other picked items (colors, shapes, mechanisms). When there are multiple colors and multiple surface materials, pick the most straightforward assignment.
For picked surface options: use the specified surface finishes in the scene. If surface options conflict with chosen materials, prefer the user-specified surface options.
For picked mechanisms: describe what the mechanism is, but do NOT render it in action.

Follow this brand guide when making design, styling, material, color, and scene decisions:
Luma Vale: calm botanicals, matte restraint, soft green accents.
```

### User

```text
Revise the XML based on these instructions. Output only the updated XML, nothing else.

Keep the bottle geometry unchanged.
Soften the lighting, warm the color temperature slightly, and make the label feel more tactile and premium.
```

## Presets

- **Revise For Softer Light** — Adjust a shampoo scene toward warmer, gentler presentation.
- **Revise For Dosage Demo** — Revise a mouthwash scene for clearer cap interaction cues.
- **Revise For Sustainability** — Push a refill concept toward a more tactile sustainable mood.
