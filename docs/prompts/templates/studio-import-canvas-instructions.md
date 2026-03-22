---
name: studio-import-canvas-instructions
purpose: Convert imported canvas concept card descriptions into studio-specific bottle design guidance.
source_files:
  - src/studio-page.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Design a bottle inspired by the following design concept(s):

{{#each cardDescriptions}}
  {{this}}

{{/each}}
Use these concepts to guide the bottle's form, material, texture, color, and overall aesthetic.
```

```json type=defaults
{
  "cardDescriptions": [
    "Eucalyptus Repair\nA rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.",
    "Soft Shoulder Ritual\nA palm-friendly silhouette that makes restorative care feel premium and tactile."
  ]
}
```
