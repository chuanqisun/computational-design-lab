---
name: canvas-generate-title-gemini
purpose: Summarize longer source text into a one-word or short-phrase title using Gemini.
source_files:
  - src/components/context-tray/llm/generate-title-gemini.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
One word/short phrase summary of text. Return text directly, no quotes.

{{#each text}}
{{this}}
{{/each}}
```

```json type=defaults
{
  "text": [
    "A restorative shampoo bottle concept inspired by eucalyptus leaves, smooth stone forms, and a calm spa ritual. The bottle uses a rounded shoulder silhouette and muted green cap to signal repair and softness."
  ]
}
```