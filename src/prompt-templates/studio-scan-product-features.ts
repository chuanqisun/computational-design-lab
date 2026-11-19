import { colors as libraryColors } from "../components/material-library/colors";
import { materials as libraryMaterials } from "../components/material-library/materials";
import { mechanisms as libraryMechanisms } from "../components/material-library/mechanisms";
import { shapes as libraryShapes } from "../components/material-library/shapes";
import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    shapes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: libraryShapes.map((s) => s.id) },
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
          id: { type: "string", enum: libraryMaterials.map((m) => m.id) },
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
          id: { type: "string", enum: libraryMechanisms.map((m) => m.id) },
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
          name: { type: "string", enum: libraryColors.map((c) => c.name) },
          hex: { type: "string" },
        },
        required: ["name", "hex"],
      },
    },
  },
  required: ["shapes", "materials", "mechanisms", "colors"],
};

// Default slot values mirror the full library lists interpolated by runScanAI().
const defaultShapes = libraryShapes.map((s) => `${s.id} (${s.name})`);
const defaultMaterials = libraryMaterials.map((m) => `${m.id} (${m.name})`);
const defaultMechanisms = libraryMechanisms.map((m) => `${m.id} (${m.name})`);
const defaultColors = libraryColors.map((c) => `${c.name}`);

export interface StudioScanProductFeaturesVars {
  shapes: string[];
  materials: string[];
  mechanisms: string[];
  colors: string[];
}

const studioScanProductFeaturesPresets = [
  {
    title: "Shampoo Feature Library",
    description: "Scan against a shampoo-oriented subset of library options.",
    values: {
      shapes: ["boston-round (Boston Round)", "cosmo-oval (Cosmo Oval)", "tottle (Tottle)"],
      materials: ["colored-hdpe (Colored HDPE)", "translucent-colored-pet (Translucent Colored PET)"],
      mechanisms: ["flip-top-cap (Flip Top Cap)", "pump-dispenser (Pump Dispenser)", "disc-top-cap (Disc Top Cap)"],
      colors: ["White", "Ivory", "Sea Green", "Dark Slate Gray"],
    },
  },
  {
    title: "Mouthwash Feature Library",
    description: "Scan against oral care packaging options.",
    values: {
      shapes: ["beveled-rectangle (Beveled Rectangle)", "square (Square)", "cylinder-round (Cylinder Round)"],
      materials: ["clear-pet (Clear PET)", "translucent-colored-pet (Translucent Colored PET)"],
      mechanisms: [
        "continuous-thread-screw-cap (Continuous Thread Screw Cap)",
        "child-resistant-cap (Child-Resistant Cap)",
        "flip-top-cap (Flip Top Cap)",
      ],
      colors: ["Aqua", "White", "Light Cyan", "Teal"],
    },
  },
  {
    title: "Refill Feature Library",
    description: "Scan against refill-focused pack options.",
    values: {
      shapes: [
        "f-style (F-Style (Rectangular Jug))",
        "industrial-round (Industrial Round (Handled Jug))",
        "tottle (Tottle)",
      ],
      materials: ["colored-hdpe (Colored HDPE)", "aluminum (Aluminum)", "glass (Glass)"],
      mechanisms: [
        "continuous-thread-screw-cap (Continuous Thread Screw Cap)",
        "push-pull-spout-cap (Push-Pull Spout Cap)",
        "wall-mounted-press-dispenser (Wall-Mounted Press Dispenser)",
      ],
      colors: ["Floral White", "Forest Green", "Gainsboro", "Light Slate Gray"],
    },
  },
];

const template: PromptTemplateModule<StudioScanProductFeaturesVars, "shapes" | "materials" | "mechanisms" | "colors"> =
  {
    metadata: {
      title: "Scan Product Features",
      purpose:
        "Extract product shapes, materials, mechanisms, and colors from a scanned photo (sent as an image part before the text) using only library-backed options; streamed JSON constrained by a library-enum schema.",
      sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
      categories: ["studio", "image-to-json", "feature-extraction"],
      inputType: "image",
      outputType: "json",
      model: "gemini-4-hydrogen",
      outputSchema,
      slots: {
        shapes: {
          description: "Shape library options as `id (name)`; defaults to the full shape library.",
          required: false,
          multiple: true,
          type: "text",
        },
        materials: {
          description: "Material library options as `id (name)`; defaults to the full material library.",
          required: false,
          multiple: true,
          type: "text",
        },
        mechanisms: {
          description: "Mechanism library options as `id (name)`; defaults to the full mechanism library.",
          required: false,
          multiple: true,
          type: "text",
        },
        colors: {
          description: "Color library names; defaults to the full color library.",
          required: false,
          multiple: true,
          type: "text",
        },
      },
    },
    presets: studioScanProductFeaturesPresets,
    template: ({
      shapes = defaultShapes,
      materials = defaultMaterials,
      mechanisms = defaultMechanisms,
      colors = defaultColors,
    }) => ({
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
