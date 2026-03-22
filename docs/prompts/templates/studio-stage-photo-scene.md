---
name: studio-stage-photo-scene
purpose: Re-stage an existing product XML scene into a specific photo context.
source_files:
  - src/lib/studio-ai.ts
  - src/studio-page.ts
input_types:
  - text
output_type: xml
---

```handlebars role=user
Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.

Current XML:
{{currentXml}}

Photo scene: {{#each scene}}{{this}}{{#unless @last}}\n{{/unless}}{{/each}}
```

```json type=defaults
{
  "currentXml": "<scene>\n  <subject>\n    <product category=\"shampoo bottle\">Tall rounded bottle with a soft shoulder, wide flip-top cap, and subtle front label recess.</product>\n    <finish>Warm white PET body with a satin eucalyptus green cap and soft-touch label.</finish>\n  </subject>\n  <setting>\n    <environment>White infinity cove studio</environment>\n    <background>Minimal, bright, and clean</background>\n  </setting>\n  <camera lens=\"85mm\" angle=\"three-quarter front\" distance=\"mid\" depth-of-field=\"shallow\" />\n  <lighting source=\"large softbox\" direction=\"front-left\" contrast=\"soft\" colorTemperature=\"neutral daylight\" />\n  <style medium=\"Studio keyshot\" grade=\"clean commercial product render\" />\n</scene>",
  "scene": ["Stage the bottle on a premium bathroom shelf with folded towels, pale stone, and diffused morning light."]
}
```
