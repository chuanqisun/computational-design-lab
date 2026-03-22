---
name: canvas-enhance-image-prompt
purpose: Rewrite a basic image prompt into a higher quality image-generation instruction using card context and quality goals.
source_files:
  - src/components/canvas/ai-helpers.ts
  - src/components/canvas/canvas.component.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image.

Original prompt: '{{originalPrompt}}'
Context from card: '{{#each cardContext}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}'
Quality goal: '{{#each qualityGoal}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}'

Keep it descriptive but concise. Return ONLY the enhanced prompt.
```

```json type=defaults
{
  "originalPrompt": "A shampoo bottle on a white background",
  "cardContext": [
    "Rounded botanical repair shampoo bottle with matte warm white body and eucalyptus green cap.",
    "The brand should feel premium, calm, and naturally science-backed."
  ],
  "qualityGoal": [
    "Push toward premium beauty advertising quality.",
    "Keep the prompt concise and image-model friendly."
  ]
}
```