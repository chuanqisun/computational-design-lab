import { canvasVisualizeConceptPresets } from "./prompt-template.presets";
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
