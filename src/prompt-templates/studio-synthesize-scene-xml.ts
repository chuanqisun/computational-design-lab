import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioSynthesizeSceneXmlVars {
  selectionJson: string;
  photoCount: number;
  customInstructions: string;
}

const system = `You are a product visualization scene generator. Output valid XML and nothing else. Do not wrap the output in markdown code blocks. Do not include any explanation or commentary.

The XML must cover these scene slots:
- Subject: identity, object class, pose, expression
- Setting: environment, geography, era, background
- Camera: lens, angle, distance, depth-of-field, aspect ratio
- Lighting: source, direction, color temperature, contrast
- Style / Medium: art form, rendering method
- Color / Grade: palette, saturation, tonal curve

XML format rules:
- Be hierarchical and efficient. Add details when asked by user.
- Avoid nesting too much. Prefer simple, obvious tag names.
- Use arbitrary xml tags and attributes. Prefer tags over attributes.
  - Use tags to describe subjects, objects, environments, and entities.
  - Use attributes to describe un-materialized properties such as style, material, lighting.
- Use concise natural language where description is needed.
- Spatial relationships must be explicitly described.
- Include human-readable descriptions throughout.
- Use Studio keyshot on white Infinity cove for rendering style.

For picked materials: infer the most appropriate surface options and color options based on the other picked items (colors, shapes, mechanisms). When there are multiple colors and multiple surface materials, pick the most straightforward assignment.
For picked surface options: use the specified surface finishes in the scene. If surface options conflict with chosen materials, prefer the user-specified surface options.
For picked mechanisms: describe what the mechanism is, but do NOT render it in action.`;

const template: PromptTemplateModule<
  StudioSynthesizeSceneXmlVars,
  "selectionJson" | "photoCount" | "customInstructions"
> = {
  metadata: {
    title: "Synthesize Scene XML",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "mixed-to-xml", "scene-synthesis"],
    inputType: "mixed",
    outputType: "xml",
    slots: {
      selectionJson: {
        description: "Serialized material, shape, mechanism, color, and surface selections.",
        required: true,
        multiple: false,
        type: "json",
      },
      photoCount: {
        description: "How many reference photos are attached.",
        required: false,
        multiple: false,
        type: "number",
      },
      customInstructions: {
        description: "Optional user instructions or imported canvas guidance.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  template: ({ selectionJson = "{}", photoCount = 0, customInstructions }) => ({
    system,
    user: `Given the following design selections, generate the scene XML.

${selectionJson}${
      photoCount > 0
        ? `

Note: The user has scanned ${photoCount} conceptual prototype photo(s). These photos show a rough reference for the product shape, proportion, geometry, and potential interactions. Use the photos only as general visual inspiration. The picked features from the library above are the source of truth for XML generation.`
        : ""
    }${
      customInstructions
        ? `

Additional instructions:
${customInstructions}`
        : ""
    }`,
  }),
};

export default template;
