---
name: canvas-scan-moods
purpose: Identify moods evoked by a referenced item and score their arousal levels.
source_files:
  - src/components/context-tray/llm/scan-moods.ts
input_types:
  - image
  - text
output_type: json
---

```handlebars role=system
Analyze the provided item and identify 3-{{outputCount}}
moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1
to 10, where 1 is calm/low energy and 10 is intense/high energy. Return ONLY valid JSON matching this schema:
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
  "instruction": [
    "Analyze this shampoo packaging concept for moods and arousal levels with a focus on restorative botanical care."
  ],
  "outputCount": 5
}
```
