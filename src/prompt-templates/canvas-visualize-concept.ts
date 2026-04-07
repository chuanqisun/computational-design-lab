import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["prompts"],
} as const;

export interface CanvasVisualizeConceptVars {
  conceptTitle: string;
  conceptDescription: string | string[];
  instruction: string | string[];
  maxPrompts: number;
}

const canvasVisualizeConceptPresets = [
  {
    title: "Visualize Shampoo Concept",
    description: "Create render prompts from a botanical shampoo concept.",
    values: {
      conceptTitle: "Eucalyptus Repair",
      conceptDescription: [
        "A rounded shampoo bottle with a soft shoulder profile, matte warm white body, and eucalyptus green cap.",
        "The concept should feel restorative, calm, and premium with subtle spa references.",
      ],
      instruction: ["Generate premium studio render prompts with restrained styling and beauty-ad polish."],
      maxPrompts: 3,
    },
  },
  {
    title: "Visualize Mouthwash Concept",
    description: "Create prompts from a clinical mouthwash concept.",
    values: {
      conceptTitle: "Measured Clarity",
      conceptDescription: [
        "A transparent mouthwash bottle with beveled shoulders, visible aqua formula, and a measured dosage cap.",
        "The design communicates trust, freshness, and controlled use.",
      ],
      instruction: ["Generate clean commercial prompts with crisp lighting and front-label legibility."],
      maxPrompts: 3,
    },
  },
  {
    title: "Visualize Refill Concept",
    description: "Create prompts from a refill-first packaging concept.",
    values: {
      conceptTitle: "Refill Ritual",
      conceptDescription: [
        "A pearl matte shampoo refill pouch intended to sit visibly on a bathroom shelf.",
        "It balances sustainability with premium editorial appeal and quiet color blocking.",
      ],
      instruction: ["Generate prompts that make the pouch feel elevated, tactile, and environmentally considered."],
      maxPrompts: 4,
    },
  },
];

const template: PromptTemplateModule<
  CanvasVisualizeConceptVars,
  "conceptTitle" | "conceptDescription" | "instruction" | "maxPrompts"
> = {
  metadata: {
    title: "Visualize Concept",
    purpose: "Generate multiple image-generation prompts that visualize a concept and its instruction.",
    sourceFiles: ["src/components/context-tray/llm/visualize-concept.ts"],
    categories: ["canvas", "text-to-json", "image-prompt-generation"],
    inputType: "text",
    outputType: "json",
    outputSchema,
    slots: {
      conceptTitle: {
        description: "Concept title.",
        required: true,
        multiple: false,
        type: "text",
      },
      conceptDescription: {
        description: "Expanded concept description.",
        required: false,
        multiple: true,
        type: "text",
      },
      instruction: {
        description: "User instruction for how to interpret the concept visually.",
        required: false,
        multiple: true,
        type: "text",
      },
      maxPrompts: {
        description: "Upper bound on generated render prompts.",
        required: false,
        multiple: false,
        type: "number",
      },
    },
  },
  presets: canvasVisualizeConceptPresets,
  template: ({ conceptTitle = "", conceptDescription, instruction, maxPrompts = 3 }) => ({
    user: `Create detailed prompts for image generation based on the following concept and instruction.

Concept: ${conceptTitle}
Description: ${toTextBlock(conceptDescription)}
Instruction: ${toTextBlock(instruction)}

Generate up to ${maxPrompts} vivid, detailed descriptions suitable for an AI image generator. Capture diverse elements of the concept following the instruction. Each prompt covers subject, scene, style.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
  }),
};

export default template;
