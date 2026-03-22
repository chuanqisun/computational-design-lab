---
name: canvas-caption-from-image
purpose: Generate a short caption for an input image.
source_files:
  - src/components/canvas/ai-helpers.ts
input_types:
  - image
output_type: text
---

```handlebars role=user
{{instruction}}
```

```json type=defaults
{
  "instruction": "Describe this mouthwash bottle in a short retail-ready caption."
}
```