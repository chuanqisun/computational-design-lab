---
name: canvas-design-concepts
purpose: Generate multiple design concepts from mixed references and explicit design requirements.
source_files:
  - src/components/context-tray/llm/design-concepts.ts
input_types:
  - image
  - text
output_type: text
---

```handlebars role=user
Generate {{numDesigns}} unique design concepts based on the provided inputs (images and texts) and the following requirements:
{{#if requirements}}
{{#each requirements}}
{{this}}
{{/each}}
{{else}}
Any
{{/if}}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.
{{#if referenceSummary}}

Reference summary:
{{#each referenceSummary}}
{{this}}
{{/each}}
{{/if}}

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.
```

```json type=schema
{
  "type": "object",
  "properties": {
    "designs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "imagePrompt": { "type": "string" }
        },
        "required": ["title", "description", "imagePrompt"]
      }
    }
  },
  "required": ["designs"]
}
```

```json type=defaults
{
  "numDesigns": 3,
  "requirements": [
    "Design a premium shampoo bottle for a botanical repair line.",
    "Use a rounded bottle form, matte surfaces, and restrained green accents."
  ],
  "referenceSummary": [
    "Reference card: eucalyptus leaves, pale stone, soft daylight, calm spa mood.",
    "Reference card: compact rounded bottle with generous shoulders and flip-top cap."
  ]
}
```