---
name: canvas-generate-title-openai
purpose: Summarize longer source text into a short title using OpenAI.
source_files:
  - src/components/context-tray/llm/generate-title-openai.ts
input_types:
  - text
output_type: text
---

```handlebars role=system
Summarize user provided content into one word or short phrase
```

```handlebars role=user
{{#each fullText}}
{{this}}
{{/each}}
```

```json type=defaults
{
  "fullText": [
    "This shampoo bottle concept pairs restorative botanical cues with a rounded, palm-friendly silhouette. Warm white surfaces, eucalyptus green accents, and minimal typography create a calm premium presence."
  ]
}
```