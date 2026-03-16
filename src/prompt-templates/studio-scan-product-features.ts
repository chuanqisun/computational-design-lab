import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioScanProductFeaturesVars {
  shapes: string[];
  materials: string[];
  mechanisms: string[];
  colors: string[];
}

const template: PromptTemplateModule<StudioScanProductFeaturesVars, "shapes" | "materials" | "mechanisms" | "colors"> = {
  metadata: {
    title: "Scan Product Features",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "image-to-json", "feature-extraction"],
    inputType: "image",
    outputType: "json",
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

Pick only items that are visibly present on the product in the photo. Return empty arrays for categories not found.`,
  }),
};

export default template;