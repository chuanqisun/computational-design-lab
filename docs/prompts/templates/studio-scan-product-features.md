---
name: studio-scan-product-features
purpose: Extract product shapes, materials, mechanisms, and colors from a photo using only library-backed options.
source_files:
  - src/lib/studio-ai.ts
  - src/studio-page.ts
input_types:
  - image
output_type: text
---

```handlebars role=user
Analyze this photo of a product. Ignore any text labels, background elements, hands, and other non-product objects.
Focus only on the product itself. Identify the following features from the provided library options ONLY. Pick the
closest matches. Available shapes:
{{#each shapes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
Available materials:
{{#each materials}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
Available mechanisms:
{{#each mechanisms}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
Available colors:
{{#each colors}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

For each identified feature, return: - Shape: id, name, and description from library - Material: id, name, and visual
from library - Mechanism: id, name, and interaction from library - Color: name and hex from library Pick only items that
are visibly present on the product in the photo. Return empty arrays for categories not found.
```

```json type=schema
{
  "type": "object",
  "properties": {
    "shapes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["id", "name", "description"]
      }
    },
    "materials": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "visual": { "type": "string" }
        },
        "required": ["id", "name", "visual"]
      }
    },
    "mechanisms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "interaction": { "type": "string" }
        },
        "required": ["id", "name", "interaction"]
      }
    },
    "colors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "hex": { "type": "string" }
        },
        "required": ["name", "hex"]
      }
    }
  },
  "required": ["shapes", "materials", "mechanisms", "colors"]
}
```

```json type=defaults
{
  "shapes": ["Tall rounded bottle", "Soft shoulder silhouette", "Wide oval footprint"],
  "materials": ["PET", "HDPE", "PP cap"],
  "mechanisms": ["Flip-top cap", "Pump", "Screw cap"],
  "colors": ["Warm white", "Eucalyptus green", "Charcoal", "Amber"]
}
```
