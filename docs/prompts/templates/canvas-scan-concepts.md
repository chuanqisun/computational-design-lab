---
name: canvas-scan-concepts
purpose: Distill key concepts from referenced canvas items.
source_files:
  - src/components/context-tray/llm/scan-concepts.ts
input_types:
  - image
  - text
output_type: text
---

```handlebars role=system
Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear
title and one short sentence description.
```

```handlebars role=user
{{#each instruction}}
  {{this}}
{{/each}}
```

```json type=schema
{
  "type": "object",
  "properties": {
    "concepts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["title", "description"]
      }
    }
  },
  "required": ["concepts"]
}
```

```json type=defaults
{
  "instruction": ["Distill the key bottle form, finish, and brand mood concepts from the provided shampoo references."]
}
```
