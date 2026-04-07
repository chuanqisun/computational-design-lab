import { studioScanProductFeaturesPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    shapes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name", "description"],
      },
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          visual: { type: "string" },
        },
        required: ["id", "name", "visual"],
      },
    },
    mechanisms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          interaction: { type: "string" },
        },
        required: ["id", "name", "interaction"],
      },
    },
    colors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          hex: { type: "string" },
        },
        required: ["name", "hex"],
      },
    },
  },
  required: ["shapes", "materials", "mechanisms", "colors"],
} as const;

export interface StudioScanProductFeaturesVars {
  shapes: string[];
  materials: string[];
  mechanisms: string[];
  colors: string[];
}

const template: PromptTemplateModule<StudioScanProductFeaturesVars, "shapes" | "materials" | "mechanisms" | "colors"> =
  {
    metadata: {
      title: "Scan Product Features",
      purpose: "Extract product shapes, materials, mechanisms, and colors from a photo using only library-backed options.",
      sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
      categories: ["studio", "image-to-json", "feature-extraction"],
      inputType: "image",
      outputType: "json",
      outputSchema,
      slots: {
        shapes: {
          description: "Available shape library options.",
          required: false,
          multiple: true,
          type: "text",
        },
        materials: {
          description: "Available material library options.",
          required: false,
          multiple: true,
          type: "text",
        },
        mechanisms: {
          description: "Available mechanism library options.",
          required: false,
          multiple: true,
          type: "text",
        },
        colors: {
          description: "Available color library options.",
          required: false,
          multiple: true,
          type: "text",
        },
      },
    },
    presets: studioScanProductFeaturesPresets,
    template: ({ shapes = [], materials = [], mechanisms = [], colors = [] }) => ({
      user: `Analyze this photo of a product. Ignore any text labels, background elements, hands, and other non-product objects. Focus only on the product itself. Identify the following features from the provided library options ONLY. Pick the closest matches.

Available shapes: ${shapes.join(", ")}
Available materials: ${materials.join(", ")}
Available mechanisms: ${mechanisms.join(", ")}
Available colors: ${colors.join(", ")}

For each identified feature, return:
- Shape: id, name, and description from library
- Material: id, name, and visual from library
- Mechanism: id, name, and interaction from library
- Color: name and hex from library

Pick only items that are visibly present on the product in the photo. Return empty arrays for categories not found.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
    }),
  };

export default template;
