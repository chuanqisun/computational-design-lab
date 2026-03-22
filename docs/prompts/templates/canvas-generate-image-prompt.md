---
name: canvas-generate-image-prompt
purpose: Convert source text into a detailed text-to-image prompt with optional rendering guidance.
source_files:
  - src/components/context-tray/llm/generate-image-prompt-gemini.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Create a detailed image generation prompt for the following text. The prompt should be descriptive, visual, and suitable for a text-to-image model. Return only the prompt.

{{#each text}}
{{this}}
{{/each}}{{#if guidance}}

Additional guidance:
{{#each guidance}}
{{this}}
{{/each}}
{{/if}}
```

```json type=defaults
{
  "text": [
    "A rounded botanical repair shampoo bottle with a warm white body, eucalyptus green cap, and subtle recessed front label."
  ],
  "guidance": [
    "Use premium beauty-ad style lighting.",
    "Keep the scene minimal and studio-based."
  ]
}
```