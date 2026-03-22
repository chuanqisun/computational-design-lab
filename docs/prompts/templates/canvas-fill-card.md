---
name: canvas-fill-card
purpose: Fill missing canvas card fields from the available text and image context.
source_files:
  - src/components/canvas/ai-helpers.ts
input_types:
  - image
  - text
output_type: text
---

```handlebars role=user
I have a card with the following content:
Title: {{#if title}}{{title}}{{else}}(missing){{/if}}
Body: {{#if body}}{{#each body}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}{{else}}(missing){{/if}}
Image Prompt: {{#if imagePrompt}}{{#each imagePrompt}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}{{else}}(missing){{/if}}
Image Status: {{#if imageStatus}}{{imageStatus}}{{else}}(unknown){{/if}}

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image is provided, generate a detailed image generation prompt.
- If image is provided, use it to generate the missing text fields.
{{#if guidance}}
- Additional guidance: {{#each guidance}}{{this}}{{#unless @last}} {{/unless}}{{/each}}
{{/if}}

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}
```

```json type=defaults
{
  "title": "",
  "body": [
    "A rounded shampoo bottle inspired by eucalyptus leaves and smooth river stones.",
    "The pack should feel restorative, quiet, and premium without leaning overly clinical."
  ],
  "imagePrompt": [
    "Studio render of a warm white matte shampoo bottle with a eucalyptus green cap."
  ],
  "imageStatus": "image ready",
  "guidance": [
    "Prioritize a short brandable title."
  ]
}
```