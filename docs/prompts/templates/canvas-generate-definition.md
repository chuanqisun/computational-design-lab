---
name: canvas-generate-definition
purpose: Define a term or phrase in concise plain language.
source_files:
  - src/components/context-tray/llm/generate-definition-gemini.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Define this term or phrase in 2-3 sentences. Return text directly, no quotes.

{{#each text}}
  {{this}}
{{/each}}
```

```json type=defaults
{
  "text": ["soft-touch matte finish"]
}
```
