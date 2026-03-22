---
name: canvas-visualize-concept
purpose: Generate multiple image-generation prompts that visualize a concept and its instruction.
source_files:
  - src/components/context-tray/llm/visualize-concept.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Create detailed prompts for image generation based on the following concept and instruction.

Concept: {{conceptTitle}}
Description: {{#each conceptDescription}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}
Instruction: {{#each instruction}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}

Generate up to {{maxPrompts}} vivid, detailed descriptions suitable for an AI image generator. Capture diverse elements of the concept following the instruction. Each prompt covers subject, scene, style.

Respond in JSON format:
{
  "prompts": ["prompt1", "prompt2", "prompt3"]
}
```

```json type=defaults
{
  "conceptTitle": "Eucalyptus Repair",
  "conceptDescription": [
    "A rounded shampoo bottle with a soft shoulder profile, matte warm white body, and eucalyptus green cap.",
    "The concept should feel restorative, calm, and premium with subtle spa references."
  ],
  "instruction": [
    "Generate premium studio render prompts with restrained styling and beauty-ad polish."
  ],
  "maxPrompts": 3
}
```