import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasVisualizeConceptPresets } from "./prompt-template.presets";
import { toTextBlock } from "./prompt-template.utils";

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
    sourceFiles: ["src/components/context-tray/llm/visualize-concept.ts"],
    categories: ["canvas", "text-to-json", "image-prompt-generation"],
    inputType: "text",
    outputType: "json",
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

Respond in JSON format:
{
  "prompts": ["prompt1", "prompt2", "prompt3"]
}`,
  }),
};

export default template;
