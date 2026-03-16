import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasBlendImagesVars {
  instruction: string | string[];
  itemNotes: string[];
}

const template: PromptTemplateModule<CanvasBlendImagesVars, "instruction" | "itemNotes"> = {
  metadata: {
    title: "Blend Images",
    sourceFiles: ["src/components/context-tray/llm/blend-images.ts"],
    categories: ["canvas", "mixed-to-image", "image-blending"],
    inputType: "mixed",
    outputType: "image",
    slots: {
      instruction: {
        description: "Primary blend or edit instruction.",
        required: true,
        multiple: true,
        type: "text",
      },
      itemNotes: {
        description: "Optional notes describing attached references.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  template: ({ instruction, itemNotes = [] }) => ({
    user: `${toTextBlock(instruction)}${
      itemNotes.length > 0
        ? `

Reference notes:
${itemNotes.join("\n")}`
        : ""
    }`,
  }),
};

export default template;
