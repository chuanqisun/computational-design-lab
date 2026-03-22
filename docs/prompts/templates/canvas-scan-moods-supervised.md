---
name: canvas-scan-moods-supervised
purpose: Score a predefined mood list, or fall back to open mood discovery, against a referenced item.
source_files:
  - src/components/context-tray/llm/scan-moods.ts
input_types:
  - image
  - text
output_type: json
---

```handlebars role=system
{{#if requiredList}}
  Analyze the provided item and assign an arousal level to each of the following moods:
  {{#each requiredList}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}. For each mood in the list, provide the exact
  mood string and an arousal level from 1 to 10, where 1 means the item has very low intensity of that mood and 10 means
  the item has very high intensity of that mood. Return ONLY valid JSON matching this schema:
{{else}}
  Analyze the provided item and identify 3-5 moods it evokes. For each mood, provide a single English word with first
  letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy. Return
  ONLY valid JSON matching this schema:
{{/if}}
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
    "moods": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "mood": { "type": "string" },
          "arousal": { "type": "number" }
        },
        "required": ["mood", "arousal"]
      }
    }
  },
  "required": ["moods"]
}
```

```json type=defaults
{
  "instruction": ["Analyze this shampoo packaging concept for the required moods and arousal levels."],
  "requiredList": ["Calm", "Restorative", "Premium", "Natural"]
}
```
