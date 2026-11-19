<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Generate Scene XML

Generate a complete product visualization scene XML from selected attributes, optional photos, and custom instructions.

- **Template:** `src/prompt-templates/studio-synthesize-scene-xml.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → xml
- **Sources:** `src/lib/studio-ai.ts`, `src/components/center-panel/center-panel.component.ts`, `src/studio-page.ts`
- **Categories:** studio, mixed-to-xml, scene-synthesis

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `selectionJson` | json | yes | no | Pretty-printed JSON of the picked colors, materials, surfaceOptions, mechanisms, and shapes, expanded with library details. |
| `photoCount` | number | no | no | How many scanned reference photos are attached as image parts before the text. |
| `customInstructions` | text | no | yes | Optional user instructions (may be prefilled by Import from Canvas in src/studio-page.ts). |
| `brandGuide` | text | no | yes | Optional synthesis brand guide appended to the system prompt. |

## Example: Synthesize Shampoo Scene

Generate scene XML from shampoo selections and instructions.

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
Given the following design selections, generate the scene XML.

{
  "colors": [
    {
      "name": "White",
      "hex": "#ffffff"
    },
    {
      "name": "Sea Green",
      "hex": "#2e8b57"
    }
  ],
  "materials": [
    {
      "name": "Colored HDPE",
      "visual": "A fully opaque, solid-colored material with a muted, utilitarian, and non-reflective appearance that hides internal contents.",
      "surfaceOptions": [
        "Matte",
        "Semi-gloss",
        "Orange-peel texture",
        "Easy-grip texture",
        "Raised grain",
        "Soft-touch"
      ],
      "colorOptions": [
        "custom"
      ]
    }
  ],
  "surfaceOptions": [
    "Soft-touch",
    "Matte"
  ],
  "mechanisms": [
    {
      "name": "Flip Top Cap",
      "interaction": "The user grips the bottle and pushes the hinged lid upward with a thumb or fingertip until it swings open past its vertical position, revealing the dispensing orifice. The bottle is then inverted and squeezed to dispense product. To close, the user pushes the lid back down until it snaps shut."
    }
  ],
  "shapes": [
    {
      "name": "Cosmo Oval",
      "description": "An elongated container with an elliptical cross-section that features a narrow depth and wide front and back panels. The shoulders are gradually sloped and rounded, mirroring the oval footprint of the base. This profile is specifically engineered for ergonomics, fitting naturally into the palm of the hand while providing a large, flat surface area for branding and labeling."
    }
  ]
}

Note: The user has scanned 1 conceptual prototype photo(s). These photos show a rough reference for the product shape, proportion, geometry, and potential interactions. Use the photos only as general visual inspiration. The picked features from the library above are the source of truth for XML generation.

Additional instructions:
Design a bottle inspired by calm botanical repair rituals.
Keep the presentation premium, tactile, and suitable for a beauty campaign render.
```

## Presets

- **Synthesize Shampoo Scene** — Generate scene XML from shampoo selections and instructions.
- **Synthesize Mouthwash Scene** — Generate scene XML from mouthwash library selections.
- **Synthesize Refill Scene** — Generate scene XML for a refill-led personal care concept.
