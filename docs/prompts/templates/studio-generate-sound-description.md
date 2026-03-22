---
name: studio-generate-sound-description
purpose: Generate a natural-language sound description for a product animation based on scene XML and motion instructions.
source_files:
  - src/lib/studio-ai.ts
input_types:
  - text
output_type: text
---

```handlebars role=user
Given the following product scene XML and an animation prompt, generate a short sound description that would accompany this animation. Describe the sounds naturally (e.g., mechanical clicks, liquid pouring, material textures). Output ONLY the sound description text, nothing else.

Scene XML:
{{sceneXml}}

Animation prompt: {{#each animationPrompt}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}
```

```json type=defaults
{
  "sceneXml": "<scene>\n  <subject>\n    <product category=\"shampoo bottle\">Tall rounded bottle with a soft shoulder, wide flip-top cap, and subtle front label recess.</product>\n    <finish>Warm white PET body with a satin eucalyptus green cap and soft-touch label.</finish>\n  </subject>\n  <setting>\n    <environment>White infinity cove studio</environment>\n    <background>Minimal, bright, and clean</background>\n  </setting>\n  <camera lens=\"85mm\" angle=\"three-quarter front\" distance=\"mid\" depth-of-field=\"shallow\" />\n  <lighting source=\"large softbox\" direction=\"front-left\" contrast=\"soft\" colorTemperature=\"neutral daylight\" />\n  <style medium=\"Studio keyshot\" grade=\"clean commercial product render\" />\n</scene>",
  "animationPrompt": [
    "The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap."
  ]
}
```