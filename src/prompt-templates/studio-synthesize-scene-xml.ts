import type { PromptTemplateModule } from "./prompt-template.types";
import { colorsByName, materialsById, mechanismsById, shapesById } from "../lib/studio-utils";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioSynthesizeSceneXmlVars {
  selectionJson: string;
  photoCount: number;
  customInstructions: string | string[];
  brandGuide?: string | string[];
}

// Mirrors the selection payload built in synthesize() (src/lib/studio-ai.ts).
const toSelectionJson = (picked: {
  colors: string[];
  materials: string[];
  surfaceOptions: string[];
  mechanisms: string[];
  shapes: string[];
}) =>
  JSON.stringify(
    {
      colors: picked.colors.map((name) => {
        const c = colorsByName.get(name);
        return c ? { name: c.name, hex: c.hex } : { name, hex: "unknown" };
      }),
      materials: picked.materials.map((id) => {
        const m = materialsById.get(id);
        return m
          ? { name: m.name, visual: m.visual, surfaceOptions: m.surfaceOptions, colorOptions: m.colorOptions }
          : { name: id };
      }),
      surfaceOptions: picked.surfaceOptions,
      mechanisms: picked.mechanisms.map((id) => {
        const m = mechanismsById.get(id);
        return m ? { name: m.name, interaction: m.interaction } : { name: id };
      }),
      shapes: picked.shapes.map((id) => {
        const s = shapesById.get(id);
        return s ? { name: s.name, description: s.description } : { name: id };
      }),
    },
    null,
    2,
  );

const shampooSelectionJson = toSelectionJson({
  colors: ["White", "Sea Green"],
  materials: ["colored-hdpe"],
  surfaceOptions: ["Soft-touch", "Matte"],
  mechanisms: ["flip-top-cap"],
  shapes: ["cosmo-oval"],
});

const mouthwashSelectionJson = toSelectionJson({
  colors: ["Aqua", "White"],
  materials: ["clear-pet"],
  surfaceOptions: ["High gloss"],
  mechanisms: ["continuous-thread-screw-cap"],
  shapes: ["beveled-rectangle"],
});

const refillSelectionJson = toSelectionJson({
  colors: ["Floral White", "Forest Green"],
  materials: ["colored-hdpe"],
  surfaceOptions: ["Matte", "Easy-grip texture"],
  mechanisms: ["continuous-thread-screw-cap"],
  shapes: ["f-style"],
});

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
    sourceFiles: [
      "src/lib/studio-ai.ts",
      "src/components/center-panel/center-panel.component.ts",
      "src/studio-page.ts",
    ],
    categories: ["studio", "mixed-to-xml", "scene-synthesis"],
    inputType: "mixed",
    outputType: "xml",
    model: "gemini-4-hydrogen",
    slots: {
      selectionJson: {
        description:
          "Pretty-printed JSON of the picked colors, materials, surfaceOptions, mechanisms, and shapes, expanded with library details.",
        required: true,
        multiple: false,
        type: "json",
      },
      photoCount: {
        description: "How many scanned reference photos are attached as image parts before the text.",
        required: false,
        multiple: false,
        type: "number",
      },
      customInstructions: {
        description: "Optional user instructions (may be prefilled by Import from Canvas in src/studio-page.ts).",
        required: false,
        multiple: true,
        type: "text",
      },
      brandGuide: {
        description: "Optional synthesis brand guide appended to the system prompt.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioSynthesizeSceneXmlPresets,
  template: ({ selectionJson = "{}", photoCount = 0, customInstructions, brandGuide }) => ({
    developer: toTextBlock(brandGuide)
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
