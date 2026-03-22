---
name: canvas-generate-personas
purpose: Generate synthetic user personas that vary along a chosen trait and optional segment.
source_files:
  - src/components/context-tray/llm/synthetic-users.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Generate {{numUsers}} synthetic user personas{{#if segment}} in the segment: {{#each segment}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}. Each persona should have varying levels of "{{trait}}". Give them realistic names, ages, occupations, and a brief 2-3 sentence description of their personality and how "{{trait}}" manifests in their life.
```

```json type=schema
{
  "type": "object",
  "properties": {
    "personas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "age": { "type": "number" },
          "occupation": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["name", "age", "occupation", "description"]
      }
    }
  },
  "required": ["personas"]
}
```

```json type=defaults
{
  "trait": "ingredient consciousness",
  "segment": [
    "Premium shampoo shoppers",
    "Urban professionals"
  ],
  "numUsers": 3
}
```