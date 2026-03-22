---
name: canvas-blend-images
purpose: Blend multiple visual references into a single generated image guided by text instructions and reference notes.
source_files:
  - src/components/context-tray/llm/blend-images.ts
input_types:
  - image
  - text
output_type: image
---

```handlebars role=user
{{#each instruction}}
  {{this}}
{{/each}}{{#if itemNotes}}

  Reference notes:
  {{#each itemNotes}}
    {{this}}
  {{/each}}
{{/if}}
```

```json type=defaults
{
  "instruction": [
    "Blend the uploaded shampoo bottle render with the botanical reference image into one cohesive hero shot.",
    "Keep the bottle silhouette readable and let eucalyptus leaves influence only the supporting composition."
  ],
  "itemNotes": [
    "Reference 1: Rounded shampoo bottle with a matte off-white body and eucalyptus green cap.",
    "Reference 2: Dewy eucalyptus leaves on a pale stone surface with soft morning light."
  ]
}
```
