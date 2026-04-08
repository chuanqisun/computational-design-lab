import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioSynthesizeSceneXmlVars {
  selectionJson: string;
  photoCount: number;
  customInstructions: string | string[];
  brandGuide?: string | string[];
}

const shampooSelectionJson = `{
  "shapes": ["Tall rounded bottle", "Soft shoulder silhouette"],
  "materials": ["PET", "PP cap"],
  "surfaceOptions": ["Soft-touch matte label", "Satin cap"],
  "mechanisms": ["Flip-top cap"],
  "colors": ["Warm white", "Eucalyptus green"]
}`;

const mouthwashSelectionJson = `{
  "shapes": ["Rectangular bottle", "Beveled shoulder"],
  "materials": ["Clear PET", "PP dosing cap"],
  "surfaceOptions": ["Gloss bottle", "Matte label"],
  "mechanisms": ["Measured dosage cap"],
  "colors": ["Clear", "Aqua", "White"]
}`;

const refillSelectionJson = `{
  "shapes": ["Stand-up refill pouch", "Compact screw closure"],
  "materials": ["Flexible mono-material film"],
  "surfaceOptions": ["Matte pouch", "Clear product window"],
  "mechanisms": ["Screw cap"],
  "colors": ["Pearl white", "Deep forest green"]
}`;

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

const studioSynthesizeSceneXmlPresets = [
  {
    title: "Synthesize Shampoo Scene",
    description: "Generate scene XML from shampoo selections and instructions.",
    values: {
      selectionJson: shampooSelectionJson,
      photoCount: 1,
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
      customInstructions: [
        "Design a bottle inspired by calm botanical repair rituals.",
        "Keep the presentation premium, tactile, and suitable for a beauty campaign render.",
      ],
    },
  },
  {
    title: "Synthesize Mouthwash Scene",
    description: "Generate scene XML from mouthwash library selections.",
    values: {
      selectionJson: mouthwashSelectionJson,
      photoCount: 0,
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
      customInstructions: [
        "Create a premium mouthwash bottle scene that emphasizes trust, dosage clarity, and visible formula freshness.",
      ],
    },
  },
  {
    title: "Synthesize Refill Scene",
    description: "Generate scene XML for a refill-led personal care concept.",
    values: {
      selectionJson: refillSelectionJson,
      photoCount: 2,
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      customInstructions: [
        "Treat the refill pouch as premium enough for countertop display.",
        "Balance sustainable cues with a refined editorial studio render.",
      ],
    },
  },
];

const template: PromptTemplateModule<
  StudioSynthesizeSceneXmlVars,
  "selectionJson" | "photoCount" | "customInstructions" | "brandGuide"
> = {
  metadata: {
    title: "Generate Scene XML",
    purpose:
      "Generate a complete product visualization scene XML from selected attributes, optional photos, and custom instructions.",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "mixed-to-xml", "scene-synthesis"],
    inputType: "mixed",
    outputType: "xml",
    model: "gemini-3-flash-preview",
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
      brandGuide: {
        description: "Optional brand guidelines to follow in the system prompt.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioSynthesizeSceneXmlPresets,
  template: ({ selectionJson = "{}", photoCount = 0, customInstructions, brandGuide }) => ({
    system: toTextBlock(brandGuide)
      ? `${system}\n\nFollow this brand guide when making design, styling, material, color, and scene decisions:\n${toTextBlock(brandGuide)}`
      : system,
    user: `Given the following design selections, generate the scene XML.

${selectionJson}${
      photoCount > 0
        ? `

Note: The user has scanned ${photoCount} conceptual prototype photo(s). These photos show a rough reference for the product shape, proportion, geometry, and potential interactions. Use the photos only as general visual inspiration. The picked features from the library above are the source of truth for XML generation.`
        : ""
    }${
      toTextBlock(customInstructions)
        ? `

Additional instructions:
${toTextBlock(customInstructions)}`
        : ""
    }`,
  }),
};

export default template;
