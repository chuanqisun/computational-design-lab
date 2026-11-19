import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioImportCanvasInstructionsVars {
  cardDescriptions: string[];
}

const studioImportCanvasInstructionsPresets = [
  {
    title: "Import Shampoo Cards",
    description: "Import two shampoo concept cards into studio instructions.",
    values: {
      cardDescriptions: [
        "Eucalyptus Repair\nA rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.",
        "Soft Shoulder Ritual\nA palm-friendly silhouette that makes restorative care feel premium and tactile.",
      ],
    },
  },
  {
    title: "Import Mouthwash Cards",
    description: "Import mouthwash concept cards into studio instructions.",
    values: {
      cardDescriptions: [
        "Measured Clarity\nA transparent mouthwash bottle built around trust, visible formula clarity, and an intuitive dosage cap.",
        "Fresh Precision\nClinical geometry and crisp label architecture for a premium pharmacy shelf presence.",
      ],
    },
  },
  {
    title: "Import Refill Cards",
    description: "Import refill-led packaging concepts into studio instructions.",
    values: {
      cardDescriptions: [
        "Refill Ritual\nA countertop-worthy shampoo refill pouch with pearl matte film and a translucent product window.",
        "Countertop System\nReusable primary bottle plus elegant refill format designed for sustainable routines.",
      ],
    },
  },
];

const template: PromptTemplateModule<StudioImportCanvasInstructionsVars, "cardDescriptions"> = {
  metadata: {
    title: "Canvas to Studio conversion",
    purpose:
      'Convert imported canvas concept cards (title and body) into the Studio custom instructions, which are later sent to Gemini as "Additional instructions" in the scene XML synthesis prompt.',
    sourceFiles: ["src/studio-page.ts", "src/lib/studio-ai.ts"],
    categories: ["studio", "text-to-text", "input-prep"],
    inputType: "text",
    outputType: "text",
    model: "gemini-4-hydrogen",
    slots: {
      cardDescriptions: {
        description:
          "One entry per imported canvas card that has a title or body, formatted as title and body joined by a newline.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioImportCanvasInstructionsPresets,
  template: ({ cardDescriptions = [] }) => ({
    user: `Design a bottle inspired by the following design concept(s):

${cardDescriptions.join("\n\n")}

Use these concepts to guide the bottle's form, material, texture, color, and overall aesthetic.`,
  }),
};

export default template;
