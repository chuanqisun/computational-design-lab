---
name: canvas-rank-designs
purpose: Rank designs from a persona perspective against a target trait and return ordered IDs with brief feedback.
source_files:
  - src/components/context-tray/llm/synthetic-users.ts
input_types:
  - image
  - text
output_type: text
---

```handlebars role=system
{{personaSummary}}
```

```handlebars role=user
Here are {{designCount}} design concepts:

{{#each designSummaries}}
{{this}}

{{/each}}
Rank these designs from least to most "{{trait}}" based on your personal perspective. Return all {{designCount}} item IDs in order from least {{trait}} (first) to most {{trait}} (last). Also write 1-2 sentences of feedback explaining your ranking.
```

```json type=schema
{
  "type": "object",
  "properties": {
    "rankedItemIds": {
      "type": "array",
      "items": { "type": "string" }
    },
    "feedback": { "type": "string" }
  },
  "required": ["rankedItemIds", "feedback"]
}
```

```json type=defaults
{
  "personaSummary": "You are a 34-year-old product designer who shops for shampoo based on ingredient transparency, calm aesthetics, and whether the pack looks credible in a premium bathroom.",
  "trait": "premium",
  "designCount": 3,
  "designSummaries": [
    "A1: Rounded matte shampoo bottle with eucalyptus green cap and minimal recessed label.",
    "B2: Glossy shampoo bottle with high-contrast botanical graphics and metallic cap.",
    "C3: Refill pouch plus reusable countertop bottle system with soft neutral labeling."
  ]
}
```