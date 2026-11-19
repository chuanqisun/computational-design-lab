import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
  required: ["prompts"],
} as const;

// Mirrors VISUALIZE_STYLES in src/lib/actions/defs/generate.ts.
const VISUALIZE_ABSTRACT =
  "Create abstract, artistic visualizations that capture the essence of the concept in non-literal, symbolic ways. Use diverse artistic styles, colors, and compositions to represent ideas metaphorically.";
const VISUALIZE_CONCRETE =
  "Create concrete, realistic visualizations that depict the concept in literal, tangible forms. Focus on detailed, lifelike representations that show the concept as it might appear in reality.";

export interface CanvasVisualizeConceptVars {
  conceptTitle: string;
  conceptDescription: string;
  instruction: string;
}

const canvasVisualizeConceptPresets = [
  {
    title: "Visualize Shampoo Concept",
    description: "Create render prompts from a botanical shampoo concept.",
    values: {
      conceptTitle: "Selected Concept",
      conceptDescription:
        "A rounded shampoo bottle with a soft shoulder profile, matte warm white body, and eucalyptus green cap. The concept should feel restorative, calm, and premium with subtle spa references.",
      instruction: VISUALIZE_CONCRETE,
    },
  },
  {
    title: "Visualize Mouthwash Concept",
    description: "Create prompts from a clinical mouthwash concept.",
    values: {
      conceptTitle: "Selected Concept",
      conceptDescription:
        "A transparent mouthwash bottle with beveled shoulders, visible aqua formula, and a measured dosage cap. The design communicates trust, freshness, and controlled use.",
      instruction: VISUALIZE_CONCRETE,
    },
  },
  {
    title: "Visualize Refill Concept",
    description: "Create prompts from a refill-first packaging concept.",
    values: {
      conceptTitle: "Selected Concept",
      conceptDescription:
        "A pearl matte shampoo refill pouch intended to sit visibly on a bathroom shelf. It balances sustainability with premium editorial appeal and quiet color blocking.",
      instruction: VISUALIZE_ABSTRACT,
    },
  },
];

const template: PromptTemplateModule<
  CanvasVisualizeConceptVars,
  "conceptTitle" | "conceptDescription" | "instruction"
> = {
  metadata: {
    title: "Visualize Concept",
    purpose:
      "Generate up to 3 image-generation prompts that visualize the selected cards' text in an abstract or concrete style; each prompt is then rendered with the image model.",
    sourceFiles: ["src/components/context-tray/llm/visualize-concept.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "text-to-json", "image-prompt-generation"],
    inputType: "text",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      conceptTitle: {
        description: 'Concept title. The visualize_concept action always passes "Selected Concept".',
        required: true,
        multiple: false,
        type: "text",
      },
      conceptDescription: {
        description: "Body text of all selected cards that have text, joined with a single space.",
        required: true,
        multiple: false,
        type: "text",
      },
      instruction: {
        description:
          "Style instruction from VISUALIZE_STYLES in src/lib/actions/defs/generate.ts (abstract or concrete), chosen by the action's style argument.",
        required: true,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasVisualizeConceptPresets,
  template: ({ conceptTitle = "", conceptDescription = "", instruction = "" }) => ({
    user: `Create detailed prompts for image generation based on the following concept and instruction.

Concept: ${conceptTitle}
Description: ${conceptDescription}
Instruction: ${instruction}

Generate up to 3 vivid, detailed descriptions suitable for an AI image generator. Capture diverse elements of the concept following the instruction. Each prompt covers subject, scene, style.

Respond in JSON format:
{
  "prompts": ["prompt1", "prompt2", "prompt3"]
}`,
  }),
};

export default template;
