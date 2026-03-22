---
name: studio-revise-scene-xml
purpose: Revise an existing scene XML document based on editing instructions.
source_files:
  - src/lib/studio-ai.ts
  - src/studio-page.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Revise the XML based on these instructions. Output only the updated XML, nothing else.

{{#each editInstructions}}
{{this}}
{{/each}}
```

```json type=defaults
{
  "editInstructions": [
    "Keep the bottle geometry unchanged.",
    "Soften the lighting, warm the color temperature slightly, and make the label feel more tactile and premium."
  ]
}
```